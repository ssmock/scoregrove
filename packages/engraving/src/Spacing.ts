import { Duration } from '@scoregrove/domain/Duration';

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
   * The horizontal room a written duration earns: standard engraving practice
   * spaces durations on a logarithmic curve rather than proportionally, so
   * each doubling of length adds one staff space rather than doubling the
   * room.
   */
  widthOf(duration: Duration): number {
    const fraction = Duration.fractionOfWhole(duration);

    return Math.max(
      Spacing.minimumWidth,
      Spacing.quarterNoteWidth + Math.log2((4 * fraction.numerator) / fraction.denominator),
    );
  },
};
