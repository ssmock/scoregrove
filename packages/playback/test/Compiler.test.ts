import { describe, expect, it } from 'vitest';
import { ClosingBarline, OpeningBarline } from '@scoregrove/domain/Barline';
import { Clef } from '@scoregrove/domain/Clef';
import { Duration, NoteValue } from '@scoregrove/domain/Duration';
import { Mode } from '@scoregrove/domain/KeySignature';
import { StaffContent, type Measure } from '@scoregrove/domain/Measure';
import { Note, type MeasureElement } from '@scoregrove/domain/MeasureElement';
import { NonEmptyArray } from '@scoregrove/domain/NonEmptyArray';
import { Octave, Pitch, PitchClass, PitchLetter } from '@scoregrove/domain/Pitch';
import { PositiveInteger } from '@scoregrove/domain/PositiveInteger';
import { Result } from '@scoregrove/domain/Result';
import { Score } from '@scoregrove/domain/Score';
import { Staff } from '@scoregrove/domain/Staff';
import { MetronomeMark } from '@scoregrove/domain/Tempo';
import { BeatUnit, type TimeSignature } from '@scoregrove/domain/TimeSignature';
import { Compiler } from '../src/Compiler';

const note = (letter: PitchLetter, octave: number, duration: Duration): Note =>
  Note.of(Pitch.of(PitchClass.of(letter), Octave.of(octave)), duration);

const quarter = Duration.of(NoteValue.Quarter);
const whole = Duration.of(NoteValue.Whole);
const cMajor = { tonic: PitchClass.of(PitchLetter.C), mode: Mode.Major };
const fourFour: TimeSignature = { beats: PositiveInteger.of(4), beatUnit: BeatUnit.Quarter };
const mm120 = MetronomeMark.of(NoteValue.Quarter, PositiveInteger.of(120));

const measureOf = (elements: MeasureElement[], nav: Partial<Measure> = {}): Measure => ({
  contents: NonEmptyArray.of([StaffContent.singleVoice(NonEmptyArray.of(elements))]),
  ...nav,
});

const scoreOf = (measures: Measure[], extras: { tempo?: Score['tempo'] } = {}): Score =>
  Score.of({
    staves: NonEmptyArray.of([Staff.of(Clef.Treble)]),
    key: cMajor,
    time: fourFour,
    ...extras,
    measures: NonEmptyArray.of(measures),
  });

const expectOk = <T>(result: Result<T>): T => {
  if (!Result.isOk(result)) throw new Error('expected ok');

  return result.value;
};

describe('Compiler.compile', () => {
  it('produces a real-time performance end to end', () => {
    const score = scoreOf(
      [
        measureOf([
          note(PitchLetter.C, 4, quarter),
          note(PitchLetter.E, 4, quarter),
          note(PitchLetter.G, 4, quarter),
          note(PitchLetter.C, 5, quarter),
        ]),
      ],
      { tempo: mm120 },
    );

    const performance = expectOk(Compiler.compile(score));

    expect(performance.events.map((e) => e.pitchNumber)).toEqual([60, 64, 67, 72]);
    expect(performance.events.map((e) => e.startSeconds)).toEqual([0, 0.5, 1, 1.5]);
    expect(performance.durationSeconds).toBeCloseTo(2, 9); // one 4/4 bar at ♩=120
    for (const event of performance.events) {
      expect(event.durationSeconds).toBeCloseTo(0.5, 9);
    }
  });

  it('honors repeats in the sounding order (a section plays twice)', () => {
    const score = scoreOf(
      [
        measureOf([note(PitchLetter.C, 4, whole)], { opening: OpeningBarline.RepeatOpen }),
        measureOf([note(PitchLetter.D, 4, whole)], { closing: ClosingBarline.RepeatClose }),
      ],
      { tempo: mm120 },
    );

    const performance = expectOk(Compiler.compile(score));

    // C D C D, each a 2s whole note → starts 0,2,4,6
    expect(performance.events.map((e) => e.pitchNumber)).toEqual([60, 62, 60, 62]);
    expect(performance.events.map((e) => e.startSeconds)).toEqual([0, 2, 4, 6]);
    expect(performance.durationSeconds).toBeCloseTo(8, 9);
  });

  it('refuses an invalid score rather than sounding it', () => {
    // an overfull measure: two whole notes in a 4/4 bar
    const score = scoreOf([
      measureOf([note(PitchLetter.C, 4, whole), note(PitchLetter.D, 4, whole)]),
    ]);

    expect(Result.isError(Compiler.compile(score))).toBe(true);
  });
});
