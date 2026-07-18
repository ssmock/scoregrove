import { vocabulary } from './Vocabulary';

const members = {
  Treble: 'Treble',
  Bass: 'Bass',
  Alto: 'Alto',
} as const;

/**
 * The clef assigned to a staff: treble (G clef), bass (F clef), or alto (C clef).
 */
export type Clef = (typeof members)[keyof typeof members];

export const Clef = {
  ...members,
  ...vocabulary<Clef>(members),
};
