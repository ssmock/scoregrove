import { vocabulary } from './Vocabulary';

const members = {
  Treble: 'Treble',
  Bass: 'Bass',
  Alto: 'Alto',
  Tenor: 'Tenor',
} as const;

/**
 * The clef assigned to a staff: treble (G clef), bass (F clef), or one of the
 * two C clefs — alto (C on the middle line) and tenor (C on the fourth line).
 * Tenor is the cello, bassoon, and trombone's upper-register clef.
 */
export type Clef = (typeof members)[keyof typeof members];

export const Clef = {
  ...members,
  ...vocabulary<Clef>(members),
};
