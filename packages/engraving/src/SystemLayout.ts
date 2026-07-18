import type { Score } from '@scoregrove/domain/Score';
import { ContextWalk } from './ContextWalk';
import type { LaidOutSystem } from './LayoutTree';
import { MeasureLayout } from './MeasureLayout';

export const SystemLayout = {
  /**
   * Lays out every measure of one staff in a single unbroken row — the
   * pre-line-breaking system that carries the end-to-end slice. Line breaking
   * (splitting this row into width-constrained systems and justifying them)
   * is a later pipeline stage that will build on the same per-measure
   * layouts.
   */
  singleStaff(score: Score, staffIndex = 0): LaidOutSystem {
    const contexts = ContextWalk.walk(score);
    let x = 0;

    const measures = score.measures.map((measure, measureIndex) => {
      const laid = MeasureLayout.layout({
        context: contexts[measureIndex][staffIndex],
        measure,
        measureIndex,
        staffIndex,
      });

      const entry = { x, measure: laid };

      x += laid.width;

      return entry;
    });

    return { measures, width: x };
  },
};
