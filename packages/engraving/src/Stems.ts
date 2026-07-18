import { vocabulary } from '@scoregrove/domain/Vocabulary';
import type { StaffPosition } from './StaffPosition';

const directionMembers = {
  Up: 'Up',
  Down: 'Down',
} as const;

export type StemDirection = (typeof directionMembers)[keyof typeof directionMembers];

export const StemDirection = {
  ...directionMembers,
  ...vocabulary<StemDirection>(directionMembers),
};

/**
 * Stem direction and extent rules. Directions are derived, not stored — the
 * domain has no stem fields (noted as an assumption in the rendering
 * strategy).
 */
export const Stems = {
  /**
   * The direction for an unbeamed note or chord in a single-voice texture:
   * the notehead farthest from the middle line decides, and ties (including
   * a lone middle-line note) take a down-stem.
   */
  direction(positions: readonly StaffPosition[]): StemDirection {
    const highest = Math.max(...positions);
    const lowest = Math.min(...positions);

    return highest < -lowest ? StemDirection.Up : StemDirection.Down;
  },

  /**
   * The direction in a multi-voice texture, by voice index: the first voice
   * stems up, the second down, alternating beyond.
   */
  directionForVoice(voiceIndex: number): StemDirection {
    return voiceIndex % 2 === 0 ? StemDirection.Up : StemDirection.Down;
  },

  /**
   * Where the stem tip lands: an octave (seven positions, 3.5 spaces) beyond
   * the notehead, extended to reach the middle line for noteheads far outside
   * the staff.
   */
  tipPosition(position: StaffPosition, direction: StemDirection): StaffPosition {
    return direction === StemDirection.Up ? Math.max(position + 7, 0) : Math.min(position - 7, 0);
  },
};
