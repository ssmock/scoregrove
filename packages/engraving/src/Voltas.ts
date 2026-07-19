import { ClosingBarline } from '@scoregrove/domain/Barline';
import type { Score } from '@scoregrove/domain/Score';
import type { LaidOutSystem, LaidOutVolta } from './LayoutTree';

/** The bracket line's y above the top staff */
const voltaY = -3.5;

/**
 * A run of consecutive measures sharing one identical ending set — the
 * domain's shape for one volta bracket.
 */
type Bracket = {
  numbers: readonly number[];
  first: number;
  last: number;
};

const sameNumbers = (a: readonly number[], b: readonly number[]): boolean =>
  a.length === b.length && a.every((n, i) => n === b[i]);

const bracketsOf = (score: Score): Bracket[] => {
  const brackets: Bracket[] = [];

  score.measures.forEach((measure, measureIndex) => {
    if (!measure.ending) return;

    const numbers = [...measure.ending].sort((a, b) => a - b);
    const current = brackets.at(-1);

    if (current && current.last === measureIndex - 1 && sameNumbers(current.numbers, numbers)) {
      current.last = measureIndex;
    } else {
      brackets.push({ numbers, first: measureIndex, last: measureIndex });
    }
  });

  return brackets;
};

export const Voltas = {
  /**
   * Resolves volta endings into bracket segments above the top staff. A
   * bracket spans its run of measures, hooks down at its start, and hooks
   * down at its end when the passage closes with a repeat (the final passage
   * runs on open-ended, per convention). A bracket crossing system breaks
   * splits per system; only the first segment carries the passage label and
   * the start hook.
   */
  attach(score: Score, systems: readonly LaidOutSystem[]): LaidOutSystem[] {
    /** Where each measure landed: system and x extent */
    const placedMeasures = new Map<number, { systemIndex: number; x1: number; x2: number }>();

    systems.forEach((system, systemIndex) => {
      system.measures.forEach((entry) => {
        placedMeasures.set(entry.index, {
          systemIndex,
          x1: entry.x,
          x2: entry.x + (entry.staves[0]?.width ?? 0),
        });
      });
    });

    const voltas = systems.map((): LaidOutVolta[] => []);

    for (const bracket of bracketsOf(score)) {
      const start = placedMeasures.get(bracket.first);
      const end = placedMeasures.get(bracket.last);

      if (!start || !end) continue;

      const closes = score.measures[bracket.last].closing === ClosingBarline.RepeatClose;
      const label = `${bracket.numbers.join(', ')}.`;

      for (let systemIndex = start.systemIndex; systemIndex <= end.systemIndex; systemIndex += 1) {
        const isFirst = systemIndex === start.systemIndex;
        const isLast = systemIndex === end.systemIndex;

        voltas[systemIndex].push({
          x1: isFirst ? start.x1 : 0,
          x2: isLast ? end.x2 : systems[systemIndex].width - 0.5,
          y: voltaY,
          ...(isFirst ? { label } : {}),
          hookStart: isFirst,
          hookEnd: isLast && closes,
        });
      }
    }

    return systems.map((system, systemIndex) => ({ ...system, voltas: voltas[systemIndex] }));
  },
};
