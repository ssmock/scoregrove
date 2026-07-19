import type { Score } from '@scoregrove/domain/Score';
import type { LaidOutSystem } from './LayoutTree';
import { LineBreaking, type LineBreakOptions } from './LineBreaking';

/**
 * The whole piece, laid out: header text and the line-broken systems. The
 * rendering side stacks the systems vertically in HTML per the strategy's
 * HTML/SVG split; vertical layout inside multi-staff systems is a later
 * pipeline stage.
 */
export type LaidOutScore = {
  title?: string;
  composer?: string;
  /** One entry per staff, for the labels printed at the first system */
  staffLabels: readonly (string | undefined)[];
  systems: readonly LaidOutSystem[];
  /** The target width the systems were justified to, in staff spaces */
  width: number;
};

export const ScoreLayout = {
  layout(score: Score, options: LineBreakOptions): LaidOutScore {
    return {
      ...(score.title ? { title: score.title } : {}),
      ...(score.composer ? { composer: score.composer } : {}),
      staffLabels: score.staves.map((staff) => staff.label),
      systems: LineBreaking.breakIntoSystems(score, options),
      width: options.width,
    };
  },
};
