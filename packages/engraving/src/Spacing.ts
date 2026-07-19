import { Duration } from '@scoregrove/domain/Duration';
import type { Fraction } from '@scoregrove/domain/Fraction';

export const Spacing = {
  /**
   * The rhythmic room a quarter note earns, in staff spaces.
   */
  quarterNoteWidth: 3.5,

  /**
   * The floor below which very short values stop shrinking, so that runs of
   * 32nds and 64ths stay readable.
   */
  minimumWidth: 1.5,

  /**
   * The horizontal room a span of written time earns: standard engraving
   * practice spaces durations on a logarithmic curve rather than
   * proportionally, so each doubling of length adds one staff space rather
   * than doubling the room. Onset columns price the gap between adjacent
   * columns with this same curve.
   */
  widthOfFraction(fraction: Fraction): number {
    if (fraction.numerator <= 0) return Spacing.minimumWidth;

    return Math.max(
      Spacing.minimumWidth,
      Spacing.quarterNoteWidth + Math.log2((4 * fraction.numerator) / fraction.denominator),
    );
  },

  widthOf(duration: Duration): number {
    return Spacing.widthOfFraction(Duration.fractionOfWhole(duration));
  },
};
