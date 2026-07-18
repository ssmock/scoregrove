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

export type LaidOutElement = LaidOutNote | LaidOutRest | LaidOutDynamic;

export type LaidOutMeasure = {
  width: number;
  /** Clef, key, and time signature glyphs printed at the start of the measure */
  signatures: readonly LaidOutGlyph[];
  elements: readonly LaidOutElement[];
  opening?: OpeningBarline;
  closing: ClosingBarline;
};

/**
 * One staff's measures laid out in a row, each at its x offset. Line breaking
 * will later split this into per-system slices; until then a system is the
 * whole piece.
 */
export type LaidOutSystem = {
  measures: readonly { x: number; measure: LaidOutMeasure }[];
  width: number;
};
