import { Result } from '@scoregrove/domain/Result';
import type { TimewiseMeasure, TimewiseScore } from './PartwiseToTimewise';

/**
 * A measure range of an aligned grid, as a grid in its own right.
 *
 * A development affordance rather than the shipping shape: the deliverable is
 * one combined `Score` for the whole work, and this exists so the smoke test
 * can be 21 bars of movement II instead of all 531.
 *
 * ## Carrying forward what is already in force
 *
 * The one thing that makes this more than `Array.slice`. MusicXML declares an
 * attribute where it *changes*, so a slice beginning at measure 128 inherits
 * everything declared before it — and simply cutting the array would produce a
 * score with no clefs at all, since this file declares them once at measure 0
 * and never again. The first measure of a slice therefore states the key, time
 * and clef in force at that point, whether or not the source restated them
 * there.
 *
 * Positional indices are kept as they were in the full score rather than
 * renumbered from zero, so an error message about measure 131 still names the
 * measure a reader can find in the source. Nothing downstream keys on the
 * value: `ScoreAssembly` decides what is initial by *position in the grid*,
 * which is what makes a slice assemble exactly like a whole file.
 */

/** The last value declared at or before `upTo`, scanning backwards */
const inForce = <T>(
  measures: readonly TimewiseMeasure[],
  upTo: number,
  read: (measure: TimewiseMeasure) => T | undefined,
): T | undefined => {
  for (let index = upTo; index >= 0; index -= 1) {
    const value = read(measures[index]);

    if (value !== undefined) return value;
  }

  return undefined;
};

export const MeasureSlicing = {
  /**
   * Measures `from` to `to`, both inclusive, indexed by position in the grid.
   * A range outside the score is refused rather than clamped — asking for
   * measures that do not exist is a mistake worth hearing about, not something
   * to silently reinterpret.
   */
  slice(score: TimewiseScore, from: number, to: number): Result<TimewiseScore> {
    const total = score.measures.length;

    if (!Number.isInteger(from) || !Number.isInteger(to)) {
      return Result.invalid('A measure range must be given as whole numbers');
    }

    if (from < 0 || to >= total) {
      return Result.invalid(
        `Measures ${from}–${to} lie outside the score, which has ${total} (0–${total - 1})`,
      );
    }

    if (from > to) return Result.invalid(`Measure range ${from}–${to} runs backwards`);

    const [head, ...rest] = score.measures.slice(from, to + 1);

    const opening: TimewiseMeasure = {
      ...head,
      key: head.key ?? inForce(score.measures, from, (measure) => measure.key),
      time: head.time ?? inForce(score.measures, from, (measure) => measure.time),
      clefs: head.clefs.map(
        (clef, part) => clef ?? inForce(score.measures, from, (measure) => measure.clefs[part]),
      ),
      divisions: head.divisions.map(
        (value, part) =>
          value ?? inForce(score.measures, from, (measure) => measure.divisions[part]),
      ),
    };

    return Result.ok({ ...score, measures: [opening, ...rest] });
  },
};
