import { NonEmptyArray } from '@scoregrove/domain/NonEmptyArray';
import type { Score } from '@scoregrove/domain/Score';
import type { ScoreAddress } from '@scoregrove/engraving/LayoutTree';

/**
 * A score with hidden staves filtered out for display, plus the map needed
 * to translate an address on the *projected* score (what got rendered)
 * back to the real one (what a place/erase call needs). The renderer never
 * knows projection happened — it just lays out `score` like any other.
 */
export type DisplayProjection = {
  score: Score;
  /** `staffMap[projectedIndex]` is that staff's index in the real score */
  staffMap: readonly number[];
};

export const DisplayProjection = {
  /**
   * Hiding every staff would leave nothing to render (and nothing valid to
   * lay out — a score needs at least one), so that case falls back to
   * showing everything rather than producing an empty result.
   */
  project(score: Score, hiddenStaves: ReadonlySet<number>): DisplayProjection {
    if (hiddenStaves.size === 0 || hiddenStaves.size >= score.staves.length) {
      return { score, staffMap: score.staves.map((_staff, index) => index) };
    }

    const staffMap = score.staves
      .map((_staff, index) => index)
      .filter((index) => !hiddenStaves.has(index));

    return {
      score: {
        ...score,
        staves: NonEmptyArray.of(staffMap.map((index) => score.staves[index])),
        measures: NonEmptyArray.of(
          score.measures.map((measure) => ({
            ...measure,
            contents: NonEmptyArray.of(staffMap.map((index) => measure.contents[index])),
          })),
        ),
      },
      staffMap,
    };
  },

  /** Translates an address on the projected score back to the real one */
  toRealAddress(projection: DisplayProjection, address: ScoreAddress): ScoreAddress {
    return { ...address, staff: projection.staffMap[address.staff] };
  },
};
