import { Clef } from '@scoregrove/domain/Clef';
import { KeySignature } from '@scoregrove/domain/KeySignature';
import { Accidental } from '@scoregrove/domain/Pitch';
import type { StaffPosition } from './StaffPosition';

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

export const KeySignatureLayout = {
  /**
   * The staff positions of the printed accidentals, left to right, following
   * the standard pattern for the clef. Empty for the empty signature. Which
   * letters are altered (and with which symbol) is key theory, resolved by
   * `KeySignature.accidentals`; this only decides where they sit.
   */
  positions(clef: Clef, key: KeySignature): StaffPosition[] {
    const accidentals = KeySignature.accidentals(key);

    if (!accidentals) return [];

    const pattern =
      accidentals.accidental === Accidental.Sharp ? trebleSharpPositions : trebleFlatPositions;

    return pattern.slice(0, accidentals.letters.length).map((p) => p + clefShift[clef]);
  },
};
