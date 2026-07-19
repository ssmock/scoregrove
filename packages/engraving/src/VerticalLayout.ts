import type { GlyphName } from './Bravura';
import { Glyphs } from './Glyphs';
import type { LaidOutMeasure, LaidOutSystem, LaidOutText } from './LayoutTree';
import { StaffPosition } from './StaffPosition';

/** Staff tops never sit closer than this — the old fixed spacing as a floor */
const minimumStaffSpacing = 10;

/** Clear space kept between one row's lowest content and the next's highest */
const interStaffGap = 1.5;

/** Breathing room above and below the whole system */
const margin = 1;

/** Serif text reaches about this far above and below its baseline */
const textAscent = 0.8;
const textDescent = 0.25;

/** Matches VoltaBracket's hook depth */
const voltaHookDepth = 1.5;

/**
 * A staff row's vertical reach in its own coordinates: `top` at or above the
 * top line (≤ 0), `bottom` at or below the bottom line (≥ 4).
 */
type Extent = { top: number; bottom: number };

const glyphExtent = (glyph: GlyphName, y: number): Extent => {
  const data = Glyphs.data(glyph);

  return { top: y - data.bBoxNE[1], bottom: y - data.bBoxSW[1] };
};

const textExtent = (text: LaidOutText): Extent => ({
  top: text.y - text.size * textAscent,
  bottom: text.y + text.size * textDescent,
});

const measureExtent = (measure: LaidOutMeasure): Extent => {
  let top = 0;
  let bottom = 4;

  const include = (extent: Extent) => {
    top = Math.min(top, extent.top);
    bottom = Math.max(bottom, extent.bottom);
  };

  measure.signatures.forEach((laid) => include(glyphExtent(laid.glyph, laid.y)));
  measure.annotations.forEach((annotation) =>
    include(
      annotation.kind === 'glyph'
        ? glyphExtent(annotation.glyph, annotation.y)
        : textExtent(annotation),
    ),
  );
  measure.lyrics.forEach((syllable) => include(textExtent(syllable)));
  measure.beams.forEach((beam) => {
    include({
      top: Math.min(beam.y1, beam.y2) - beam.thickness,
      bottom: Math.max(beam.y1, beam.y2) + beam.thickness,
    });
  });

  measure.elements.forEach((element) => {
    if (element.kind === 'dynamic') {
      include(glyphExtent(element.glyph, element.y));

      return;
    }

    if (element.kind === 'rest') {
      include(glyphExtent(element.glyph, element.y));
      if (element.fermata) include(glyphExtent(element.fermata.glyph, element.fermata.y));

      return;
    }

    const positions =
      element.kind === 'note' ? [element.position] : element.tones.map((tone) => tone.position);

    positions.forEach((position) =>
      include(glyphExtent(element.notehead, StaffPosition.y(position))),
    );

    if (element.stem) include({ top: element.stem.top, bottom: element.stem.bottom });
    if (element.flag) include(glyphExtent(element.flag.glyph, element.flag.y));
    if (element.fermata) include(glyphExtent(element.fermata.glyph, element.fermata.y));

    element.ledgers.forEach((position) => {
      const y = StaffPosition.y(position);

      include({ top: y, bottom: y });
    });

    element.articulations?.forEach((mark) => include(glyphExtent(mark.glyph, mark.y)));
    element.graces?.forEach((grace) => include({ top: grace.stem.top, bottom: grace.stem.bottom }));
  });

  measure.tuplets.forEach((tuplet) =>
    include({ top: tuplet.y - 2 * textAscent, bottom: tuplet.y }),
  );

  return { top, bottom };
};

const staffExtents = (system: LaidOutSystem): Extent[] => {
  const extents = system.staffYs.map((): Extent => ({ top: 0, bottom: 4 }));

  const include = (staff: number, extent: Extent) => {
    const current = extents[staff];

    if (!current) return;

    current.top = Math.min(current.top, extent.top);
    current.bottom = Math.max(current.bottom, extent.bottom);
  };

  system.measures.forEach((entry) =>
    entry.staves.forEach((measure, staffIndex) => include(staffIndex, measureExtent(measure))),
  );

  [...system.ties, ...system.slurs].forEach((arc) =>
    include(arc.staff, {
      top: Math.min(arc.y1, arc.y2, arc.cy1, arc.cy2),
      bottom: Math.max(arc.y1, arc.y2, arc.cy1, arc.cy2),
    }),
  );

  system.hairpins.forEach((hairpin) => {
    const spread = Math.max(hairpin.leftGap, hairpin.rightGap) / 2;

    include(hairpin.staff, { top: hairpin.y - spread, bottom: hairpin.y + spread });
  });

  system.voltas.forEach((volta) => include(0, { top: volta.y, bottom: volta.y + voltaHookDepth }));

  return extents;
};

export const VerticalLayout = {
  /**
   * The strategy's vertical layout stage, run once every spanner is
   * attached: measure each staff row's true vertical reach — glyph bounding
   * boxes, stems, beams, ledger lines, arcs, hairpins, lyrics, annotations,
   * voltas — then stack the rows so one row's content clears the next's,
   * never tighter than the base spacing. Each system's `top` and `bottom`
   * bounds come out of the same pass, so the rendering side sizes its SVG to
   * the actual content.
   */
  apply(systems: readonly LaidOutSystem[]): LaidOutSystem[] {
    return systems.map((system) => {
      const extents = staffExtents(system);

      if (!extents.length) return { ...system, top: -margin, bottom: 4 + margin };

      const staffYs = [0];

      for (let staff = 1; staff < extents.length; staff += 1) {
        const required = extents[staff - 1].bottom + interStaffGap - extents[staff].top;

        staffYs.push(staffYs[staff - 1] + Math.max(minimumStaffSpacing, required));
      }

      return {
        ...system,
        staffYs,
        top: extents[0].top - margin,
        bottom: staffYs[staffYs.length - 1] + extents[extents.length - 1].bottom + margin,
      };
    });
  },
};
