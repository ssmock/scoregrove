import { describe, expect, it } from 'vitest';
import { ClosingBarline, OpeningBarline } from '@scoregrove/domain/Barline';
import { Clef } from '@scoregrove/domain/Clef';
import { Duration, NoteValue } from '@scoregrove/domain/Duration';
import { Mode } from '@scoregrove/domain/KeySignature';
import { StaffContent, type Measure } from '@scoregrove/domain/Measure';
import { Note } from '@scoregrove/domain/MeasureElement';
import { NavigationJump, NavigationMark } from '@scoregrove/domain/Navigation';
import { NonEmptyArray } from '@scoregrove/domain/NonEmptyArray';
import { Octave, Pitch, PitchClass, PitchLetter } from '@scoregrove/domain/Pitch';
import { PositiveInteger } from '@scoregrove/domain/PositiveInteger';
import { Score } from '@scoregrove/domain/Score';
import { Staff } from '@scoregrove/domain/Staff';
import { BeatUnit } from '@scoregrove/domain/TimeSignature';
import { NavigationUnfolding } from '../src/NavigationUnfolding';

const c4 = Pitch.of(PitchClass.of(PitchLetter.C), Octave.of(4));
const whole = Duration.of(NoteValue.Whole);

/** A measure with one throwaway whole note and whatever navigation fields the test needs */
const measure = (nav: Partial<Measure> = {}): Measure => ({
  contents: NonEmptyArray.of([StaffContent.singleVoice(NonEmptyArray.of([Note.of(c4, whole)]))]),
  ...nav,
});

const scoreOf = (measures: Measure[]): Score =>
  Score.of({
    staves: NonEmptyArray.of([Staff.of(Clef.Treble)]),
    key: { tonic: PitchClass.of(PitchLetter.C), mode: Mode.Major },
    time: { beats: PositiveInteger.of(4), beatUnit: BeatUnit.Quarter },
    measures: NonEmptyArray.of(measures),
  });

const order = (measures: Measure[]): number[] =>
  NavigationUnfolding.unfold(scoreOf(measures)).map((step) => step.measureIndex);

const ending = (...numbers: number[]): NonEmptyArray<PositiveInteger> =>
  NonEmptyArray.of(numbers.map((n) => PositiveInteger.of(n)));

describe('NavigationUnfolding.unfold', () => {
  it('plays a plain score once, in order', () => {
    expect(order([measure(), measure(), measure()])).toEqual([0, 1, 2]);
  });

  it('repeats an open→close section (twice by default)', () => {
    expect(
      order([
        measure({ opening: OpeningBarline.RepeatOpen }),
        measure({ closing: ClosingBarline.RepeatClose }),
        measure(),
      ]),
    ).toEqual([0, 1, 0, 1, 2]);
  });

  it('honors repeatTimes for more than two passes', () => {
    expect(
      order([
        measure({ opening: OpeningBarline.RepeatOpen }),
        measure({ closing: ClosingBarline.RepeatClose, repeatTimes: PositiveInteger.of(3) }),
      ]),
    ).toEqual([0, 1, 0, 1, 0, 1]);
  });

  it('repeats from the start when a close has no matching open', () => {
    expect(order([measure(), measure(), measure({ closing: ClosingBarline.RepeatClose })])).toEqual(
      [0, 1, 2, 0, 1, 2],
    );
  });

  it('reports the pass number of each sounding', () => {
    const steps = NavigationUnfolding.unfold(
      scoreOf([
        measure({ opening: OpeningBarline.RepeatOpen }),
        measure({ closing: ClosingBarline.RepeatClose }),
      ]),
    );

    expect(steps).toEqual([
      { measureIndex: 0, pass: 1 },
      { measureIndex: 1, pass: 1 },
      { measureIndex: 0, pass: 2 },
      { measureIndex: 1, pass: 2 },
    ]);
  });

  it('takes first and second endings on the right passes', () => {
    // |: A | B(1st, close) | C(2nd) :| D
    expect(
      order([
        measure({ opening: OpeningBarline.RepeatOpen }),
        measure({ ending: ending(1), closing: ClosingBarline.RepeatClose }),
        measure({ ending: ending(2) }),
        measure(),
      ]),
    ).toEqual([0, 1, 0, 2, 3]);
  });

  it('unfolds a dal segno al fine over first/second endings (the repeats fixture shape)', () => {
    // Segno |: A | B(1st, close) | C(2nd, Fine) || D(D.S. al Fine)
    expect(
      order([
        measure({
          opening: OpeningBarline.RepeatOpen,
          marks: NonEmptyArray.of([NavigationMark.Segno]),
        }),
        measure({ ending: ending(1), closing: ClosingBarline.RepeatClose }),
        measure({
          ending: ending(2),
          marks: NonEmptyArray.of([NavigationMark.Fine]),
          closing: ClosingBarline.Double,
        }),
        measure({ jump: NavigationJump.DalSegnoAlFine, closing: ClosingBarline.Final }),
      ]),
    ).toEqual([0, 1, 0, 2, 3, 0, 2]);
  });

  it('unfolds a simple da capo al fine', () => {
    // A | B(Fine) | C(D.C. al Fine)  →  A B C  A B(stop at Fine)
    expect(
      order([
        measure(),
        measure({ marks: NonEmptyArray.of([NavigationMark.Fine]) }),
        measure({ jump: NavigationJump.DaCapoAlFine }),
      ]),
    ).toEqual([0, 1, 2, 0, 1]);
  });

  it('unfolds a dal segno al coda via the to-coda departure', () => {
    // A | Segno B | C(To Coda) | D | Coda E | F(D.S. al Coda)
    // first time A..F; then D.S. to Segno, at To-Coda jump to the Coda section
    // and play it to the end: B C → Coda E F
    expect(
      order([
        measure(),
        measure({ marks: NonEmptyArray.of([NavigationMark.Segno]) }),
        measure({ jump: NavigationJump.ToCoda }),
        measure(),
        measure({ marks: NonEmptyArray.of([NavigationMark.Coda]) }),
        measure({ jump: NavigationJump.DalSegnoAlCoda }),
      ]),
    ).toEqual([0, 1, 2, 3, 4, 5, 1, 2, 4, 5]);
  });

  it('does not take inner repeats again after a da capo', () => {
    // |: A | B :| C(D.C.)  →  A B A B C  then D.C.: A B C (repeat suppressed), to end
    expect(
      order([
        measure({ opening: OpeningBarline.RepeatOpen }),
        measure({ closing: ClosingBarline.RepeatClose }),
        measure({ jump: NavigationJump.DaCapo }),
      ]),
    ).toEqual([0, 1, 0, 1, 2, 0, 1, 2]);
  });
});
