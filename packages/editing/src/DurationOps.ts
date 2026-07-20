import { Duration, NoteValue } from '@scoregrove/domain/Duration';
import { NonEmptyArray } from '@scoregrove/domain/NonEmptyArray';
import type { Articulation } from '@scoregrove/domain/Notations';

/** Longest to shortest — the ladder "-" and "=" step along */
const ladder: readonly NoteValue[] = [
  NoteValue.Breve,
  NoteValue.Whole,
  NoteValue.Half,
  NoteValue.Quarter,
  NoteValue.Eighth,
  NoteValue.Sixteenth,
  NoteValue.ThirtySecond,
  NoteValue.SixtyFourth,
];

export const DurationOps = {
  /**
   * Moves one step shorter on the note-value ladder (the "-" hotkey),
   * clamped at SixtyFourth (a no-op there). Dots and tuplet membership are
   * preserved, which is exactly the same as halving the written fraction:
   * every ladder step is a power of two apart, and a dot's multiplier
   * doesn't depend on which tier it's attached to.
   */
  halve(duration: Duration): Duration {
    const index = ladder.indexOf(duration.noteValue);

    return { ...duration, noteValue: ladder[Math.min(index + 1, ladder.length - 1)] };
  },

  /**
   * Moves one step longer (the "=" hotkey), clamped at Breve.
   */
  double(duration: Duration): Duration {
    const index = ladder.indexOf(duration.noteValue);

    return { ...duration, noteValue: ladder[Math.max(index - 1, 0)] };
  },

  /**
   * Cycles augmentation dots: none → single → double → none.
   */
  cycleDots(duration: Duration): Duration {
    if (duration.dots === undefined) return { ...duration, dots: 1 };

    if (duration.dots === 1) return { ...duration, dots: 2 };

    const { noteValue, tuplet } = duration;

    return tuplet ? { noteValue, tuplet } : { noteValue };
  },

  /**
   * Adds `articulation` if absent, removes it if present — the flyout's
   * articulation toggle. Undefined (never an empty array) once the last one
   * is removed, matching the domain's NonEmptyArray convention for this
   * field.
   */
  toggleArticulation(
    articulations: NonEmptyArray<Articulation> | undefined,
    articulation: Articulation,
  ): NonEmptyArray<Articulation> | undefined {
    const current: readonly Articulation[] = articulations ?? [];
    const next = current.includes(articulation)
      ? current.filter((a) => a !== articulation)
      : [...current, articulation];

    return next.length ? NonEmptyArray.of(next) : undefined;
  },
};
