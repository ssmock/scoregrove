import type { Score } from '@scoregrove/domain/Score';
import { ContextWalk, type MeasureContext } from './ContextWalk';
import type { LaidOutSystem } from './LayoutTree';
import { MeasureLayout } from './MeasureLayout';

export type LineBreakOptions = {
  /** The width each system should fill, in staff spaces */
  width: number;
  staffIndex?: number;
};

/**
 * Justification widens rhythmic spacing, never past this factor — a system
 * too empty to fill its width stays ragged rather than absurdly airy.
 */
const maxStretch = 8;

/** How close a justified system must come to the target width, in spaces */
const tolerance = 0.05;

export const LineBreaking = {
  /**
   * The greedy line breaker of the strategy: fill measures into systems up to
   * the target width, then justify each system except the last by stretching
   * rhythmic spacing (the last stays ragged). Measures that open a later
   * system reprint their clef and key signature, as engraving convention
   * requires — which changes their width, so the fill accounts for it.
   *
   * A single measure wider than the target gets a system to itself and
   * overflows unjustified. Optimal (Knuth–Plass-style) breaking can replace
   * the greedy fill behind this same interface later.
   */
  breakIntoSystems(score: Score, options: LineBreakOptions): LaidOutSystem[] {
    const staffIndex = options.staffIndex ?? 0;
    const contexts = ContextWalk.walk(score);

    const contextAt = (measureIndex: number, opensSystem: boolean): MeasureContext => {
      const context = contexts[measureIndex][staffIndex];

      if (!opensSystem || measureIndex === 0) return context;

      return { ...context, printClef: true, printKey: true };
    };

    const layoutAt = (measureIndex: number, opensSystem: boolean, stretch: number) =>
      MeasureLayout.layout({
        context: contextAt(measureIndex, opensSystem),
        measure: score.measures[measureIndex],
        measureIndex,
        staffIndex,
        stretch,
      });

    /** Greedy fill: each system is a run of measure indices */
    const systems: number[][] = [];
    let current: number[] = [];
    let currentWidth = 0;

    score.measures.forEach((_measure, measureIndex) => {
      const width = layoutAt(measureIndex, current.length === 0, 1).width;

      if (current.length && currentWidth + width > options.width) {
        systems.push(current);
        current = [measureIndex];
        currentWidth = layoutAt(measureIndex, true, 1).width;
      } else {
        current.push(measureIndex);
        currentWidth += width;
      }
    });

    if (current.length) systems.push(current);

    const assemble = (indices: readonly number[], stretch: number): LaidOutSystem => {
      let x = 0;

      const measures = indices.map((measureIndex, position) => {
        const laid = layoutAt(measureIndex, position === 0, stretch);
        const entry = { x, measure: laid };

        x += laid.width;

        return entry;
      });

      return { measures, width: x };
    };

    /**
     * A system's width is not linear in the stretch factor (content minimums
     * clamp short values), so justify by bisecting the factor until the
     * system lands on the target.
     */
    const justify = (indices: readonly number[]): LaidOutSystem => {
      const natural = assemble(indices, 1);

      if (natural.width >= options.width - tolerance) return natural;

      let low = 1;
      let high = maxStretch;
      let best = assemble(indices, maxStretch);

      if (best.width < options.width) return best;

      for (let i = 0; i < 24; i += 1) {
        const mid = (low + high) / 2;
        const candidate = assemble(indices, mid);

        if (Math.abs(candidate.width - options.width) <= tolerance) return candidate;

        if (candidate.width < options.width) {
          low = mid;
        } else {
          high = mid;
          best = candidate;
        }
      }

      return best;
    };

    return systems.map((indices, systemIndex) =>
      systemIndex === systems.length - 1 ? assemble(indices, 1) : justify(indices),
    );
  },
};
