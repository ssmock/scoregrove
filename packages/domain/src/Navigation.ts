import { vocabulary } from './Vocabulary';

const markMembers = {
  Segno: 'Segno',
  Coda: 'Coda',
  Fine: 'Fine',
} as const;

/**
 * A navigation landmark placed at a measure: the segno sign (𝄋), the coda
 * sign (𝄌) marking where the coda section begins, or Fine marking where the
 * piece ends on its final pass.
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
