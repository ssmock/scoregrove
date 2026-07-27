import { describe, expect, it } from 'vitest';
import { Clef } from '@scoregrove/domain/Clef';
import { Duration, NoteValue } from '@scoregrove/domain/Duration';
import { DynamicMark } from '@scoregrove/domain/Dynamic';
import { Mode } from '@scoregrove/domain/KeySignature';
import { StaffContent, type Measure } from '@scoregrove/domain/Measure';
import { DynamicElement, Note, type MeasureElement } from '@scoregrove/domain/MeasureElement';
import { NonEmptyArray } from '@scoregrove/domain/NonEmptyArray';
import { Accidental, PitchClass, PitchLetter } from '@scoregrove/domain/Pitch';
import { PositiveInteger } from '@scoregrove/domain/PositiveInteger';
import { Score } from '@scoregrove/domain/Score';
import { Staff } from '@scoregrove/domain/Staff';
import { BeatUnit } from '@scoregrove/domain/TimeSignature';
import { MeasureLayout } from '../src/MeasureLayout';
import { SystemLayout } from '../src/SystemLayout';
import { pitch } from './helpers';

const quarter = Duration.of(NoteValue.Quarter);

const scoreOf = (measures: MeasureElement[][]): Score =>
  Score.of({
    staves: NonEmptyArray.of([Staff.of(Clef.Treble)]),
    key: { tonic: PitchClass.of(PitchLetter.C), mode: Mode.Major },
    time: { beats: PositiveInteger.of(4), beatUnit: BeatUnit.Quarter },
    measures: NonEmptyArray.of(
      measures.map((elements): Measure => ({
        contents: NonEmptyArray.of([StaffContent.singleVoice(NonEmptyArray.of(elements))]),
      })),
    ),
  });

/** Every dynamic's baseline in the laid-out system */
const dynamicYs = (score: Score): number[] =>
  SystemLayout.unbroken(score).measures.flatMap((entry) =>
    entry.staves.flatMap((measure) =>
      measure.elements.flatMap((element) => (element.kind === 'dynamic' ? [element.y] : [])),
    ),
  );

const highNotes = (dynamic = false): MeasureElement[] => [
  ...(dynamic ? [DynamicElement.of(DynamicMark.Piano)] : []),
  Note.of(pitch(PitchLetter.C, 5), quarter),
  Note.of(pitch(PitchLetter.D, 5), quarter),
  Note.of(pitch(PitchLetter.E, 5), quarter),
  Note.of(pitch(PitchLetter.F, 5), quarter),
];

describe('DynamicPlacement', () => {
  it('leaves a dynamic at the default depth when nothing hangs below the staff', () => {
    expect(dynamicYs(scoreOf([highNotes(true)]))).toEqual([MeasureLayout.dynamicY]);
  });

  it('pushes a dynamic below notes that hang under the staff', () => {
    // Two ledger lines below the treble staff
    const low = scoreOf([
      [
        DynamicElement.of(DynamicMark.Piano),
        Note.of(pitch(PitchLetter.A, 3), quarter),
        Note.of(pitch(PitchLetter.B, 3), quarter),
        Note.of(pitch(PitchLetter.C, 4), quarter),
        Note.of(pitch(PitchLetter.D, 4), quarter),
      ],
    ]);

    expect(dynamicYs(low)[0]).toBeGreaterThan(MeasureLayout.dynamicY);
  });

  it('puts every dynamic of a staff on one line, not each at its own depth', () => {
    // The second measure hangs low; the first does not. Both marks still line
    // up, because a staggered row reads worse than the collision it fixes.
    const mixed = scoreOf([
      highNotes(true),
      [
        DynamicElement.of(DynamicMark.Forte),
        Note.of(pitch(PitchLetter.A, 3), quarter),
        Note.of(pitch(PitchLetter.B, 3), quarter),
        Note.of(pitch(PitchLetter.C, 4), quarter),
        Note.of(pitch(PitchLetter.D, 4), quarter),
      ],
    ]);

    const ys = dynamicYs(mixed);

    expect(ys).toHaveLength(2);
    expect(ys[0]).toBe(ys[1]);
    expect(ys[0]).toBeGreaterThan(MeasureLayout.dynamicY);
  });

  it('counts an accidental hanging below its notehead', () => {
    // The four collisions left after the first pass were all of this shape:
    // the head cleared the mark and the flat below it did not.
    const withFlat = (accidental?: Accidental) =>
      scoreOf([
        [
          DynamicElement.of(DynamicMark.Piano),
          Note.of(pitch(PitchLetter.B, 3, accidental), quarter),
          Note.of(pitch(PitchLetter.C, 5), quarter),
          Note.of(pitch(PitchLetter.D, 5), quarter),
          Note.of(pitch(PitchLetter.E, 5), quarter),
        ],
      ]);

    expect(dynamicYs(withFlat(Accidental.Flat))[0]).toBeGreaterThan(dynamicYs(withFlat())[0]);
  });
});
