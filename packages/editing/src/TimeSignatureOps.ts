import type { Measure } from '@scoregrove/domain/Measure';
import { NonEmptyArray } from '@scoregrove/domain/NonEmptyArray';
import { Result } from '@scoregrove/domain/Result';
import type { Score } from '@scoregrove/domain/Score';
import { TimeSignature } from '@scoregrove/domain/TimeSignature';
import { ContextWalk } from '@scoregrove/engraving/ContextWalk';
import { RestBacking } from './RestBacking';

/** Every element in every staff/voice of `measure` is a rest — the only content a time signature change can safely resize */
const isEmpty = (measure: Measure): boolean =>
  measure.contents.every((content) =>
    content.voices.every((voice) => voice.elements.every((element) => element.kind === 'rest')),
  );

export const TimeSignatureOps = {
  /**
   * Sets (or replaces) the time signature change at `measureIndex` — the
   * pallet's time signature tool clicking a measure. A new time signature
   * means a new capacity, so the measure's rest-backed content is rebuilt
   * to exactly fill it across every staff; refuses outright on a measure
   * that already holds notes/chords/dynamics, since there's no reasonable
   * way to resize written music around a new meter without silently
   * discarding or corrupting it.
   */
  setTimeSignature(score: Score, measureIndex: number, time: TimeSignature): Result<Score> {
    const measure = score.measures[measureIndex];

    if (!measure) return Result.invalid(`No measure at index ${measureIndex}`);

    if (!isEmpty(measure)) {
      return Result.invalid('A time signature can only be set on an empty measure');
    }

    const resetMeasure: Measure = {
      ...measure,
      time,
      contents: NonEmptyArray.of(
        score.staves.map((_staff, staffIndex) =>
          RestBacking.emptyStaffContent(time, measure.contents[staffIndex]?.clef),
        ),
      ),
    };

    return Result.ok({
      ...score,
      measures: NonEmptyArray.of(
        score.measures.map((m, index) => (index === measureIndex ? resetMeasure : m)),
      ),
    });
  },

  /**
   * Clears the time signature change at `measureIndex`, reverting it to
   * whichever time signature is effective just before it — the element
   * eraser acting on a time signature. Rebuilds the rest-backed content to
   * match that reverted capacity, so refuses the same way `setTimeSignature`
   * does on a measure that isn't empty.
   *
   * The first measure is a special case: its time signature is always in
   * force, whether or not it restates one of its own (`ContextWalk` prints
   * one there regardless, from `score.time` if the measure doesn't carry an
   * explicit change) — there's no earlier measure to fall back to, so
   * "erasing" it instead resets the piece's own starting signature to
   * common time. Every later measure still refuses outright if it has no
   * time signature of its own to remove.
   */
  clearTimeSignature(score: Score, measureIndex: number): Result<Score> {
    const measure = score.measures[measureIndex];

    if (!measure) return Result.invalid(`No measure at index ${measureIndex}`);

    if (measureIndex > 0 && measure.time === undefined) {
      return Result.invalid('This measure has no time signature of its own to remove');
    }

    if (!isEmpty(measure)) {
      return Result.invalid('A time signature can only be removed from an empty measure');
    }

    const revertedTime =
      measureIndex === 0
        ? TimeSignature.commonTime()
        : ContextWalk.walk(score)[measureIndex - 1][0].time;

    const resetMeasure: Measure = {
      ...measure,
      time: undefined,
      contents: NonEmptyArray.of(
        score.staves.map((_staff, staffIndex) =>
          RestBacking.emptyStaffContent(revertedTime, measure.contents[staffIndex]?.clef),
        ),
      ),
    };

    return Result.ok({
      ...score,
      ...(measureIndex === 0 ? { time: revertedTime } : {}),
      measures: NonEmptyArray.of(
        score.measures.map((m, index) => (index === measureIndex ? resetMeasure : m)),
      ),
    });
  },
};
