import type { GlyphName } from '@scoregrove/engraving/Bravura';
import { Duration } from '@scoregrove/domain/Duration';
import { Fraction } from '@scoregrove/domain/Fraction';
import type { Measure } from '@scoregrove/domain/Measure';
import type { MeasureElement } from '@scoregrove/domain/MeasureElement';
import type { LaidOutElement, LaidOutGlyph, LaidOutSystem } from '@scoregrove/engraving/LayoutTree';
import { StaffPosition } from '@scoregrove/engraving/StaffPosition';

export type StaffHit = {
  measureIndex: number;
  staffIndex: number;
  elementIndex: number;
  /** Onset within the measure, as a fraction of a whole note */
  onset: Fraction;
  /** Nearest staff position, for the pitch a click at this point implies */
  position: StaffPosition;
  /**
   * True when the click landed left of the measure's first element, in the
   * clef/key/time preamble, *and* this measure prints a time signature of
   * its own there. A caller that cares about time signatures (the element
   * eraser) should check this before falling back to `elementIndex`/`onset`,
   * which still point at the nearest ordinary element regardless, since a
   * click can only ever mean one or the other, never both.
   */
  timeSignature?: boolean;
};

/** Every glyph name `Signatures.time` can produce — the numeral pairs and the two symbolic glyphs */
const timeSignatureGlyphNames: ReadonlySet<GlyphName> = new Set<GlyphName>([
  'timeSig0',
  'timeSig1',
  'timeSig2',
  'timeSig3',
  'timeSig4',
  'timeSig5',
  'timeSig6',
  'timeSig7',
  'timeSig8',
  'timeSig9',
  'timeSigCommon',
  'timeSigCutCommon',
]);

/** Whether a laid-out measure's preamble includes (and so, this measure owns) a time signature */
const hasTimeSignature = (signatures: readonly LaidOutGlyph[]): boolean =>
  signatures.some((glyph) => timeSignatureGlyphNames.has(glyph.glyph));

/** Each element kind's own vertical anchor, in the same staff-space y the layout tree uses */
const elementY = (element: LaidOutElement): number => {
  if (element.kind === 'chord') return StaffPosition.y(element.tones[0].position);
  if (element.kind === 'note') return StaffPosition.y(element.position);

  return element.y;
};

export const InteractionGeometry = {
  /** Inverts `StaffPosition.y` — the nearest staff position for a y coordinate */
  nearestPosition(y: number): StaffPosition {
    return Math.round((2 - y) * 2);
  },

  /** The staff row (by top-line y) closest to a system-relative y */
  nearestStaffRow(staffYs: readonly number[], y: number): number {
    let best = 0;
    let bestDistance = Infinity;

    staffYs.forEach((staffY, index) => {
      const distance = Math.abs(y - staffY);

      if (distance < bestDistance) {
        bestDistance = distance;
        best = index;
      }
    });

    return best;
  },

  /**
   * The measure whose horizontal span contains a system-relative x, or
   * whichever is nearest if x falls outside every span (e.g. past the last
   * measure, or in signature/margin space before the first).
   */
  nearestMeasureIndex(system: LaidOutSystem, x: number): number {
    let best = 0;
    let bestDistance = Infinity;

    system.measures.forEach((entry, index) => {
      const width = entry.staves[0]?.width ?? 0;
      const distance =
        x >= entry.x && x <= entry.x + width
          ? 0
          : Math.min(Math.abs(x - entry.x), Math.abs(x - (entry.x + width)));

      if (distance < bestDistance) {
        bestDistance = distance;
        best = index;
      }
    });

    return best;
  },

  /**
   * The element in one staff's laid-out measure closest to a (system-x,
   * staff-relative-y) point — by true 2D distance, not just x, so a note
   * and the dynamic mark below it (which shares the note's x) don't get
   * confused for each other.
   */
  nearestElementIndex(
    elements: readonly LaidOutElement[],
    x: number,
    y: number,
  ): number | undefined {
    if (!elements.length) return undefined;

    let best = 0;
    let bestDistance = Infinity;

    elements.forEach((element, index) => {
      const dx = x - element.x;
      const dy = y - elementY(element);
      const distance = dx * dx + dy * dy;

      if (distance < bestDistance) {
        bestDistance = distance;
        best = index;
      }
    });

    return best;
  },

  /**
   * The onset of the element at `elementIndex`, summing the written
   * durations of everything before it in the same voice (dynamics take no
   * time and are skipped) — the layout tree doesn't carry onset directly,
   * only x position, so this walks the domain measure instead.
   */
  onsetOf(elements: readonly MeasureElement[], elementIndex: number): Fraction {
    let onset = Fraction.zero();

    for (let index = 0; index < elementIndex; index += 1) {
      const element = elements[index];

      if (element.kind !== 'dynamic') {
        onset = Fraction.add(onset, Duration.fractionOfWhole(element.duration));
      }
    }

    return onset;
  },

  /**
   * The full hit test: which measure, staff, and element (in the first
   * voice) a click lands nearest to, its onset, and the nearest staff
   * position for pitch. `measures` are the *domain* measures backing
   * `system` (onset can't be derived from the layout tree alone).
   *
   * Undefined only for a system with no measures at all. Kind-specific
   * decisions (is this a valid place to erase? to place at?) are the
   * caller's — this only resolves "nearest to here," the same way for
   * every mode.
   */
  locate(args: {
    system: LaidOutSystem;
    measures: readonly Measure[];
    x: number;
    y: number;
  }): StaffHit | undefined {
    const { system, measures, x, y } = args;

    if (!system.measures.length) return undefined;

    const measureEntryIndex = InteractionGeometry.nearestMeasureIndex(system, x);
    const entry = system.measures[measureEntryIndex];
    const staffIndex = InteractionGeometry.nearestStaffRow(system.staffYs, y);
    const laidOutMeasure = entry.staves[staffIndex];

    if (!laidOutMeasure) return undefined;

    const staffRelativeY = y - (system.staffYs[staffIndex] ?? 0);
    // `x` is system-relative, but each element's own `x` is relative to its
    // measure's origin (measures render translated by `entry.x`) — comparing
    // them directly biases every non-first measure toward whichever element
    // has the largest measure-relative x, since the (uncorrected) distance
    // shrinks monotonically with it.
    const measureRelativeX = x - entry.x;
    const elementIndex = InteractionGeometry.nearestElementIndex(
      laidOutMeasure.elements,
      measureRelativeX,
      staffRelativeY,
    );

    if (elementIndex === undefined) return undefined;

    const voiceElements = measures[entry.index]?.contents[staffIndex]?.voices[0]?.elements;

    if (!voiceElements) return undefined;

    const firstElementX = laidOutMeasure.elements[0]?.x ?? Infinity;
    const timeSignature =
      measureRelativeX < firstElementX && hasTimeSignature(laidOutMeasure.signatures);

    return {
      measureIndex: entry.index,
      staffIndex,
      elementIndex,
      onset: InteractionGeometry.onsetOf(voiceElements, elementIndex),
      position: InteractionGeometry.nearestPosition(staffRelativeY),
      ...(timeSignature ? { timeSignature } : {}),
    };
  },
};
