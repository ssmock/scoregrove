import type { Clef } from '@scoregrove/domain/Clef';
import type { KeySignature } from '@scoregrove/domain/KeySignature';
import type { Score } from '@scoregrove/domain/Score';
import type { Tempo } from '@scoregrove/domain/Tempo';
import { Swing, type TimeSignature } from '@scoregrove/domain/TimeSignature';

/**
 * The notation state in force at one measure of one staff, resolved from the
 * score's initial state and every change up to that measure (the domain only
 * stores changes). The print flags say what this measure must actually draw:
 * the first measure prints everything, later measures only changes.
 */
export type MeasureContext = {
  clef: Clef;
  key: KeySignature;
  time: TimeSignature;
  swing: Swing;
  tempo?: Tempo;
  printClef: boolean;
  /**
   * True only for a genuine mid-piece clef change (not the first measure,
   * and not a system-start reprint) — those print the small change variant.
   */
  clefChanged: boolean;
  printKey: boolean;
  printTime: boolean;
  printTempo: boolean;
  printSwing: boolean;
};

export const ContextWalk = {
  /**
   * Resolves the effective context of every measure of every staff. Indexed
   * `walk(score)[measureIndex][staffIndex]`. Tolerates draft scores whose
   * measures are missing staff contents — the previous clef simply carries
   * forward.
   */
  walk(score: Score): MeasureContext[][] {
    const clefs = score.staves.map((staff) => staff.clef);
    let key = score.key;
    let time = score.time;
    let tempo = score.tempo;
    let swing = score.swing ?? Swing.Straight;

    return score.measures.map((measure, measureIndex) => {
      const first = measureIndex === 0;

      key = measure.key ?? key;
      time = measure.time ?? time;
      tempo = measure.tempo ?? tempo;
      swing = measure.swing ?? swing;

      const printKey = first || measure.key !== undefined;
      const printTime = first || measure.time !== undefined;
      const printTempo = (first && tempo !== undefined) || measure.tempo !== undefined;
      const printSwing = (first && swing !== Swing.Straight) || measure.swing !== undefined;

      return score.staves.map((_staff, staffIndex) => {
        const clefChange = measure.contents[staffIndex]?.clef;

        clefs[staffIndex] = clefChange ?? clefs[staffIndex];

        return {
          clef: clefs[staffIndex],
          key,
          time,
          swing,
          ...(tempo ? { tempo } : {}),
          printClef: first || clefChange !== undefined,
          clefChanged: !first && clefChange !== undefined,
          printKey,
          printTime,
          printTempo,
          printSwing,
        };
      });
    });
  },
};
