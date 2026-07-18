import { NoteValue } from './Duration';
import type { NonEmptyArray } from './NonEmptyArray';
import type { NonEmptyString } from './NonEmptyString';
import type { Pitch } from './Pitch';
import { vocabulary } from './Vocabulary';

const articulationMembers = {
  Staccato: 'Staccato',
  Staccatissimo: 'Staccatissimo',
  Tenuto: 'Tenuto',
  Accent: 'Accent',
  Marcato: 'Marcato',
} as const;

/**
 * Attack and length articulations printed at a note. Articulations combine
 * (staccato + tenuto is portato). Legato is expressed with a slur, and the
 * fermata is modeled separately because it extends duration rather than
 * shaping the attack.
 */
export type Articulation = (typeof articulationMembers)[keyof typeof articulationMembers];

export const Articulation = {
  ...articulationMembers,
  ...vocabulary<Articulation>(articulationMembers),
};

const slurMembers = {
  Begin: 'Begin',
  End: 'End',
  Both: 'Both',
} as const;

/**
 * How a note or chord participates in a phrasing slur: Begin opens an arc,
 * End closes one, and Both does each (ending one phrase as the next starts).
 * Overlapping or nested slurs are not yet distinguishable.
 */
export type SlurRole = (typeof slurMembers)[keyof typeof slurMembers];

export const SlurRole = {
  ...slurMembers,
  ...vocabulary<SlurRole>(slurMembers),
};

const graceStyleMembers = {
  Acciaccatura: 'Acciaccatura',
  Appoggiatura: 'Appoggiatura',
} as const;

/**
 * The two grace-note styles: the acciaccatura (slashed, crushed in before the
 * beat) and the appoggiatura (unslashed, leaning on the principal note's time).
 */
export type GraceStyle = (typeof graceStyleMembers)[keyof typeof graceStyleMembers];

export const GraceStyle = {
  ...graceStyleMembers,
  ...vocabulary<GraceStyle>(graceStyleMembers),
};

/**
 * A small ornamental note preceding its principal note. Grace notes consume
 * no measure time; they attach to the note or chord they decorate.
 */
export type GraceNote = {
  pitch: Pitch;
  style: GraceStyle;
  noteValue: NoteValue;
};

export const GraceNote = {
  of(pitch: Pitch, style: GraceStyle, noteValue: NoteValue = NoteValue.Eighth): GraceNote {
    return { pitch, style, noteValue };
  },
};

const syllabicMembers = {
  Single: 'Single',
  Begin: 'Begin',
  Middle: 'Middle',
  End: 'End',
} as const;

/**
 * How a sung syllable hyphenates with its neighbors: a complete word, or the
 * beginning, middle, or end of one.
 */
export type Syllabic = (typeof syllabicMembers)[keyof typeof syllabicMembers];

export const Syllabic = {
  ...syllabicMembers,
  ...vocabulary<Syllabic>(syllabicMembers),
};

/**
 * One verse's syllable sung at a note. The verse is the syllable's position
 * in the note's lyrics array. An absent syllabic means Single (a whole word).
 */
export type Lyric = {
  text: NonEmptyString;
  syllabic?: Syllabic;
};

export const Lyric = {
  of(text: NonEmptyString, syllabic?: Syllabic): Lyric {
    return syllabic ? { text, syllabic } : { text };
  },
};

/**
 * The optional attachments shared by sounded elements (notes and chords).
 * Ties are not included here: a note carries its own tie, and a chord ties
 * per tone.
 */
export type Notations = {
  articulations?: NonEmptyArray<Articulation>;
  slur?: SlurRole;
  fermata?: boolean;
  graces?: NonEmptyArray<GraceNote>;
  lyrics?: NonEmptyArray<Lyric>;
};
