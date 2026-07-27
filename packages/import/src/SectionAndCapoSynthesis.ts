import { NewSection, SectionBreak } from '@scoregrove/domain/Measure';
import { NonEmptyString } from '@scoregrove/domain/NonEmptyString';
import type { TimewiseMeasure } from './PartwiseToTimewise';
import type { Warn } from './Reporting';
import { StructureReading, wordsOf, type MeasureStructure } from './StructureReading';
import { XmlReading } from './XmlReading';

/**
 * Movement structure, synthesised — because the source never states it.
 *
 * All four movements live in one file with no structural delimiter of any kind.
 * A movement begins where free text says so and where the engraver happened to
 * force a page, and both facts have to be turned into things the domain models:
 * a titled `Measure.newSection`, and a `NavigationMark.Capo` for the da capo to
 * return to.
 *
 * ## The Capo is the load-bearing part
 *
 * Without one, the Menuetto's `DaCapoAlFine` rewinds to the opening of movement
 * **I** — `NavigationUnfolding` resolves a bare da capo to measure 0. In
 * MusicXML a D.C. is implicitly movement-relative, and since a movement is not
 * a thing the file marks, nothing in the source says otherwise. So a Capo is
 * placed at each movement start and the jump finds the nearest preceding one.
 *
 * ## Where a section begins, and how hard it breaks
 *
 * Not by matching the titles, which would mean teaching the importer that "Var.
 * I" and "III. Menuetto" are headings. The source already says it twice over,
 * structurally: a section starts where a `<print>` forces a break *and* the
 * measure carries text. The break's own strength then chooses the section's —
 * `new-page` gives a movement its page, `new-system` gives a variation or the
 * Trio its system. That is the one place this project reads the engraver's
 * layout rather than re-deriving it, and it earns the exception by carrying
 * structure rather than spacing.
 *
 * Measure 0 is the exception the data forces: movement I begins there with a
 * title and no `<print>`, having nothing to break from.
 *
 * ## Which text is the title
 *
 * The **first** unclaimed text **on the top part**. Two conditions, and the
 * corpus insisted on both.
 *
 * A section measure often carries two pieces of text — "III. Menuetto" then
 * "Allegro", "Var. I" then "sempre piano" — where the second is a tempo
 * `StructureReading` has taken or an instruction that is not a heading at all.
 * Joining them would title a variation "Var. I sempre piano"; taking the first
 * and reporting the rest keeps the heading right and the loss visible.
 *
 * The top-part condition came from getting it wrong. A heading is printed above
 * the system, which in a partwise file means it is written on the first part —
 * and every real heading here is. Without that condition the viola's stray "♮"
 * at measure 19, three characters of transcription noise that happen to land on
 * a measure the engraver also broke a system at, becomes a section titled "♮".
 * Text on a lower part is reported rather than promoted.
 */

/** The `<print>` break a measure carries, if any, from whichever part states it */
const breakAt = (measure: TimewiseMeasure): SectionBreak | undefined => {
  for (const children of measure.contents) {
    for (const print of children.filter((child) => child.name === 'print')) {
      if (XmlReading.attribute(print, 'new-page') === 'yes') return SectionBreak.Page;
      if (XmlReading.attribute(print, 'new-system') === 'yes') return SectionBreak.System;
    }
  }

  return undefined;
};

export type MeasureSection = {
  newSection?: NewSection;
  /** A Capo to place here, merged with whatever marks the structure already found */
  capo?: boolean;
};

export const SectionAndCapoSynthesis = {
  /**
   * The section headings and Capo marks for every measure of the grid.
   * `structures` is what `StructureReading` already resolved, so text that
   * merely duplicates a navigation mark it read structurally — the "Fine" and
   * "Menuetto D.C." this file writes alongside `<sound fine>`/`<sound dacapo>`
   * — is recognised as a duplicate rather than reported as a loss.
   */
  of(
    measures: readonly TimewiseMeasure[],
    structures: readonly MeasureStructure[],
    warn: Warn,
  ): MeasureSection[] {
    return measures.map((measure, index) => {
      const structure = structures[index];
      const words = wordsOf(measure);

      if (!words.length) return {};

      // Text at a measure whose navigation was read from `<sound>` is that
      // navigation written out for the reader; the model already has it.
      const duplicatesNavigation = Boolean(structure?.marks?.length || structure?.jump);

      const spokenFor = (text: string) =>
        StructureReading.isTempoMarking(text) || duplicatesNavigation;

      const available = words.filter((entry) => !spokenFor(entry.text));
      const sectionBreak = index === 0 ? SectionBreak.Page : breakAt(measure);
      const [title, ...rest] = sectionBreak ? available.filter((entry) => entry.part === 0) : [];

      if (!title) {
        for (const entry of available) {
          warn(`measure ${measure.index}: "${entry.text}" is text the model has nowhere to put`);
        }

        return {};
      }

      for (const entry of [...rest, ...available.filter((entry) => entry.part !== 0)]) {
        warn(
          `measure ${measure.index}: "${entry.text}" sits beside the heading ` +
            `"${title.text}" and is not itself a heading; dropping it`,
        );
      }

      return {
        newSection: NewSection.of(NonEmptyString.of(title.text), sectionBreak),
        // A movement starts a fresh navigation world; a variation does not.
        ...(sectionBreak === SectionBreak.Page ? { capo: true } : {}),
      };
    });
  },
};
