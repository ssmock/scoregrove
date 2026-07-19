import { DynamicChange } from '@scoregrove/domain/Dynamic';
import type { Score } from '@scoregrove/domain/Score';
import { Glyphs } from './Glyphs';
import type { LaidOutStaffHairpin, LaidOutSystem } from './LayoutTree';
import { MeasureLayout } from './MeasureLayout';

/** The full mouth height of a wedge's open end */
const mouth = 1.1;

/** Margin a split segment keeps from the system edge */
const edgeMargin = 0.5;

/**
 * One sounded element's place in the laid-out systems, for wedge endpoints.
 */
type Placed = {
  systemIndex: number;
  x: number;
  width: number;
};

/**
 * A resolved extent in domain terms: the change, and the first and last
 * sounded elements it stretches across.
 */
type Extent = {
  staff: number;
  voice: number;
  change: DynamicChange;
  start: { measure: number; element: number };
  end: { measure: number; element: number };
};

export const Hairpins = {
  /**
   * Resolves every gradual dynamic (crescendo/diminuendo wedge) into hairpin
   * segments attached to the systems. Per the domain, a change begins at the
   * following sounded element and runs until the next dynamic indication —
   * which can be measures away, so extents are resolved globally over each
   * staff-and-voice chain before any geometry (the strategy's hairpin
   * caveat). A change with no sounded element before the next indication (a
   * draft) is dropped.
   *
   * A wedge crossing system breaks splits into one segment per system, the
   * mouth interpolated by drawn length so the taper reads continuously
   * across lines.
   */
  attach(score: Score, systems: readonly LaidOutSystem[]): LaidOutSystem[] {
    /** Where every sounded element landed, keyed measure:staff:voice:element */
    const placed = new Map<string, Placed>();

    systems.forEach((system, systemIndex) => {
      system.measures.forEach((entry) => {
        entry.staves.forEach((staffMeasure, staffIndex) => {
          staffMeasure.elements.forEach((element) => {
            if (element.kind === 'dynamic') return;

            const width =
              element.kind === 'rest'
                ? Glyphs.width(element.glyph)
                : Glyphs.width(element.notehead);

            placed.set(
              `${element.address.measure}:${staffIndex}:${element.address.voice}:${element.address.element}`,
              { systemIndex, x: entry.x + element.x, width },
            );
          });
        });
      });
    });

    /** Walk each staff-and-voice chain for extents, in domain terms */
    const extents: Extent[] = [];

    score.staves.forEach((_staff, staffIndex) => {
      const voiceCount = Math.max(
        ...score.measures.map((measure) => measure.contents[staffIndex]?.voices.length ?? 0),
      );

      for (let voice = 0; voice < voiceCount; voice += 1) {
        let open: { change: DynamicChange } | undefined;
        let first: Extent['start'] | undefined;
        let last: Extent['start'] | undefined;

        const close = () => {
          if (open && first && last) {
            extents.push({
              staff: staffIndex,
              voice,
              change: open.change,
              start: first,
              end: last,
            });
          }

          open = undefined;
          first = undefined;
        };

        score.measures.forEach((measure, measureIndex) => {
          measure.contents[staffIndex]?.voices[voice]?.elements.forEach((element, elementIndex) => {
            if (element.kind === 'dynamic') {
              close();

              if (DynamicChange.is(element.dynamic)) {
                open = { change: element.dynamic };
              }

              return;
            }

            last = { measure: measureIndex, element: elementIndex };

            if (open && !first) first = last;
          });
        });

        close();
      }
    });

    const hairpins = systems.map((): LaidOutStaffHairpin[] => []);

    for (const extent of extents) {
      const key = (at: Extent['start']) =>
        `${at.measure}:${extent.staff}:${extent.voice}:${at.element}`;
      const start = placed.get(key(extent.start));
      const end = placed.get(key(extent.end));

      if (!start || !end) continue;

      const crescendo = extent.change === DynamicChange.Crescendo;
      const y = MeasureLayout.dynamicY;

      /** Each crossed system contributes a segment: [x1, x2] in its own coords */
      const segments: { systemIndex: number; x1: number; x2: number }[] = [];

      for (let systemIndex = start.systemIndex; systemIndex <= end.systemIndex; systemIndex += 1) {
        segments.push({
          systemIndex,
          x1: systemIndex === start.systemIndex ? start.x : 0,
          x2:
            systemIndex === end.systemIndex
              ? end.x + end.width
              : systems[systemIndex].width - edgeMargin,
        });
      }

      const lengths = segments.map((segment) => Math.max(segment.x2 - segment.x1, 0));
      const total = lengths.reduce((sum, length) => sum + length, 0) || 1;

      let drawn = 0;

      segments.forEach((segment, segmentIndex) => {
        const from = drawn / total;

        drawn += lengths[segmentIndex];

        const to = drawn / total;
        const gapAt = (t: number) => (crescendo ? t : 1 - t) * mouth;

        hairpins[segment.systemIndex].push({
          x1: segment.x1,
          x2: segment.x2,
          y,
          leftGap: gapAt(from),
          rightGap: gapAt(to),
          staff: extent.staff,
        });
      });
    }

    return systems.map((system, systemIndex) => ({
      ...system,
      hairpins: hairpins[systemIndex],
    }));
  },
};
