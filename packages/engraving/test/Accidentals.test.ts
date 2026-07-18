import { describe, expect, it } from 'vitest';
import { Duration, NoteValue } from '@scoregrove/domain/Duration';
import { DynamicMark } from '@scoregrove/domain/Dynamic';
import { Mode, type KeySignature } from '@scoregrove/domain/KeySignature';
import { DynamicElement, Note, Rest } from '@scoregrove/domain/MeasureElement';
import { Accidental, PitchClass, PitchLetter } from '@scoregrove/domain/Pitch';
import { Accidentals } from '../src/Accidentals';
import { pitch } from './helpers';

const gMajor: KeySignature = { tonic: PitchClass.of(PitchLetter.G), mode: Mode.Major };
const quarter = Duration.of(NoteValue.Quarter);

describe('Accidentals.resolve', () => {
  it('prints nothing for notes the key signature already covers', () => {
    const printed = Accidentals.resolve(gMajor, [
      Note.of(pitch(PitchLetter.G, 4), quarter),
      Note.of(pitch(PitchLetter.F, 4), quarter),
    ]);

    expect(printed).toEqual([[undefined], [undefined]]);
  });

  it('prints an accidental where the sounding alteration departs from the key', () => {
    const printed = Accidentals.resolve(gMajor, [
      Note.of(pitch(PitchLetter.C, 5, Accidental.Sharp), quarter),
    ]);

    expect(printed).toEqual([[Accidental.Sharp]]);
  });

  it('carries an accidental for the rest of the measure at that octave', () => {
    const printed = Accidentals.resolve(gMajor, [
      Note.of(pitch(PitchLetter.C, 5, Accidental.Sharp), quarter),
      Note.of(pitch(PitchLetter.C, 5, Accidental.Sharp), quarter),
      Note.of(pitch(PitchLetter.C, 4, Accidental.Sharp), quarter),
    ]);

    expect(printed).toEqual([[Accidental.Sharp], [undefined], [Accidental.Sharp]]);
  });

  it('prints a natural to cancel an earlier accidental', () => {
    const printed = Accidentals.resolve(gMajor, [
      Note.of(pitch(PitchLetter.C, 5, Accidental.Sharp), quarter),
      Note.of(pitch(PitchLetter.C, 5), quarter),
    ]);

    expect(printed).toEqual([[Accidental.Sharp], [Accidental.Natural]]);
  });

  it('prints a natural for an explicit natural against the key', () => {
    const printed = Accidentals.resolve(gMajor, [
      Note.of(pitch(PitchLetter.F, 4, Accidental.Natural), quarter),
      Note.of(pitch(PitchLetter.F, 4), quarter),
    ]);

    expect(printed).toEqual([[Accidental.Natural], [Accidental.Sharp]]);
  });

  it('gives rests and dynamics no accidental slots', () => {
    const printed = Accidentals.resolve(gMajor, [
      Rest.of(quarter),
      DynamicElement.of(DynamicMark.Piano),
    ]);

    expect(printed).toEqual([[], []]);
  });
});
