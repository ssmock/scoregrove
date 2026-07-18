import { Clef } from '@scoregrove/domain/Clef';
import { KeySignature } from '@scoregrove/domain/KeySignature';
import { Accidental, PitchClass, type PitchLetter } from '@scoregrove/domain/Pitch';
import type { StaffPosition } from './StaffPosition';

/**
 * The order in which sharps and flats accumulate in a key signature.
 */
const sharpOrder: readonly PitchLetter[] = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
const flatOrder: readonly PitchLetter[] = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];

/**
 * The standard staff positions of each printed sharp and flat on the treble
 * staff (F♯ on the top line, B♭ on the middle line, and so on). Bass and alto
 * shift the whole pattern down two positions and one position respectively.
 */
const trebleSharpPositions: readonly StaffPosition[] = [4, 1, 5, 2, -1, 3, 0];
const trebleFlatPositions: readonly StaffPosition[] = [0, 3, -1, 2, -2, 1, -3];

const clefShift: Record<Clef, number> = {
  Treble: 0,
  Bass: -2,
  Alto: -1,
};

/**
 * The accidentals a key signature carries: which symbol, and which letters it
 * alters, in printed order.
 */
export type KeyAccidentals = {
  accidental: Accidental;
  letters: readonly PitchLetter[];
};

export const KeySignatureLayout = {
  /**
   * Which letters the key signature alters and with which symbol; undefined
   * for the empty signature (C major / A minor). Derived from the tonic's
   * place in the domain's circle-of-fifths ordering: index 0 is empty, 1–7
   * are sharp counts, 8–14 are flat counts.
   */
  accidentals(key: KeySignature): KeyAccidentals | undefined {
    const index = KeySignature.standardTonics(key.mode).findIndex((tonic) =>
      PitchClass.equals(tonic, key.tonic),
    );

    if (index <= 0) return undefined;

    if (index <= 7) {
      return { accidental: Accidental.Sharp, letters: sharpOrder.slice(0, index) };
    }

    return { accidental: Accidental.Flat, letters: flatOrder.slice(0, index - 7) };
  },

  /**
   * The staff positions of the printed accidentals, left to right, following
   * the standard pattern for the clef. Empty for the empty signature.
   */
  positions(clef: Clef, key: KeySignature): StaffPosition[] {
    const accidentals = KeySignatureLayout.accidentals(key);

    if (!accidentals) return [];

    const pattern =
      accidentals.accidental === Accidental.Sharp ? trebleSharpPositions : trebleFlatPositions;

    return pattern.slice(0, accidentals.letters.length).map((p) => p + clefShift[clef]);
  },
};
