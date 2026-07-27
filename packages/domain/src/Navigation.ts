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
 *
 * ## Capo begins a navigation section
 *
 * A Capo does not only name a da capo's target: it **divides the score**, and
 * everything navigational resolves within the division it falls in. A dal
 * segno finds the Segno in its own section; a repeat with no open of its own
 * returns to its section's head rather than the score's; and an *al Fine*
 * return ends **that section**, with the performance carrying on into the one
 * that follows. The two readings are the same sentence — a da capo returns to
 * the head of its section — but the wider one is what lets four movements
 * share a `Score` without the third movement's Fine ending the piece.
 *
 * This is deliberately **not** tied to `Measure.newSection`, which is
 * presentational and which playback ignores. A score may divide its navigation
 * without printing a heading, and print a heading without dividing its
 * navigation; the two say different things and are stated separately.
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
