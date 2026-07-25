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

  it('shifts flats up one for tenor clef, which keeps them on the staff', () => {
    expect(
      KeySignatureLayout.positions(Clef.Tenor, keyOf(PitchLetter.E, Mode.Major, Accidental.Flat)),
    ).toEqual([1, 4, 0]);
  });

  it('drops the first and third sharps an octave in tenor clef', () => {
    // The uniform +1 shift would put F♯ at 5 and G♯ at 6 — above the top
    // line — so both fall an octave and the run ascends instead.
    expect(KeySignatureLayout.positions(Clef.Tenor, keyOf(PitchLetter.G, Mode.Major))).toEqual([
      -2,
    ]);

    // D major: two sharps, the second sitting normally on the C-clef line.
    expect(KeySignatureLayout.positions(Clef.Tenor, keyOf(PitchLetter.D, Mode.Major))).toEqual([
      -2, 2,
    ]);

    // A major brings in the third sharp, the other one that drops.
    expect(KeySignatureLayout.positions(Clef.Tenor, keyOf(PitchLetter.A, Mode.Major))).toEqual([
      -2, 2, -1,
    ]);

    expect(KeySignatureLayout.positions(Clef.Tenor, keyOf(PitchLetter.E, Mode.Major))).toEqual([
      -2, 2, -1, 3,
    ]);
  });

  it('keeps every tenor accidental on the staff', () => {
    const sharps = KeySignatureLayout.positions(
      Clef.Tenor,
      keyOf(PitchLetter.C, Mode.Major, Accidental.Sharp),
    );
    const flats = KeySignatureLayout.positions(
      Clef.Tenor,
      keyOf(PitchLetter.C, Mode.Major, Accidental.Flat),
    );

    expect(sharps).toHaveLength(7);
    expect(flats).toHaveLength(7);

    for (const position of [...sharps, ...flats]) {
      expect(position).toBeGreaterThanOrEqual(-4);
      expect(position).toBeLessThanOrEqual(4);
    }
  });

  it('is empty for the empty signature', () => {
    expect(KeySignatureLayout.positions(Clef.Treble, keyOf(PitchLetter.C, Mode.Major))).toEqual([]);
  });
});
