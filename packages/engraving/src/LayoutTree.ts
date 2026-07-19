import type { ClosingBarline, OpeningBarline } from '@scoregrove/domain/Barline';
import type { GlyphName } from './Bravura';
import type { StaffPosition } from './StaffPosition';
import type { StemDirection } from './Stems';

/**
 * The layout tree: fully-positioned plain JSON that rendering components draw
 * without making any layout decisions of their own. All coordinates are staff
 * spaces; within a measure, x runs from the measure's left edge and y from
 * the staff's top line, increasing downward (the SVG convention).
 */

/**
 * The path from a layout node back into the score. Emitted as data-*
 * attributes by the components — the future editing and hit-testing hook.
 */
export type ScoreAddress = {
  measure: number;
  staff: number;
  voice: number;
  element: number;
};

/**
 * One glyph placed at a point, e.g. a clef, an accidental, or a flag.
 */
export type LaidOutGlyph = {
  glyph: GlyphName;
  x: number;
  y: number;
};

/**
 * A stem drawn from `top` to `bottom` at x (the line's center).
 */
export type LaidOutStem = {
  x: number;
  top: number;
  bottom: number;
  direction: StemDirection;
};

/**
 * One miniature grace note before its principal: everything pre-scaled and
 * absolutely positioned, `scale` applied by the renderer to the glyphs. The
 * slash marks an acciaccatura.
 */
export type LaidOutGrace = {
  /** The left edge of the miniature notehead */
  x: number;
  position: StaffPosition;
  notehead: GlyphName;
  scale: number;
  stem: LaidOutStem;
  flag?: LaidOutGlyph;
  slash?: { x1: number; y1: number; x2: number; y2: number };
  ledgers: readonly StaffPosition[];
};

export type LaidOutNote = {
  kind: 'note';
  address: ScoreAddress;
  /** The left edge of the notehead */
  x: number;
  position: StaffPosition;
  notehead: GlyphName;
  accidental?: LaidOutGlyph;
  dots?: readonly LaidOutGlyph[];
  stem?: LaidOutStem;
  flag?: LaidOutGlyph;
  /** Attack marks stacked on the side opposite the stem */
  articulations?: readonly LaidOutGlyph[];
  fermata?: LaidOutGlyph;
  graces?: readonly LaidOutGrace[];
  ledgers: readonly StaffPosition[];
};

export type LaidOutRest = {
  kind: 'rest';
  address: ScoreAddress;
  x: number;
  glyph: GlyphName;
  y: number;
  dots?: readonly LaidOutGlyph[];
  fermata?: LaidOutGlyph;
};

/**
 * A dynamic indication placed below the staff at the element it takes effect
 * on.
 */
export type LaidOutDynamic = {
  kind: 'dynamic';
  address: ScoreAddress;
  glyph: GlyphName;
  x: number;
  y: number;
};

/**
 * One tone of a laid-out chord. Tones of a second sit on the opposite side
 * of the stem from the cluster's normal side, so each tone carries its own
 * notehead x. `tone` is the tone's index in the domain chord — laid tones
 * are sorted by staff position, so the original order must ride along (per-
 * tone ties depend on it).
 */
export type LaidOutChordTone = {
  tone: number;
  position: StaffPosition;
  x: number;
  accidental?: LaidOutGlyph;
  dots?: readonly LaidOutGlyph[];
};

export type LaidOutChord = {
  kind: 'chord';
  address: ScoreAddress;
  /** The normal-side notehead x (the chord's alignment column) */
  x: number;
  /** The notehead glyph every tone shares (one written duration) */
  notehead: GlyphName;
  tones: readonly LaidOutChordTone[];
  stem?: LaidOutStem;
  flag?: LaidOutGlyph;
  /** Attack marks stacked beyond the extreme tone opposite the stem */
  articulations?: readonly LaidOutGlyph[];
  fermata?: LaidOutGlyph;
  graces?: readonly LaidOutGrace[];
  ledgers: readonly StaffPosition[];
};

export type LaidOutElement = LaidOutNote | LaidOutRest | LaidOutChord | LaidOutDynamic;

/**
 * One beam quad: the line of its outer edge (the edge away from the
 * noteheads) and the thickness to extend toward them, which side depending
 * on the group's stem direction. Level 1 is the primary beam; higher levels
 * stack toward the noteheads.
 */
export type LaidOutBeam = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  thickness: number;
  direction: StemDirection;
  level: number;
};

/**
 * A textual score annotation (tempo words, navigation instructions, repeat
 * counts). `size` is the em height in staff spaces; `anchor` follows the
 * SVG text-anchor values.
 */
export type LaidOutText = {
  text: string;
  x: number;
  y: number;
  size: number;
  anchor: 'start' | 'middle' | 'end';
  italic?: boolean;
  bold?: boolean;
};

/**
 * Score furniture printed around a measure — tempo and swing words,
 * segno/coda signs, Fine and jump instructions, repeat counts — as either a
 * glyph or a run of text.
 */
export type LaidOutAnnotation =
  ({ kind: 'glyph' } & LaidOutGlyph) | ({ kind: 'text' } & LaidOutText);

/**
 * One tuplet marking over a run of equal-ratio elements: the count label,
 * with a hooked bracket unless the whole run already hangs from one beam.
 */
export type LaidOutTuplet = {
  x1: number;
  x2: number;
  y: number;
  label: string;
  bracket: boolean;
};

export type LaidOutMeasure = {
  width: number;
  /** Clef, key, and time signature glyphs printed at the start of the measure */
  signatures: readonly LaidOutGlyph[];
  elements: readonly LaidOutElement[];
  beams: readonly LaidOutBeam[];
  /** Furniture above the staff; emitted on the first staff only */
  annotations: readonly LaidOutAnnotation[];
  /** Syllables and hyphens under this staff, one row per verse */
  lyrics: readonly LaidOutText[];
  tuplets: readonly LaidOutTuplet[];
  opening?: OpeningBarline;
  closing: ClosingBarline;
};

/**
 * A tie arc as a cubic bézier centerline in system coordinates. The
 * rendering side thickens it into the classic pointed lens. A tie split at a
 * system break appears as one open-ended arc in each system.
 */
export type LaidOutArc = {
  x1: number;
  y1: number;
  cx1: number;
  cy1: number;
  cx2: number;
  cy2: number;
  x2: number;
  y2: number;
};

/**
 * A tie arc bound to the staff row it belongs to; its coordinates are
 * system-x and staff-local y.
 */
export type LaidOutStaffArc = LaidOutArc & { staff: number };

/**
 * One hairpin wedge (or one system's segment of a split one): two lines from
 * (x1, y ∓ leftGap/2) to (x2, y ∓ rightGap/2). A crescendo opens rightward
 * (leftGap 0), a diminuendo closes; a split segment carries interpolated
 * gaps at the boundary.
 */
export type LaidOutHairpin = {
  x1: number;
  x2: number;
  y: number;
  leftGap: number;
  rightGap: number;
};

export type LaidOutStaffHairpin = LaidOutHairpin & { staff: number };

/**
 * One volta bracket segment above the top staff: a line from x1 to x2 with a
 * down-hook at each closed end, and the passage label inside the open
 * corner.
 */
export type LaidOutVolta = {
  x1: number;
  x2: number;
  y: number;
  /** e.g. "1." — absent on a continuation segment after a system break */
  label?: string;
  hookStart: boolean;
  hookEnd: boolean;
};

/**
 * A system: every staff's slice of a run of measures, stacked vertically.
 * Each measure entry sits at its x offset, knows which score measure it
 * draws, and holds one LaidOutMeasure per staff (all sharing one width, so
 * barlines align). `staffYs` gives each staff row's top-line y.
 */
export type LaidOutSystem = {
  measures: readonly { x: number; index: number; staves: readonly LaidOutMeasure[] }[];
  staffYs: readonly number[];
  ties: readonly LaidOutStaffArc[];
  slurs: readonly LaidOutStaffArc[];
  hairpins: readonly LaidOutStaffHairpin[];
  voltas: readonly LaidOutVolta[];
  /** The system content's topmost y, relative to the first staff's top line (≤ 0) */
  top: number;
  /** The content's bottommost y, below the last staff (≥ its bottom line) */
  bottom: number;
  width: number;
};
