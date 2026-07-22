import { describe, expect, it } from 'vitest';
import { Clef } from '@scoregrove/domain/Clef';
import { Duration, NoteValue } from '@scoregrove/domain/Duration';
import { Mode, type KeySignature } from '@scoregrove/domain/KeySignature';
import { StaffContent, type Measure } from '@scoregrove/domain/Measure';
import { Chord, Note, Rest, TieRole, type MeasureElement } from '@scoregrove/domain/MeasureElement';
import { NonEmptyArray } from '@scoregrove/domain/NonEmptyArray';
import { Octave, Pitch, PitchClass, PitchLetter } from '@scoregrove/domain/Pitch';
import { PositiveInteger } from '@scoregrove/domain/PositiveInteger';
import { Result } from '@scoregrove/domain/Result';
import { Score } from '@scoregrove/domain/Score';
import { Staff } from '@scoregrove/domain/Staff';
import { BeatUnit, type TimeSignature } from '@scoregrove/domain/TimeSignature';
import { EventFlattening, type BeatEvent } from '../src/EventFlattening';
import { NavigationUnfolding, type PlayStep } from '../src/NavigationUnfolding';

const pitch = (letter: PitchLetter, octave: number): Pitch =>
  Pitch.of(PitchClass.of(letter), Octave.of(octave));

const quarter = Duration.of(NoteValue.Quarter);
const half = Duration.of(NoteValue.Half);
const whole = Duration.of(NoteValue.Whole);
const cMajor: KeySignature = { tonic: PitchClass.of(PitchLetter.C), mode: Mode.Major };
const gMajor: KeySignature = { tonic: PitchClass.of(PitchLetter.G), mode: Mode.Major };
const fourFour: TimeSignature = { beats: PositiveInteger.of(4), beatUnit: BeatUnit.Quarter };

const measureOf = (elements: MeasureElement[], nav: Partial<Measure> = {}): Measure => ({
  contents: NonEmptyArray.of([StaffContent.singleVoice(NonEmptyArray.of(elements))]),
  ...nav,
});

const scoreOf = (measures: Measure[], key: KeySignature = cMajor): Score =>
  Score.of({
    staves: NonEmptyArray.of([Staff.of(Clef.Treble)]),
    key,
    time: fourFour,
    measures: NonEmptyArray.of(measures),
  });

const steps = (...indices: number[]): PlayStep[] =>
  indices.map((measureIndex) => ({ measureIndex, pass: 1 }));

/** A compact, comparable view of an event: reduced start/duration fractions, pitch, and address. */
const view = (event: BeatEvent) => ({
  start: [event.startBeat.numerator, event.startBeat.denominator],
  dur: [event.durationBeats.numerator, event.durationBeats.denominator],
  pitch: event.pitchNumber,
  addr: [event.address.measure, event.address.staff, event.address.voice, event.address.element],
});

const flatten = (score: Score, order?: PlayStep[]) =>
  EventFlattening.flatten(score, order ?? NavigationUnfolding.unfold(score)).map(view);

describe('EventFlattening.flatten', () => {
  it('places notes at their onsets and skips rests', () => {
    const score = scoreOf([
      measureOf([
        Note.of(pitch(PitchLetter.C, 4), quarter),
        Note.of(pitch(PitchLetter.D, 4), quarter),
        Rest.of(quarter),
        Note.of(pitch(PitchLetter.E, 4), quarter),
      ]),
    ]);

    expect(flatten(score)).toEqual([
      { start: [0, 1], dur: [1, 4], pitch: 60, addr: [0, 0, 0, 0] },
      { start: [1, 4], dur: [1, 4], pitch: 62, addr: [0, 0, 0, 1] },
      { start: [3, 4], dur: [1, 4], pitch: 64, addr: [0, 0, 0, 3] },
    ]);
  });

  it('folds a tie within a measure into one event', () => {
    const score = scoreOf([
      measureOf([
        Note.of(pitch(PitchLetter.C, 4), half, { tie: TieRole.Begin }),
        Note.of(pitch(PitchLetter.C, 4), half, { tie: TieRole.End }),
      ]),
    ]);

    expect(flatten(score)).toEqual([{ start: [0, 1], dur: [1, 1], pitch: 60, addr: [0, 0, 0, 0] }]);
  });

  it('folds a tie across a barline, absorbing the continuation', () => {
    const score = scoreOf([
      measureOf([Note.of(pitch(PitchLetter.C, 4), whole, { tie: TieRole.Begin })]),
      measureOf([Note.of(pitch(PitchLetter.C, 4), whole, { tie: TieRole.End })]),
    ]);

    // one two-whole-note event, nothing at the downbeat of measure 2
    expect(flatten(score, steps(0, 1))).toEqual([
      { start: [0, 1], dur: [2, 1], pitch: 60, addr: [0, 0, 0, 0] },
    ]);
  });

  it('folds a three-link chain through a Both', () => {
    const score = scoreOf([
      measureOf([Note.of(pitch(PitchLetter.C, 4), whole, { tie: TieRole.Begin })]),
      measureOf([Note.of(pitch(PitchLetter.C, 4), whole, { tie: TieRole.Both })]),
      measureOf([Note.of(pitch(PitchLetter.C, 4), whole, { tie: TieRole.End })]),
    ]);

    expect(flatten(score, steps(0, 1, 2))).toEqual([
      { start: [0, 1], dur: [3, 1], pitch: 60, addr: [0, 0, 0, 0] },
    ]);
  });

  it('emits one event per chord tone at a shared onset', () => {
    const chordResult = Chord.create([pitch(PitchLetter.C, 4), pitch(PitchLetter.E, 4)], half);

    if (!Result.isOk(chordResult)) throw new Error('bad fixture');

    const score = scoreOf([measureOf([chordResult.value, Rest.of(half)])]);

    expect(flatten(score)).toEqual([
      { start: [0, 1], dur: [1, 2], pitch: 60, addr: [0, 0, 0, 0] },
      { start: [0, 1], dur: [1, 2], pitch: 64, addr: [0, 0, 0, 0] },
    ]);
  });

  it('accumulates the offset across the whole play order (repeats included)', () => {
    const score = scoreOf([
      measureOf([Note.of(pitch(PitchLetter.C, 4), whole)]),
      measureOf([Note.of(pitch(PitchLetter.D, 4), whole)]),
    ]);

    // played twice through by an explicit repeat order → beats 0,1,2,3
    expect(flatten(score, steps(0, 1, 0, 1))).toEqual([
      { start: [0, 1], dur: [1, 1], pitch: 60, addr: [0, 0, 0, 0] },
      { start: [1, 1], dur: [1, 1], pitch: 62, addr: [1, 0, 0, 0] },
      { start: [2, 1], dur: [1, 1], pitch: 60, addr: [0, 0, 0, 0] },
      { start: [3, 1], dur: [1, 1], pitch: 62, addr: [1, 0, 0, 0] },
    ]);
  });

  it('sounds pitches under the effective key (a bare F in G major is F♯)', () => {
    const score = scoreOf([measureOf([Note.of(pitch(PitchLetter.F, 4), whole)])], gMajor);

    expect(flatten(score)).toEqual([{ start: [0, 1], dur: [1, 1], pitch: 66, addr: [0, 0, 0, 0] }]);
  });

  it('advances by a pickup measure’s actual length, not a full bar', () => {
    const score = scoreOf([
      measureOf([Note.of(pitch(PitchLetter.G, 4), quarter)]), // one-beat anacrusis
      measureOf([Note.of(pitch(PitchLetter.C, 4), whole)]),
    ]);

    expect(flatten(score, steps(0, 1))).toEqual([
      { start: [0, 1], dur: [1, 4], pitch: 67, addr: [0, 0, 0, 0] },
      { start: [1, 4], dur: [1, 1], pitch: 60, addr: [1, 0, 0, 0] },
    ]);
  });
});
