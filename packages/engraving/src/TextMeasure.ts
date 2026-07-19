/**
 * Text measurement is the one thing the pipeline cannot compute from
 * metadata: syllable and annotation widths depend on the text face. Per the
 * strategy, a measurement function is injected so the pipeline stays pure
 * and testable — the web client supplies a canvas-backed one, tests and
 * stories fall back to the approximation.
 */

export type TextStyle = {
  /** The em height in staff spaces */
  size: number;
  italic?: boolean;
  bold?: boolean;
};

/**
 * Returns the rendered width of `text`, in staff spaces.
 */
export type TextMeasurer = (text: string, style: TextStyle) => number;

/**
 * A serviceable stand-in when no real measurer is injected: average serif
 * glyph width is a little over half the em.
 */
export const approximateTextMeasurer: TextMeasurer = (text, style) =>
  text.length * style.size * 0.52;
