import type { Score } from '@scoregrove/domain/Score';
import { ContextWalk } from './ContextWalk';
import type { LaidOutSystem } from './LayoutTree';
import { Hairpins } from './Hairpins';
import { MeasureLayout } from './MeasureLayout';
import { Slurs } from './Slurs';
import { Voltas } from './Voltas';
import type { TextMeasurer } from './TextMeasure';
import { Ties } from './Ties';
import { VerticalLayout } from './VerticalLayout';

/**
 * Vertical distance between staff top lines within a system. Room for extra
 * verses and dynamics per staff (the strategy's vertical layout stage) will
 * make this adaptive later.
 */
const staffSpacing = 10;

export const SystemLayout = {
  staffYs(staffCount: number): number[] {
    return Array.from({ length: staffCount }, (_staff, index) => index * staffSpacing);
  },

  /**
   * Lays out every measure of the whole score in a single unbroken system
   * with its ties — every staff, aligned on shared onset columns. Line
   * breaking splits the same per-measure layouts into width-constrained
   * systems instead.
   */
  unbroken(score: Score, options: { measureText?: TextMeasurer } = {}): LaidOutSystem {
    const contexts = ContextWalk.walk(score);
    let x = 0;

    const measures = score.measures.map((measure, measureIndex) => {
      const staves = MeasureLayout.layout({
        contexts: contexts[measureIndex],
        measure,
        measureIndex,
        ...(options.measureText ? { measureText: options.measureText } : {}),
      });

      const entry = { x, index: measureIndex, staves };

      x += staves[0]?.width ?? 0;

      return entry;
    });

    const system: LaidOutSystem = {
      measures,
      staffYs: SystemLayout.staffYs(score.staves.length),
      ties: [],
      slurs: [],
      hairpins: [],
      voltas: [],
      top: 0,
      bottom: 4,
      width: x,
    };

    return VerticalLayout.apply(
      Voltas.attach(
        score,
        Hairpins.attach(score, Slurs.attach(score, Ties.attach(score, [system]))),
      ),
    )[0];
  },
};
