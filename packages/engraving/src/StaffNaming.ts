import { Part } from '@scoregrove/domain/Part';
import type { Score } from '@scoregrove/domain/Score';
import { approximateTextMeasurer, type TextMeasurer } from './TextMeasure';

/**
 * What is printed in a system's left margin, and how much room it needs.
 *
 * ## Two names, not one
 *
 * Engraving convention gives the first system full names and every later
 * system abbreviations — "Violin I" once, then "Vln. I" down the page. That is
 * not decoration: the margin is repeated on every system of every page, so full
 * names would eat the width the music needs.
 *
 * The names come from `Score.parts` when it has them and fall back to
 * `Staff.label`, which is the only thing hand-authored fixtures carry. A part
 * spanning several staves (a piano under a brace) names its **first** staff and
 * leaves the rest blank, which is how a grand staff is printed.
 *
 * ## The margin is measured, not assumed
 *
 * It used to be a fixed 8 spaces, which was fine while the widest label in the
 * repo was "RH". A string quartet puts "Violoncello" there and overruns it. So
 * the margin is the widest label actually being printed, measured with the same
 * injected `TextMeasurer` the rest of the pipeline uses, plus a gap to the
 * systemic barline. No labels means no margin at all.
 */

/** The em height labels are printed at, matching `StaffLabel` */
export const labelSize = 1.8;

/** Space between the longest label and the staff it names */
const labelGap = 1;

export type StaffNames = {
  /** One entry per staff: the full name, printed on the first system */
  full: readonly (string | undefined)[];
  /** One entry per staff: the short form, printed on every later system */
  short: readonly (string | undefined)[];
  /** Left margin in staff spaces, sized to whichever set is wider */
  margin: number;
};

/**
 * Spreads a per-part value across the staves each part occupies, naming only
 * the first staff of a multi-staff part.
 */
const acrossStaves = (
  score: Score,
  read: (part: Part) => string | undefined,
): (string | undefined)[] => {
  const names: (string | undefined)[] = score.staves.map(() => undefined);

  if (!score.parts) return names;

  let staff = 0;

  for (const part of score.parts) {
    if (staff < names.length) names[staff] = read(part);

    staff += Part.staffCount(part);
  }

  return names;
};

export const StaffNaming = {
  /**
   * The labels for a score, with the margin they need. `Staff.label` wins where
   * a part says nothing, so an existing fixture keeps printing exactly what it
   * printed before parts existed.
   */
  of(score: Score, measureText: TextMeasurer = approximateTextMeasurer): StaffNames {
    const fromParts = acrossStaves(score, (part) => part.name);
    const abbreviations = acrossStaves(score, (part) => part.abbreviation ?? part.name);

    const full = score.staves.map((staff, index) => fromParts[index] ?? staff.label);
    const short = score.staves.map((staff, index) => abbreviations[index] ?? staff.label);

    const widest = [...full, ...short].reduce(
      (widest, label) =>
        label ? Math.max(widest, measureText(label, { size: labelSize })) : widest,
      0,
    );

    return { full, short, margin: widest ? widest + labelGap : 0 };
  },
};
