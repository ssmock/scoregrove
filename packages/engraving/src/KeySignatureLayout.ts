import { Clef } from '@scoregrove/domain/Clef';
import { KeySignature } from '@scoregrove/domain/KeySignature';
import { Accidental } from '@scoregrove/domain/Pitch';
import type { StaffPosition } from './StaffPosition';

/**
 * The standard staff positions of each printed sharp and flat on the treble
 * staff (F♯ on the top line, B♭ on the middle line, and so on). Every other
 * clef shifts the whole pattern by a fixed amount — down two positions for
 * bass, down one for alto, up one for tenor.
 */
const trebleSharpPositions: readonly StaffPosition[] = [4, 1, 5, 2, -1, 3, 0];
const trebleFlatPositions: readonly StaffPosition[] = [0, 3, -1, 2, -2, 1, -3];

const clefShift: Record<Clef, number> = {
  Treble: 0,
  Bass: -2,
  Alto: -1,
  Tenor: 1,
};

/**
 * Tenor clef's sharp signature is the one place the uniform shift breaks down,
 * and it is a real engraving convention rather than an arbitrary choice.
 * Shifting the treble pattern up one would put the first and third sharps
 * (F♯ and G♯) at +5 and +6 — above the top line — so both drop an octave,
 * giving an ascending run rather than a ledger line. Flats need no such
 * adjustment: shifted up one they span +4…−2 and stay on the staff, so they
 * follow the ordinary rule.
 */
const tenorSharpPositions: readonly StaffPosition[] = [-2, 2, -1, 3, 0, 4, 1];

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

    const sharp = accidentals.accidental === Accidental.Sharp;

    if (sharp && clef === Clef.Tenor) {
      return tenorSharpPositions.slice(0, accidentals.letters.length);
    }

    const pattern = sharp ? trebleSharpPositions : trebleFlatPositions;

    return pattern.slice(0, accidentals.letters.length).map((p) => p + clefShift[clef]);
  },
};
