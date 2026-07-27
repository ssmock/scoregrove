import type { Score } from '@scoregrove/domain/Score';
import type { StaffGroup } from '@scoregrove/domain/Part';
import type { LaidOutSystem } from './LayoutTree';
import { LineBreaking, type LineBreakOptions } from './LineBreaking';
import { StaffNaming, type StaffNames } from './StaffNaming';

/**
 * The whole piece, laid out: header text, the staff naming and grouping every
 * system's left edge needs, and the line-broken systems. The rendering side
 * stacks the systems vertically in HTML per the strategy's HTML/SVG split.
 */
export type LaidOutScore = {
  title?: string;
  composer?: string;
  /**
   * The staff labels and the margin they need. Full names print on the first
   * system and abbreviations on the rest, which is why this is a pair rather
   * than the single list it used to be.
   */
  names: StaffNames;
  /**
   * Brackets and braces over runs of staves, carried through from the score so
   * the rendering side never needs the `Score` itself. Which staves a group
   * spans is a domain fact; where its bracket lands is geometry the system
   * already knows from `staffYs`.
   */
  groups: readonly StaffGroup[];
  systems: readonly LaidOutSystem[];
  /** The target width the systems were justified to, in staff spaces */
  width: number;
};

export const ScoreLayout = {
  layout(score: Score, options: LineBreakOptions): LaidOutScore {
    return {
      ...(score.title ? { title: score.title } : {}),
      ...(score.composer ? { composer: score.composer } : {}),
      names: StaffNaming.of(score, options.measureText),
      groups: score.groups ?? [],
      systems: LineBreaking.breakIntoSystems(score, options),
      width: options.width,
    };
  },
};
