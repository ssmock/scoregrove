import type { GlyphName } from './Bravura';
import { Glyphs } from './Glyphs';
import type { LaidOutMeasure, LaidOutSystem } from './LayoutTree';
import { MeasureLayout } from './MeasureLayout';
import { StaffPosition } from './StaffPosition';

/**
 * Pushes each staff's dynamics clear of the music above them.
 *
 * `MeasureLayout` places a dynamic at a fixed depth below the top line, which
 * is right until something hangs lower than the staff — a cello's low register,
 * a run of ledger lines, a down-stem. The invariant suite counted **39 places**
 * in the Haydn quartet where the mark ends up drawn through a notehead.
 *
 * ## One baseline per staff per system, not per mark
 *
 * Dynamics belong on a line. Nudging each mark independently would clear every
 * collision and leave the row staggered, which is worse to read than the
 * collision it fixed — so the deepest content anywhere in the staff's slice of
 * the system sets one baseline for all of them. That is what an engraver does,
 * and it is why this runs per system rather than per measure.
 *
 * **Hairpins move with them.** They share the dynamics baseline on purpose
 * ("wedges and marks sit on one line" — `MeasureLayout.dynamicY`), so moving
 * marks without their wedges would break the alignment the constant exists to
 * guarantee.
 *
 * ## Why a pass rather than a placement rule
 *
 * The depth is not known when a measure is laid out: it depends on every
 * measure of the system, and which measures share a system is decided later by
 * line breaking. So this runs after the spanners attach and before
 * `VerticalLayout` measures the system, whose extents then include the marks
 * where they finally sit.
 */

/** Clear space between the lowest music and the top of a dynamic */
const clearance = 0.8;

/** How far below the bottom staff line a note's content reaches, in staff spaces */
const contentBottom = (measure: LaidOutMeasure): number => {
  let bottom = 4;

  const include = (value: number) => {
    bottom = Math.max(bottom, value);
  };

  const glyphBottom = (glyph: GlyphName, y: number) => y - Glyphs.data(glyph).bBoxSW[1];

  for (const element of measure.elements) {
    // A dynamic is what is being placed; it cannot be its own obstacle
    if (element.kind === 'dynamic') continue;

    if (element.kind === 'rest') {
      include(glyphBottom(element.glyph, element.y));
      continue;
    }

    const positions =
      element.kind === 'note' ? [element.position] : element.tones.map((tone) => tone.position);

    for (const position of positions) {
      include(glyphBottom(element.notehead, StaffPosition.y(position)));

      for (const ledger of StaffPosition.ledgerLines(position)) include(StaffPosition.y(ledger));
    }

    // An accidental hangs lower than the head it belongs to — the four
    // collisions left after the first pass were all a flat or a sharp, so
    // counting only noteheads is not enough.
    const hanging =
      element.kind === 'note'
        ? [...(element.accidental ? [element.accidental] : []), ...(element.dots ?? [])]
        : element.tones.flatMap((tone) => [
            ...(tone.accidental ? [tone.accidental] : []),
            ...(tone.dots ?? []),
          ]);

    for (const glyph of hanging) include(glyphBottom(glyph.glyph, glyph.y));

    if (element.stem) include(element.stem.bottom);
    if (element.flag) include(glyphBottom(element.flag.glyph, element.flag.y));

    for (const mark of element.articulations ?? []) include(glyphBottom(mark.glyph, mark.y));
  }

  for (const beam of measure.beams) include(Math.max(beam.y1, beam.y2) + beam.thickness);

  return bottom;
};

export const DynamicPlacement = {
  /**
   * Returns the systems with every staff's dynamics and hairpins moved to a
   * baseline that clears the music above them. Systems whose marks already sit
   * clear are returned unchanged.
   */
  apply(systems: readonly LaidOutSystem[]): LaidOutSystem[] {
    return systems.map((system) => {
      const staffCount = system.staffYs.length;
      const baselines: number[] = [];

      for (let staff = 0; staff < staffCount; staff += 1) {
        const deepest = Math.max(
          4,
          ...system.measures.map((entry) =>
            entry.staves[staff] ? contentBottom(entry.staves[staff]) : 4,
          ),
        );

        // A dynamic's y is its baseline and its glyph sits above it, so the
        // tallest mark on the staff decides how far down the line has to go
        // for all of them to clear.
        const tallest = Math.max(
          0,
          ...system.measures.flatMap((entry) =>
            (entry.staves[staff]?.elements ?? []).flatMap((element) =>
              element.kind === 'dynamic' ? [Glyphs.data(element.glyph).bBoxNE[1]] : [],
            ),
          ),
        );

        baselines.push(Math.max(MeasureLayout.dynamicY, deepest + clearance + tallest));
      }

      if (baselines.every((baseline) => baseline === MeasureLayout.dynamicY)) return system;

      return {
        ...system,
        measures: system.measures.map((entry) => ({
          ...entry,
          staves: entry.staves.map((measure, staff) => ({
            ...measure,
            elements: measure.elements.map((element) =>
              element.kind === 'dynamic' ? { ...element, y: baselines[staff] } : element,
            ),
          })),
        })),
        hairpins: system.hairpins.map((hairpin) => ({
          ...hairpin,
          y: baselines[hairpin.staff] ?? hairpin.y,
        })),
      };
    });
  },
};
