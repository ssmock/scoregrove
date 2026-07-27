import { describe, expect, it } from 'vitest';
import { Clef } from '@scoregrove/domain/Clef';
import { Duration, NoteValue } from '@scoregrove/domain/Duration';
import { DynamicMark } from '@scoregrove/domain/Dynamic';
import { Mode } from '@scoregrove/domain/KeySignature';
import { StaffContent, type Measure } from '@scoregrove/domain/Measure';
import { DynamicElement, Note, type MeasureElement } from '@scoregrove/domain/MeasureElement';
import { NonEmptyArray } from '@scoregrove/domain/NonEmptyArray';
import { PitchClass, PitchLetter } from '@scoregrove/domain/Pitch';
import { PositiveInteger } from '@scoregrove/domain/PositiveInteger';
import { Score } from '@scoregrove/domain/Score';
import { Staff } from '@scoregrove/domain/Staff';
import { BeatUnit } from '@scoregrove/domain/TimeSignature';
import { Invariants } from '../src/Invariants';
import { ScoreLayout } from '../src/ScoreLayout';
import { StaffPosition } from '../src/StaffPosition';
import { SystemLayout } from '../src/SystemLayout';
import { pitch } from './helpers';

/**
 * An invariant that cannot fail is worth nothing, so each of these breaks a
 * layout in the one way that invariant is aimed at.
 */

const scoreOf = (elements: MeasureElement[]): Score =>
  Score.of({
    staves: NonEmptyArray.of([Staff.of(Clef.Treble)]),
    key: { tonic: PitchClass.of(PitchLetter.C), mode: Mode.Major },
    time: { beats: PositiveInteger.of(4), beatUnit: BeatUnit.Quarter },
    measures: NonEmptyArray.of([
      { contents: NonEmptyArray.of([StaffContent.singleVoice(NonEmptyArray.of(elements))]) },
    ] as Measure[]),
  });

const quarter = Duration.of(NoteValue.Quarter);

const plainScore = () =>
  scoreOf([
    Note.of(pitch(PitchLetter.C, 5), quarter),
    Note.of(pitch(PitchLetter.D, 5), quarter),
    Note.of(pitch(PitchLetter.E, 5), quarter),
    Note.of(pitch(PitchLetter.F, 5), quarter),
  ]);

describe('Invariants', () => {
  it('passes a layout with nothing wrong with it', () => {
    const laid = ScoreLayout.layout(plainScore(), { width: 80 });

    expect(Invariants.all(laid.systems, 80)).toEqual([]);
  });

  it('catches a system wider than the page', () => {
    const system = SystemLayout.unbroken(plainScore());
    const violations = Invariants.systemsFitWidth([{ ...system, width: 200 }], 80);

    expect(violations).toHaveLength(1);
    expect(violations[0].detail).toContain('200');
  });

  it('catches an element drawn outside its measure', () => {
    const system = SystemLayout.unbroken(plainScore());
    const [entry] = system.measures;
    const [measure] = entry.staves;
    const escaped = {
      ...system,
      measures: [
        {
          ...entry,
          staves: [
            {
              ...measure,
              elements: measure.elements.map((element, index) =>
                index === 0 ? { ...element, x: measure.width + 5 } : element,
              ),
            },
          ],
        },
      ],
    };

    const violations = Invariants.elementsWithinMeasures([escaped]);

    expect(violations).toHaveLength(1);
    expect(violations[0].invariant).toBe('no element escapes its measure');
  });

  it('catches a dynamic sitting on a notehead', () => {
    // The dynamic is dragged up onto the staff, where the notes are
    const system = SystemLayout.unbroken(
      scoreOf([
        DynamicElement.of(DynamicMark.Forte),
        Note.of(pitch(PitchLetter.C, 5), quarter),
        Note.of(pitch(PitchLetter.D, 5), quarter),
        Note.of(pitch(PitchLetter.E, 5), quarter),
        Note.of(pitch(PitchLetter.F, 5), quarter),
      ]),
    );

    const [entry] = system.measures;
    const [measure] = entry.staves;
    const note = measure.elements.find((element) => element.kind === 'note')!;
    const collided = {
      ...system,
      measures: [
        {
          ...entry,
          staves: [
            {
              ...measure,
              elements: measure.elements.map((element) =>
                element.kind === 'dynamic'
                  ? { ...element, x: note.x, y: StaffPosition.y(note.position) }
                  : element,
              ),
            },
          ],
        },
      ],
    };

    const violations = Invariants.dynamicsClearOfNotes([collided]);

    expect(violations).toHaveLength(1);
    expect(violations[0].detail).toContain('overlaps');
  });

  it('reads two voices as two beams rather than one contradictory one', () => {
    // The check that made this necessary: two voices on one staff overlap in x
    // and their stems point opposite ways, which is correct. Grouping by
    // position alone reported it as a broken beam.
    const score = Score.of({
      staves: NonEmptyArray.of([Staff.of(Clef.Treble)]),
      key: { tonic: PitchClass.of(PitchLetter.C), mode: Mode.Major },
      time: { beats: PositiveInteger.of(4), beatUnit: BeatUnit.Quarter },
      measures: NonEmptyArray.of([
        {
          contents: NonEmptyArray.of([
            StaffContent.of(
              NonEmptyArray.of([
                {
                  elements: NonEmptyArray.of([
                    Note.of(pitch(PitchLetter.G, 5), Duration.of(NoteValue.Eighth)),
                    Note.of(pitch(PitchLetter.A, 5), Duration.of(NoteValue.Eighth)),
                    Note.of(pitch(PitchLetter.G, 5), Duration.of(NoteValue.Half)),
                    Note.of(pitch(PitchLetter.G, 5), quarter),
                  ]),
                },
                {
                  elements: NonEmptyArray.of([
                    Note.of(pitch(PitchLetter.C, 4), Duration.of(NoteValue.Eighth)),
                    Note.of(pitch(PitchLetter.D, 4), Duration.of(NoteValue.Eighth)),
                    Note.of(pitch(PitchLetter.C, 4), Duration.of(NoteValue.Half)),
                    Note.of(pitch(PitchLetter.C, 4), quarter),
                  ]),
                },
              ]),
            ),
          ]),
        },
      ] as Measure[]),
    });

    const laid = ScoreLayout.layout(score, { width: 80 });

    expect(Invariants.beamGroupsAgreeOnDirection(laid.systems)).toEqual([]);
  });
});
