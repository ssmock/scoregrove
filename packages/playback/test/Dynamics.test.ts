import { describe, expect, it } from 'vitest';
import { Clef } from '@scoregrove/domain/Clef';
import { DynamicChange, DynamicMark } from '@scoregrove/domain/Dynamic';
import { Duration, NoteValue } from '@scoregrove/domain/Duration';
import { Mode } from '@scoregrove/domain/KeySignature';
import { StaffContent, type Measure } from '@scoregrove/domain/Measure';
import { DynamicElement, Note, type MeasureElement } from '@scoregrove/domain/MeasureElement';
import { NonEmptyArray } from '@scoregrove/domain/NonEmptyArray';
import { Octave, Pitch, PitchClass, PitchLetter } from '@scoregrove/domain/Pitch';
import { PositiveInteger } from '@scoregrove/domain/PositiveInteger';
import { Score } from '@scoregrove/domain/Score';
import { Staff } from '@scoregrove/domain/Staff';
import { BeatUnit } from '@scoregrove/domain/TimeSignature';
import { Dynamics } from '../src/Dynamics';

const note = (letter: PitchLetter, duration: Duration): Note =>
  Note.of(Pitch.of(PitchClass.of(letter), Octave.of(4)), duration);

const quarter = Duration.of(NoteValue.Quarter);
const half = Duration.of(NoteValue.Half);

const scoreOf = (elements: MeasureElement[]): Score => {
  const measure: Measure = {
    contents: NonEmptyArray.of([StaffContent.singleVoice(NonEmptyArray.of(elements))]),
  };

  return Score.of({
    staves: NonEmptyArray.of([Staff.of(Clef.Treble)]),
    key: { tonic: PitchClass.of(PitchLetter.C), mode: Mode.Major },
    time: { beats: PositiveInteger.of(4), beatUnit: BeatUnit.Quarter },
    measures: NonEmptyArray.of([measure]),
  });
};

describe('Dynamics.velocities', () => {
  it('sets the level from a mark and carries it to later notes', () => {
    // p C | f D | E  → C soft, D and E loud
    const v = Dynamics.velocities(
      scoreOf([
        DynamicElement.of(DynamicMark.Piano),
        note(PitchLetter.C, quarter),
        DynamicElement.of(DynamicMark.Forte),
        note(PitchLetter.D, quarter),
        note(PitchLetter.E, half),
      ]),
    );

    expect(v.get('0:0:0:1')).toBeCloseTo(0.34, 6); // C at piano
    expect(v.get('0:0:0:3')).toBeCloseTo(0.7, 6); // D at forte
    expect(v.get('0:0:0:4')).toBeCloseTo(0.7, 6); // E carries forte
  });

  it('defaults an undynamic note to mezzo-forte', () => {
    const v = Dynamics.velocities(scoreOf([note(PitchLetter.C, quarter)]));

    expect(v.get('0:0:0:0')).toBeCloseTo(Dynamics.defaultVelocity, 6);
    expect(Dynamics.defaultVelocity).toBeCloseTo(0.56, 6);
  });

  it('accents only the one note after a sforzando', () => {
    // sfz C | D  → C accented, D back to the default level
    const v = Dynamics.velocities(
      scoreOf([
        DynamicElement.of(DynamicMark.Sforzando),
        note(PitchLetter.C, quarter),
        note(PitchLetter.D, quarter),
        note(PitchLetter.E, half),
      ]),
    );

    expect(v.get('0:0:0:1')).toBeCloseTo(0.9, 6); // accented
    expect(v.get('0:0:0:2')).toBeCloseTo(Dynamics.defaultVelocity, 6); // level unchanged
  });

  it('hits a fortepiano note loud, then drops to piano', () => {
    const v = Dynamics.velocities(
      scoreOf([
        DynamicElement.of(DynamicMark.Fortepiano),
        note(PitchLetter.C, quarter),
        note(PitchLetter.D, quarter),
        note(PitchLetter.E, half),
      ]),
    );

    expect(v.get('0:0:0:1')).toBeCloseTo(0.7, 6); // loud attack
    expect(v.get('0:0:0:2')).toBeCloseTo(0.34, 6); // then piano
  });

  it('steps to the next mark across a crescendo (ramp not yet gradual)', () => {
    // p C < D f E  → C and D at piano (no gradual ramp yet), E at forte
    const v = Dynamics.velocities(
      scoreOf([
        DynamicElement.of(DynamicMark.Piano),
        note(PitchLetter.C, quarter),
        DynamicElement.of(DynamicChange.Crescendo),
        note(PitchLetter.D, quarter),
        DynamicElement.of(DynamicMark.Forte),
        note(PitchLetter.E, half),
      ]),
    );

    expect(v.get('0:0:0:1')).toBeCloseTo(0.34, 6); // C piano
    expect(v.get('0:0:0:3')).toBeCloseTo(0.34, 6); // D still piano (ramp deferred)
    expect(v.get('0:0:0:5')).toBeCloseTo(0.7, 6); // E forte
  });
});
