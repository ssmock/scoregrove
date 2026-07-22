import { describe, expect, it } from 'vitest';
import { Clef } from '@scoregrove/domain/Clef';
import { Mode, type KeySignature } from '@scoregrove/domain/KeySignature';
import { Accidental, PitchClass, PitchLetter } from '@scoregrove/domain/Pitch';
import { KeySignatureLayout } from '../src/KeySignatureLayout';

const keyOf = (letter: PitchLetter, mode: Mode, accidental?: Accidental): KeySignature => ({
  tonic: PitchClass.of(letter, accidental),
  mode,
});

// Which letters a key alters (KeySignature.accidentals) is key theory, tested
// in the domain's KeySignature suite; positions below are the layout part.

describe('KeySignatureLayout.positions', () => {
  it('places sharps in the standard treble pattern', () => {
    expect(KeySignatureLayout.positions(Clef.Treble, keyOf(PitchLetter.D, Mode.Major))).toEqual([
      4, 1,
    ]);
  });

  it('places flats in the standard treble pattern', () => {
    expect(
      KeySignatureLayout.positions(Clef.Treble, keyOf(PitchLetter.E, Mode.Major, Accidental.Flat)),
    ).toEqual([0, 3, -1]);
  });

  it('shifts the whole pattern down for bass and alto clefs', () => {
    expect(KeySignatureLayout.positions(Clef.Bass, keyOf(PitchLetter.D, Mode.Major))).toEqual([
      2, -1,
    ]);

    expect(KeySignatureLayout.positions(Clef.Alto, keyOf(PitchLetter.D, Mode.Major))).toEqual([
      3, 0,
    ]);
  });

  it('is empty for the empty signature', () => {
    expect(KeySignatureLayout.positions(Clef.Treble, keyOf(PitchLetter.C, Mode.Major))).toEqual([]);
  });
});
