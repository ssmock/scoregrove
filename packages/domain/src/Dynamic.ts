import { vocabulary } from './Vocabulary';

const markMembers = {
  Pianississimo: 'Pianississimo',
  Pianissimo: 'Pianissimo',
  Piano: 'Piano',
  MezzoPiano: 'MezzoPiano',
  MezzoForte: 'MezzoForte',
  Forte: 'Forte',
  Fortissimo: 'Fortissimo',
  Fortississimo: 'Fortississimo',
  Sforzando: 'Sforzando',
  Fortepiano: 'Fortepiano',
} as const;

/**
 * The traditional dynamic marks, ordered softest to loudest, plus the accent
 * dynamics sforzando (sudden force) and fortepiano (loud then immediately
 * soft). Mapping to loudness values is deliberately left for later.
 */
export type DynamicMark = (typeof markMembers)[keyof typeof markMembers];

const abbreviations: Record<DynamicMark, string> = {
  Pianississimo: 'ppp',
  Pianissimo: 'pp',
  Piano: 'p',
  MezzoPiano: 'mp',
  MezzoForte: 'mf',
  Forte: 'f',
  Fortissimo: 'ff',
  Fortississimo: 'fff',
  Sforzando: 'sfz',
  Fortepiano: 'fp',
};

export const DynamicMark = {
  ...markMembers,
  ...vocabulary<DynamicMark>(markMembers),

  /**
   * The abbreviation printed on the score (e.g. "pp" for Pianissimo)
   */
  abbreviate(mark: DynamicMark): string {
    return abbreviations[mark];
  },
};

const changeMembers = {
  Crescendo: 'Crescendo',
  Diminuendo: 'Diminuendo',
} as const;

/**
 * Gradual loudness transitions. A change begins where it appears in the
 * element sequence and runs until the next dynamic indication.
 */
export type DynamicChange = (typeof changeMembers)[keyof typeof changeMembers];

export const DynamicChange = {
  ...changeMembers,
  ...vocabulary<DynamicChange>(changeMembers),
};

/**
 * Any dynamic indication that can appear in a measure: an absolute mark or a
 * gradual change.
 */
export type Dynamic = DynamicMark | DynamicChange;

export const Dynamic = vocabulary<Dynamic>({ ...markMembers, ...changeMembers });
