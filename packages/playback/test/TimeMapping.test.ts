import { describe, expect, it } from 'vitest';
import { Clef } from '@scoregrove/domain/Clef';
import { Duration, NoteValue } from '@scoregrove/domain/Duration';
import { Fraction } from '@scoregrove/domain/Fraction';
import { Mode } from '@scoregrove/domain/KeySignature';
import { StaffContent, type Measure } from '@scoregrove/domain/Measure';
import { Note, TieRole, type MeasureElement } from '@scoregrove/domain/MeasureElement';
import { NonEmptyArray } from '@scoregrove/domain/NonEmptyArray';
import { Octave, Pitch, PitchClass, PitchLetter } from '@scoregrove/domain/Pitch';
import { PositiveInteger } from '@scoregrove/domain/PositiveInteger';
import { Score } from '@scoregrove/domain/Score';
import { Staff } from '@scoregrove/domain/Staff';
import { MetronomeMark } from '@scoregrove/domain/Tempo';
import { BeatUnit, type TimeSignature } from '@scoregrove/domain/TimeSignature';
import { EventFlattening } from '../src/EventFlattening';
import { NavigationUnfolding, type PlayStep } from '../src/NavigationUnfolding';
import { TimeMapping } from '../src/TimeMapping';

const c4 = Pitch.of(PitchClass.of(PitchLetter.C), Octave.of(4));
const quarter = Duration.of(NoteValue.Quarter);
const whole = Duration.of(NoteValue.Whole);
const cMajor = { tonic: PitchClass.of(PitchLetter.C), mode: Mode.Major };
const fourFour: TimeSignature = { beats: PositiveInteger.of(4), beatUnit: BeatUnit.Quarter };

// ♩ = 120 → a quarter is 0.5s, a whole note 2s. ♩ = 240 → a whole note 1s.
const mm120 = MetronomeMark.of(NoteValue.Quarter, PositiveInteger.of(120));
const mm240 = MetronomeMark.of(NoteValue.Quarter, PositiveInteger.of(240));

const measureOf = (elements: MeasureElement[], nav: Partial<Measure> = {}): Measure => ({
  contents: NonEmptyArray.of([StaffContent.singleVoice(NonEmptyArray.of(elements))]),
  ...nav,
});

const wholeNoteMeasure = (nav: Partial<Measure> = {}): Measure =>
  measureOf([Note.of(c4, whole)], nav);

const scoreOf = (measures: Measure[], extras: { tempo?: Score['tempo'] } = {}): Score =>
  Score.of({
    staves: NonEmptyArray.of([Staff.of(Clef.Treble)]),
    key: cMajor,
    time: fourFour,
    ...extras,
    measures: NonEmptyArray.of(measures),
  });

const steps = (...indices: number[]): PlayStep[] =>
  indices.map((measureIndex) => ({ measureIndex, pass: 1 }));

describe('TimeMapping.build', () => {
  it('lays out one segment per performed measure', () => {
    const score = scoreOf([wholeNoteMeasure(), wholeNoteMeasure()], { tempo: mm120 });
    const map = TimeMapping.build(score, steps(0, 1));

    expect(map.segments).toHaveLength(2);
    expect(map.segments[0].secondsStart).toBeCloseTo(0, 9);
    expect(map.segments[1].secondsStart).toBeCloseTo(2, 9);
    expect(map.durationSeconds).toBeCloseTo(4, 9);
  });

  it('defaults an untempo’d score to Moderato', () => {
    const map = TimeMapping.build(scoreOf([wholeNoteMeasure()]), steps(0));

    // Moderato = 112 on the quarter → whole note = 4 × 60/112 s
    expect(map.durationSeconds).toBeCloseTo((60 / 112) * 4, 9);
  });

  it('accumulates seconds across a repeated section', () => {
    const score = scoreOf([wholeNoteMeasure(), wholeNoteMeasure()], { tempo: mm120 });
    const map = TimeMapping.build(score, steps(0, 1, 0, 1));

    expect(map.durationSeconds).toBeCloseTo(8, 9); // four whole notes at 2s each
  });

  it('carries a mid-piece tempo change forward, later measures inheriting it', () => {
    const score = scoreOf(
      [wholeNoteMeasure(), wholeNoteMeasure({ tempo: mm240 }), wholeNoteMeasure()],
      { tempo: mm120 },
    );
    const map = TimeMapping.build(score, steps(0, 1, 2));

    // 2s (m0 @120) + 1s (m1 @240) + 1s (m2 inherits 240) = 4s
    expect(map.segments[1].secondsStart).toBeCloseTo(2, 9);
    expect(map.segments[2].secondsStart).toBeCloseTo(3, 9);
    expect(map.durationSeconds).toBeCloseTo(4, 9);
  });
});

describe('TimeMapping.secondsAt', () => {
  it('reads positions linearly and agrees at boundaries', () => {
    const score = scoreOf([wholeNoteMeasure(), wholeNoteMeasure()], { tempo: mm120 });
    const map = TimeMapping.build(score, steps(0, 1));

    expect(TimeMapping.secondsAt(map, Fraction.zero())).toBeCloseTo(0, 9);
    expect(TimeMapping.secondsAt(map, Fraction.of(1, 2))).toBeCloseTo(1, 9); // half a whole = 1s
    expect(TimeMapping.secondsAt(map, Fraction.of(1, 1))).toBeCloseTo(2, 9); // measure boundary
    expect(TimeMapping.secondsAt(map, Fraction.of(2, 1))).toBeCloseTo(4, 9); // very end
  });
});

describe('TimeMapping.toNoteEvents', () => {
  it('places beat events onto real time', () => {
    const score = scoreOf([measureOf([Note.of(c4, quarter), Note.of(c4, quarter)])], {
      tempo: mm120,
    });
    const order = NavigationUnfolding.unfold(score);
    const events = TimeMapping.toNoteEvents(
      EventFlattening.flatten(score, order),
      TimeMapping.build(score, order),
    );

    expect(events).toHaveLength(2);
    expect(events[0].startSeconds).toBeCloseTo(0, 9);
    expect(events[0].durationSeconds).toBeCloseTo(0.5, 9);
    expect(events[1].startSeconds).toBeCloseTo(0.5, 9);
    expect(events[1].durationSeconds).toBeCloseTo(0.5, 9);
    expect(events[0].velocity).toBeGreaterThan(0);
  });

  it('spans a tied note across measures at different tempos', () => {
    // m0 whole C (♩=120, 2s) tied into m1 whole C (♩=240, 1s) → one 3s event
    const score = scoreOf(
      [
        measureOf([Note.of(c4, whole, { tie: TieRole.Begin })]),
        measureOf([Note.of(c4, whole, { tie: TieRole.End })], { tempo: mm240 }),
      ],
      { tempo: mm120 },
    );
    const order = steps(0, 1);
    const events = TimeMapping.toNoteEvents(
      EventFlattening.flatten(score, order),
      TimeMapping.build(score, order),
    );

    expect(events).toHaveLength(1);
    expect(events[0].startSeconds).toBeCloseTo(0, 9);
    expect(events[0].durationSeconds).toBeCloseTo(3, 9);
  });
});
