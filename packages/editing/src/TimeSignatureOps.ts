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

/**
 * The measures a time-signature change at `from` governs: `from` itself and
 * every following measure up to (but not including) the next one that carries
 * a change of its own. They all share the new capacity, so a change (or
 * removal) at `from` has to resize the whole run, not just `from`.
 */
const governedSpan = (score: Score, from: number): number[] => {
  const indices = [from];

  for (
    let index = from + 1;
    index < score.measures.length && score.measures[index].time === undefined;
    index += 1
  ) {
    indices.push(index);
  }

  return indices;
};

/**
 * Rebuilds a measure's rest-backed content to exactly fill `time`, preserving
 * each staff's clef, and drops any `partial` flag along with it: a measure
 * refilled to the new capacity is full by construction, so the flag would be
 * left asserting a shortfall that no longer exists.
 *
 * This does mean a time signature change silently costs a deliberately short
 * bar its shortness. Accepted rather than solved — only rest-backed measures
 * can be resized at all, so the combination is rare, and a stale flag would be
 * worse than a lost one.
 */
const refilled = (score: Score, measure: Measure, time: TimeSignature): Measure => ({
  ...measure,
  partial: undefined,
  contents: NonEmptyArray.of(
    score.staves.map((_staff, staffIndex) =>
      RestBacking.emptyStaffContent(time, measure.contents[staffIndex]?.clef),
    ),
  ),
});

/**
 * The first measure in `span` (if any) that holds written music, so it can't
 * have its capacity changed out from under it — `undefined` when the whole
 * run is rest-backed and safe to resize.
 */
const writtenMeasureIn = (score: Score, span: number[]): number | undefined =>
  span.find((index) => !isEmpty(score.measures[index]));

const cannotResize = <T>(target: number, written: number): Result<T> =>
  Result.invalid(
    written === target
      ? 'A time signature can only be set on an empty measure'
      : `This time signature also governs measure ${written + 1}, which holds notes`,
  );

export const TimeSignatureOps = {
  /**
   * Sets (or replaces) the time signature change at `measureIndex` — the
   * pallet's time signature tool clicking a measure. A new time signature
   * means a new capacity, so the rest-backed content is rebuilt to fill it —
   * not just here but across every following measure that inherits this
   * change (up to the next measure with its own), since they share it. Refuses
   * outright if any measure in that run already holds notes/chords/dynamics,
   * since there's no reasonable way to resize written music around a new meter
   * without silently discarding or corrupting it.
   */
  setTimeSignature(score: Score, measureIndex: number, time: TimeSignature): Result<Score> {
    const measure = score.measures[measureIndex];

    if (!measure) return Result.invalid(`No measure at index ${measureIndex}`);

    const span = governedSpan(score, measureIndex);
    const written = writtenMeasureIn(score, span);

    if (written !== undefined) return cannotResize(measureIndex, written);

    const inSpan = new Set(span);

    return Result.ok({
      ...score,
      measures: NonEmptyArray.of(
        score.measures.map((m, index) =>
          inSpan.has(index)
            ? {
                ...refilled(score, m, time),
                // Only the clicked measure carries the change; the rest keep inheriting it.
                ...(index === measureIndex ? { time } : {}),
              }
            : m,
        ),
      ),
    });
  },

  /**
   * Clears the time signature change at `measureIndex`, reverting it to
   * whichever time signature is effective just before it — the element
   * eraser acting on a time signature. Rebuilds the rest-backed content of
   * this measure and every following one that inherits it to match that
   * reverted capacity, refusing the same way `setTimeSignature` does if any of
   * them holds written music.
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

    const span = governedSpan(score, measureIndex);
    const written = writtenMeasureIn(score, span);

    if (written !== undefined) {
      return written === measureIndex
        ? Result.invalid('A time signature can only be removed from an empty measure')
        : cannotResize(measureIndex, written);
    }

    const revertedTime =
      measureIndex === 0
        ? TimeSignature.commonTime()
        : ContextWalk.walk(score)[measureIndex - 1][0].time;

    const inSpan = new Set(span);

    return Result.ok({
      ...score,
      ...(measureIndex === 0 ? { time: revertedTime } : {}),
      measures: NonEmptyArray.of(
        score.measures.map((m, index) =>
          inSpan.has(index)
            ? {
                ...refilled(score, m, revertedTime),
                ...(index === measureIndex ? { time: undefined } : {}),
              }
            : m,
        ),
      ),
    });
  },
};
