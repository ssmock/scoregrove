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
  /**
   * Whether a slur joins this grace to the note it decorates — the near-
   * universal marking for one.
   *
   * A flag rather than a `SlurRole` because a grace slur has only one possible
   * shape: it runs from the grace to its principal, so both endpoints are
   * implied and there is nothing to number or pair. Giving it a role would put
   * a second slur on the principal, which carries only one, and would need
   * numbering to tell it from the phrase slur it usually sits inside.
   */
  slurred?: boolean;
};

export const GraceNote = {
  of(
    pitch: Pitch,
    style: GraceStyle,
    noteValue: NoteValue = NoteValue.Eighth,
    slurred = false,
  ): GraceNote {
    return { pitch, style, noteValue, ...(slurred ? { slurred } : {}) };
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

const ornamentMembers = {
  Trill: 'Trill',
  Turn: 'Turn',
} as const;

/**
 * A melodic ornament printed above a note: the trill (a rapid alternation with
 * the note above) and the turn (a figure around the note).
 *
 * Modeled here rather than derived, because nothing in a sequence of pitches
 * implies an ornament — and the two pipelines read one differently: engraving
 * prints a sign, playback realizes the figure it stands for. That is the same
 * reason the fermata is modeled apart from `Articulation`, which shapes an
 * attack rather than standing for notes that are not written.
 *
 * Deliberately narrow. Mordents and the inverted turn are equally standard, but
 * this vocabulary follows what real music has actually asked of us so far;
 * adding one is a member plus a SMuFL glyph, and the glyphs exist
 * (`ornamentMordent`, `ornamentTurnInverted`).
 *
 * Arpeggios and tremolos are **not** ornaments here even though they are often
 * filed alongside: an arpeggio is a property of a chord's attack, and a tremolo
 * carries duration semantics and can span two notes. Flattening either into
 * this list would repeat the mistake of folding the fermata into
 * `Articulation`.
 */
export type Ornament = (typeof ornamentMembers)[keyof typeof ornamentMembers];

export const Ornament = {
  ...ornamentMembers,
  ...vocabulary<Ornament>(ornamentMembers),
};

/**
 * The optional attachments shared by sounded elements (notes and chords).
 * Ties are not included here: a note carries its own tie, and a chord ties
 * per tone.
 */
export type Notations = {
  articulations?: NonEmptyArray<Articulation>;
  ornaments?: NonEmptyArray<Ornament>;
  slur?: SlurRole;
  fermata?: boolean;
  graces?: NonEmptyArray<GraceNote>;
  lyrics?: NonEmptyArray<Lyric>;
};
