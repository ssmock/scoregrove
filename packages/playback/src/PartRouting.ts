import { Part } from '@scoregrove/domain/Part';
import type { Score } from '@scoregrove/domain/Score';

/**
 * Which player each staff belongs to, so a compiled event can be routed to an
 * instrument of its own.
 *
 * ## Why by part rather than by staff
 *
 * For a string quartet the two are the same thing — four parts, one staff each
 * — so routing on `address.staff` alone would work and be shorter. It breaks at
 * the first piano score, where one player owns two staves under a brace and
 * would be handed two instruments playing over each other. `Score.parts`
 * already partitions the staves in score order, and the importer fills it in,
 * so the correct version costs a few lines now instead of a redesign later.
 *
 * ## The fallback matters more than it looks
 *
 * `parts` is optional, and absent on every hand-authored fixture — a score that
 * has never been told who plays it. Those fall back to one player per staff,
 * which is exactly what the single-instrument transport did before, so nothing
 * that worked stops working.
 */

export type RoutedPart = {
  name?: string;
  /** MusicXML's instrument-sound identifier, e.g. "strings.cello" — the timbre hook */
  sound?: string;
};

export type PartRouting = {
  /** The part index playing each staff, indexed by staff */
  partOfStaff: readonly number[];
  parts: readonly RoutedPart[];
};

export const PartRouting = {
  of(score: Score): PartRouting {
    const staffCount = score.staves.length;

    if (!score.parts?.length) {
      return {
        partOfStaff: score.staves.map((_staff, index) => index),
        parts: score.staves.map((staff) => (staff.label ? { name: staff.label } : {})),
      };
    }

    const partOfStaff: number[] = [];

    score.parts.forEach((part, partIndex) => {
      for (let staff = 0; staff < Part.staffCount(part); staff += 1) {
        if (partOfStaff.length < staffCount) partOfStaff.push(partIndex);
      }
    });

    // A score whose parts cover fewer staves than it has is a `Score.check`
    // failure, not something to fail playback over: the stragglers join the
    // last part rather than sounding on no instrument at all.
    while (partOfStaff.length < staffCount) partOfStaff.push(score.parts.length - 1);

    return {
      partOfStaff,
      parts: score.parts.map((part) => ({
        ...(part.name ? { name: part.name } : {}),
        ...(part.sound ? { sound: part.sound } : {}),
      })),
    };
  },

  /** The part playing a staff; staves outside the routing fall to the first player */
  partOf(routing: PartRouting, staff: number): number {
    return routing.partOfStaff[staff] ?? 0;
  },
};
