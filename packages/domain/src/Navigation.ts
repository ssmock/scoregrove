import { vocabulary } from './Vocabulary';

const markMembers = {
  Segno: 'Segno',
  Coda: 'Coda',
  Fine: 'Fine',
  Capo: 'Capo',
} as const;

/**
 * A navigation landmark placed at a measure: the segno sign (𝄋), the coda
 * sign (𝄌) marking where the coda section begins, Fine marking where the
 * piece ends on its final pass, or Capo marking where a da capo returns to.
 *
 * Capo is the odd one out in two ways. It is **never printed** — the other
 * three are a sign, a sign, and a word, while "da capo" names its own target
 * implicitly, so `Glyphs.forNavigationMark` gives it no glyph and engraving
 * skips it. And it is **optional**: a da capo with no Capo before it returns
 * to the first measure, which is what "the head" means for an ordinary
 * single-section piece. Placing one is only necessary when the score's start
 * and the jump's target differ — a movement after the first, or a piece with
 * a long introduction the da capo should skip.
 */
export type NavigationMark = (typeof markMembers)[keyof typeof markMembers];

export const NavigationMark = {
  ...markMembers,
  ...vocabulary<NavigationMark>(markMembers),
};

const jumpMembers = {
  DaCapo: 'DaCapo',
  DaCapoAlFine: 'DaCapoAlFine',
  DaCapoAlCoda: 'DaCapoAlCoda',
  DalSegno: 'DalSegno',
  DalSegnoAlFine: 'DalSegnoAlFine',
  DalSegnoAlCoda: 'DalSegnoAlCoda',
  ToCoda: 'ToCoda',
} as const;

/**
 * A navigation instruction taking effect at the end of the measure that
 * carries it. Da capo returns to the beginning; dal segno returns to the
 * segno; the al Fine / al Coda variants declare how that restarted passage
 * ends. ToCoda marks the departure point that jumps ahead to the coda (taken
 * only after a da capo / dal segno return).
 */
export type NavigationJump = (typeof jumpMembers)[keyof typeof jumpMembers];

export const NavigationJump = {
  ...jumpMembers,
  ...vocabulary<NavigationJump>(jumpMembers),
};
