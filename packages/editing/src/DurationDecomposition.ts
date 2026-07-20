import { Duration, NoteValue } from '@scoregrove/domain/Duration';
import { Fraction } from '@scoregrove/domain/Fraction';

/**
 * Every (note value, dot count) combination the domain can express, as a
 * Duration paired with its exact fractional length — the full "coin set"
 * rest-backing draws from. Built once at module load.
 */
const candidates: readonly { duration: Duration; fraction: Fraction }[] = NoteValue.values
  .flatMap((noteValue) =>
    ([undefined, 1, 2] as const).map((dots) => Duration.of(noteValue, dots ? { dots } : {})),
  )
  .map((duration) => ({ duration, fraction: Duration.fractionOfWhole(duration) }))
  .sort((a, b) => Fraction.compare(b.fraction, a.fraction));

/** Sanity limit on recursion depth — real inputs resolve in well under this */
const maxDepth = 64;

/**
 * Largest-first search with backtracking: try each candidate that still
 * fits, in descending order, and recurse; if a choice leads to a dead end,
 * back out and try the next one instead of committing to it. Plain greedy
 * (always taking the single largest fit, no backtracking) is *not* always
 * correct here — 5/128 is exactly a dotted sixty-fourth plus a plain one,
 * but greedy takes a plain thirty-second first (also ≤ 5/128, and bigger
 * than the dotted sixty-fourth) and stalls on the 1/128 left over, which
 * nothing in the candidate set can express. Backtracking finds the
 * dotted-sixty-fourth-first path instead.
 *
 * Undefined means no exact decomposition exists within `maxDepth` terms —
 * distinct from "not yet found one" so the caller can tell a real dead end
 * from a search that's merely still running.
 */
const search = (remaining: Fraction, depth: number): Duration[] | undefined => {
  if (remaining.numerator === 0) return [];

  if (depth >= maxDepth) return undefined;

  for (const candidate of candidates) {
    if (Fraction.compare(candidate.fraction, remaining) > 0) continue;

    const rest = search(Fraction.subtract(remaining, candidate.fraction), depth + 1);

    if (rest) return [candidate.duration, ...rest];
  }

  return undefined;
};

export const DurationDecomposition = {
  /**
   * Breaks a span of time into a sequence of Durations that sums to it
   * exactly, largest values first — the foundation of rest-backing: an
   * empty measure, or the leftover time either side of a freshly placed
   * note, is always expressed this way rather than as an ad-hoc fraction.
   *
   * Empty for a zero span. Throws if `remaining` is negative (a caller
   * error — this function is never handed more time to clear than exists),
   * or if no exact decomposition exists at all — which can happen for very
   * fine remainders next to a dotted or double-dotted short note (nothing
   * in the domain's Duration model is finer than a plain sixty-fourth, so a
   * handful of finer fractions genuinely have no rest sequence that
   * expresses them; this is a real, narrow limit of that model, not a bug).
   */
  decompose(remaining: Fraction): Duration[] {
    if (remaining.numerator < 0) {
      throw new Error(`Cannot decompose a negative duration: ${Fraction.format(remaining)}`);
    }

    const durations = search(remaining, 0);

    if (!durations) {
      throw new Error(`No rest sequence exactly expresses ${Fraction.format(remaining)}`);
    }

    return durations;
  },
};
