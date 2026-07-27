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
    // Carrying no Capo mark, this also pins the fallback: a da capo with
    // nothing to return to returns to measure 0, as it always did.
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

  it('returns a da capo to the nearest preceding Capo, not measure 0', () => {
    // The Menuetto/Trio shape that motivated the mark: an earlier section
    // (0, 1) precedes the one the D.C. belongs to. Without a Capo the jump
    // would rewind to 0 and replay the earlier section entirely.
    // A | B | Capo C(Fine) | D | E(D.C. al Fine)  →  A B C D E  C(stop at Fine)
    expect(
      order([
        measure(),
        measure(),
        measure({ marks: NonEmptyArray.of([NavigationMark.Capo, NavigationMark.Fine]) }),
        measure(),
        measure({ jump: NavigationJump.DaCapoAlFine }),
      ]),
    ).toEqual([0, 1, 2, 3, 4, 2]);
  });

  it('picks the nearest preceding Capo when several sections carry one', () => {
    // Capo A | B | Capo C | D(D.C.) → the second Capo governs, not the first.
    expect(
      order([
        measure({ marks: NonEmptyArray.of([NavigationMark.Capo]) }),
        measure(),
        measure({ marks: NonEmptyArray.of([NavigationMark.Capo]) }),
        measure({ jump: NavigationJump.DaCapo }),
      ]),
    ).toEqual([0, 1, 2, 3, 2, 3]);
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

describe('NavigationUnfolding.unfold, sections', () => {
  it('ends an al Fine at its own section and plays on into the next', () => {
    // The Haydn shape in miniature: a section with a Fine and a da capo, then
    // another section after it. The al Fine used to stop the whole piece.
    const played = order([
      measure({ marks: NonEmptyArray.of([NavigationMark.Capo]) }), // 0
      measure({ marks: NonEmptyArray.of([NavigationMark.Fine]) }), // 1
      measure({ jump: NavigationJump.DaCapoAlFine }), // 2
      measure({ marks: NonEmptyArray.of([NavigationMark.Capo]) }), // 3 — next section
      measure(), // 4
    ]);

    expect(played).toEqual([0, 1, 2, 0, 1, 3, 4]);
  });

  it('sends a da capo to its own section head, not the score start', () => {
    const played = order([
      measure(), // 0 — a first section that must not be returned to
      measure({ marks: NonEmptyArray.of([NavigationMark.Capo]) }), // 1
      measure({ marks: NonEmptyArray.of([NavigationMark.Fine]) }), // 2
      measure({ jump: NavigationJump.DaCapoAlFine }), // 3
    ]);

    expect(played).toEqual([0, 1, 2, 3, 1, 2]);
  });

  it('finds the Segno in its own section', () => {
    const played = order([
      measure({ marks: NonEmptyArray.of([NavigationMark.Segno]) }), // 0 — a decoy
      measure({ marks: NonEmptyArray.of([NavigationMark.Capo, NavigationMark.Segno]) }), // 1
      measure(), // 2
      measure({ jump: NavigationJump.DalSegno }), // 3
    ]);

    expect(played).toEqual([0, 1, 2, 3, 1, 2, 3]);
  });

  it('repeats from its section head when a close has no open', () => {
    // The finale's shape: a repeat with no RepeatOpen of its own. Falling back
    // to measure 0 sent it into the previous section entirely.
    const played = order([
      measure(), // 0
      measure({ marks: NonEmptyArray.of([NavigationMark.Capo]) }), // 1
      measure({ closing: ClosingBarline.RepeatClose }), // 2
    ]);

    expect(played).toEqual([0, 1, 2, 1, 2]);
  });

  it('keeps each section’s repeat passes to itself', () => {
    // Measure 412 of the corpus was skipped entirely because its volta chain
    // shared a pass counter with a repeat 400 measures earlier: the count was
    // already 2, so the first ending never played.
    const played = order([
      measure({ closing: ClosingBarline.RepeatClose }), // 0 — section 1's repeat
      measure({ marks: NonEmptyArray.of([NavigationMark.Capo]) }), // 1
      measure({ ending: ending(1), closing: ClosingBarline.RepeatClose }), // 2
      measure({ ending: ending(2) }), // 3
    ]);

    expect(played).toEqual([0, 0, 1, 2, 1, 3]);
  });

  it('leaves a score with no Capo exactly as it was', () => {
    const played = order([
      measure({ marks: NonEmptyArray.of([NavigationMark.Fine]) }),
      measure({ jump: NavigationJump.DaCapoAlFine }),
    ]);

    expect(played).toEqual([0, 1, 0]);
  });
});
