import { vocabulary } from './Vocabulary';

const markingMembers = {
  Larghissimo: 'Larghissimo',
  Grave: 'Grave',
  Largo: 'Largo',
  Larghetto: 'Larghetto',
  Adagio: 'Adagio',
  Adagietto: 'Adagietto',
  Andante: 'Andante',
  Andantino: 'Andantino',
  Moderato: 'Moderato',
  Allegretto: 'Allegretto',
  Allegro: 'Allegro',
  Vivace: 'Vivace',
  Vivacissimo: 'Vivacissimo',
  Presto: 'Presto',
  Prestissimo: 'Prestissimo',
} as const;

/**
 * The traditional Italian tempo markings, ordered slowest to fastest. Mapping
 * to beats per minute is deliberately left for later.
 */
export type TempoMarking = (typeof markingMembers)[keyof typeof markingMembers];

export const TempoMarking = {
  ...markingMembers,
  ...vocabulary<TempoMarking>(markingMembers),
};

const changeMembers = {
  Accelerando: 'Accelerando',
  Ritardando: 'Ritardando',
  Rallentando: 'Rallentando',
  Ritenuto: 'Ritenuto',
  ATempo: 'ATempo',
} as const;

/**
 * Instructions that alter or restore the prevailing tempo: accelerando (speed
 * up), ritardando/rallentando (slow down gradually), ritenuto (hold back
 * immediately), and a tempo (return to the prevailing tempo).
 */
export type TempoChange = (typeof changeMembers)[keyof typeof changeMembers];

export const TempoChange = {
  ...changeMembers,
  ...vocabulary<TempoChange>(changeMembers),
};

/**
 * Any tempo indication that can appear over a measure: an absolute marking or
 * a change instruction.
 */
export type Tempo = TempoMarking | TempoChange;

export const Tempo = vocabulary<Tempo>({ ...markingMembers, ...changeMembers });
