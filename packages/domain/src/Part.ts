import type { NonEmptyString } from './NonEmptyString';
import { PositiveInteger } from './PositiveInteger';
import { vocabulary } from './Vocabulary';

/**
 * A performer's part: who plays, rather than what surface the notes are
 * written on.
 *
 * A part and a staff are **not** the same thing, and the mapping is not one to
 * one in either direction — a piano is one part on two staves, a quartet is
 * four parts on four staves, and a divisi passage is one part temporarily
 * needing two. Collapsing them would work for a quartet and break at the first
 * keyboard score.
 *
 * `staves` is how many of the score's staves this part occupies, counted in
 * score order: parts partition `Score.staves` between them, in sequence. That
 * keeps `staves` the flat, ordered list `Measure.contents` indexes against —
 * the invariant everything downstream rests on — with parts as a layer over it
 * rather than a replacement for it.
 */
export type Part = {
  name?: NonEmptyString;
  /** The short form printed on systems after the first ("Vln. I") */
  abbreviation?: NonEmptyString;
  /**
   * The instrument this part sounds, as a MusicXML instrument-sound identifier
   * (e.g. "strings.violin"). Playback's hook for choosing a timbre; the domain
   * itself attaches no meaning to the string.
   */
  sound?: NonEmptyString;
  /** How many staves this part occupies (default 1) */
  staves?: PositiveInteger;
};

export const Part = {
  of(
    extras: {
      name?: NonEmptyString;
      abbreviation?: NonEmptyString;
      sound?: NonEmptyString;
      staves?: PositiveInteger;
    } = {},
  ): Part {
    return { ...extras };
  },

  /** How many staves a part occupies; absent means one */
  staffCount(part: Part): number {
    return part.staves ?? 1;
  },
};

const symbolMembers = {
  Bracket: 'Bracket',
  Brace: 'Brace',
  Line: 'Line',
} as const;

/**
 * The sign drawn down the left edge of a group of staves: the bracket of an
 * instrumental family, the brace of a keyboard, or a plain line.
 */
export type StaffGroupSymbol = (typeof symbolMembers)[keyof typeof symbolMembers];

export const StaffGroupSymbol = {
  ...symbolMembers,
  ...vocabulary<StaffGroupSymbol>(symbolMembers),
};

/**
 * A run of staves joined by a sign at the left edge, and optionally by
 * barlines running through them.
 *
 * A range of staff indices rather than a tree, because groups nest by
 * containment: an enclosing group simply spans a wider range. `Score.check`
 * validates that a range is in bounds and correctly ordered, which is the only
 * way a range can be wrong.
 */
export type StaffGroup = {
  symbol: StaffGroupSymbol;
  /** First staff index in the group */
  from: number;
  /** Last staff index in the group, inclusive */
  to: number;
  /** Whether barlines are drawn through the group rather than per staff */
  barlines?: boolean;
};

export const StaffGroup = {
  of(symbol: StaffGroupSymbol, from: number, to: number, barlines = false): StaffGroup {
    return { symbol, from, to, ...(barlines ? { barlines } : {}) };
  },
};
