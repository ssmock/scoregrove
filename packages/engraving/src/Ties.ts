import { TieRole } from '@scoregrove/domain/MeasureElement';
import { Pitch } from '@scoregrove/domain/Pitch';
import type { Score } from '@scoregrove/domain/Score';
import { Glyphs } from './Glyphs';
import type {
  LaidOutStaffArc,
  LaidOutStem,
  LaidOutSystem,
  LaidOutArc,
  ScoreAddress,
} from './LayoutTree';
import { StaffPosition } from './StaffPosition';
import { StemDirection } from './Stems';

/** Gap between a notehead edge and the tie endpoint, in staff spaces */
const endpointGap = 0.3;

/** How far the tie endpoint sits from the notehead's center line */
const endpointDrop = 0.7;

/** How far along the arc the control points sit */
const controlInset = 0.3;

/** The length of the reopening stub when a tie continues onto a new system */
const reopeningLength = 2.5;

/** Margin the open end of a split tie keeps from the system edge */
const edgeMargin = 0.5;

type TieSide = 'Over' | 'Under';

/**
 * A tieable notehead — a plain note, or one tone of a chord — flattened out
 * of the layout tree with everything an arc needs.
 */
type Endpoint = {
  systemIndex: number;
  /** The notehead's left edge in system coordinates */
  x: number;
  position: StaffPosition;
  noteheadWidth: number;
  stem?: LaidOutStem;
  tie?: TieRole;
  pitch: Pitch;
  address: ScoreAddress;
};

/**
 * A tie curves away from its notehead's stem; a stemless note curves away
 * from the middle line.
 */
const sideOf = (endpoint: Endpoint): TieSide => {
  if (endpoint.stem) {
    return endpoint.stem.direction === StemDirection.Up ? 'Under' : 'Over';
  }

  return endpoint.position >= 0 ? 'Over' : 'Under';
};

/** The arc's rise, gentle for short ties and capped for long ones */
const heightOf = (length: number): number => Math.min(1.5, 0.5 + length * 0.05);

const arc = (x1: number, x2: number, y: number, side: TieSide): LaidOutArc => {
  const length = x2 - x1;
  const rise = (side === 'Over' ? -1 : 1) * heightOf(length);

  return {
    x1,
    y1: y,
    cx1: x1 + length * controlInset,
    cy1: y + rise,
    cx2: x2 - length * controlInset,
    cy2: y + rise,
    x2,
    y2: y,
  };
};

const noteKey = (measure: number, staff: number, voice: number, element: number): string =>
  `${measure}:${staff}:${voice}:${element}`;

const toneKey = (
  measure: number,
  staff: number,
  voice: number,
  element: number,
  tone: number,
): string => `${noteKey(measure, staff, voice, element)}:${tone}`;

export const Ties = {
  /**
   * Resolves every tie of every staff and voice — plain notes and chord
   * tones alike — into arcs attached to the systems, in system-x and
   * staff-local-y coordinates. A tie connects a notehead carrying Begin (or
   * Both) to the same pitch in the immediately following sounded element of
   * the same staff and voice; pairs the domain would reject (a rest or a
   * missing pitch next — a draft mid-edit) are silently dropped, per the
   * strategy's defined-fallbacks rule. A tie whose ends sit on different
   * systems splits into an open-ended arc at each side, as spanners must at
   * system breaks.
   */
  attach(score: Score, systems: readonly LaidOutSystem[]): LaidOutSystem[] {
    /** Every tieable notehead, addressable by score position (and tone) */
    const endpoints = new Map<string, Endpoint>();

    systems.forEach((system, systemIndex) => {
      system.measures.forEach((entry) => {
        entry.staves.forEach((staffMeasure, staffIndex) => {
          staffMeasure.elements.forEach((element) => {
            const { address } = element as { address?: ScoreAddress };

            if (!address) return;

            const domain =
              score.measures[address.measure]?.contents[staffIndex]?.voices[address.voice]
                ?.elements[address.element];

            if (element.kind === 'note' && domain?.kind === 'note') {
              endpoints.set(noteKey(address.measure, staffIndex, address.voice, address.element), {
                systemIndex,
                x: entry.x + element.x,
                position: element.position,
                noteheadWidth: Glyphs.width(element.notehead),
                ...(element.stem ? { stem: element.stem } : {}),
                ...(domain.tie ? { tie: domain.tie } : {}),
                pitch: domain.pitch,
                address,
              });
            }

            if (element.kind === 'chord' && domain?.kind === 'chord') {
              element.tones.forEach((laidTone) => {
                const domainTone = domain.tones[laidTone.tone];

                if (!domainTone) return;

                endpoints.set(
                  toneKey(
                    address.measure,
                    staffIndex,
                    address.voice,
                    address.element,
                    laidTone.tone,
                  ),
                  {
                    systemIndex,
                    x: entry.x + laidTone.x,
                    position: laidTone.position,
                    noteheadWidth: Glyphs.width(element.notehead),
                    ...(element.stem ? { stem: element.stem } : {}),
                    ...(domainTone.tie ? { tie: domainTone.tie } : {}),
                    pitch: domainTone.pitch,
                    address,
                  },
                );
              });
            }
          });
        });
      });
    });

    /**
     * The immediately next sounded element after (measure, element) in the
     * same staff and voice: later in the same measure, or first in the next.
     */
    const nextSounded = (
      measureIndex: number,
      staff: number,
      voice: number,
      elementIndex: number,
    ) => {
      const within = (m: number, from: number) => {
        const elements = score.measures[m]?.contents[staff]?.voices[voice]?.elements ?? [];

        for (let i = from; i < elements.length; i += 1) {
          if (elements[i].kind !== 'dynamic') return { measure: m, element: i, value: elements[i] };
        }

        return undefined;
      };

      return within(measureIndex, elementIndex + 1) ?? within(measureIndex + 1, 0);
    };

    /** The endpoint key at which `pitch` continues in the next element, if any */
    const continuationKey = (
      next: NonNullable<ReturnType<typeof nextSounded>>,
      staff: number,
      voice: number,
      pitch: Pitch,
    ): string | undefined => {
      if (next.value.kind === 'note') {
        return Pitch.equals(next.value.pitch, pitch)
          ? noteKey(next.measure, staff, voice, next.element)
          : undefined;
      }

      if (next.value.kind === 'chord') {
        const tone = next.value.tones.findIndex((t) => Pitch.equals(t.pitch, pitch));

        return tone >= 0 ? toneKey(next.measure, staff, voice, next.element, tone) : undefined;
      }

      return undefined;
    };

    const ties = systems.map((): LaidOutStaffArc[] => []);

    for (const [, start] of endpoints) {
      if (start.tie !== TieRole.Begin && start.tie !== TieRole.Both) continue;

      const { address } = start;
      const next = nextSounded(address.measure, address.staff, address.voice, address.element);

      if (!next) continue;

      const endKey = continuationKey(next, address.staff, address.voice, start.pitch);
      const end = endKey ? endpoints.get(endKey) : undefined;

      if (!end) continue;

      const side = sideOf(start);
      const y = StaffPosition.y(start.position) + (side === 'Over' ? -endpointDrop : endpointDrop);

      const startX = start.x + start.noteheadWidth + endpointGap;
      const endX = end.x - endpointGap;

      if (start.systemIndex === end.systemIndex) {
        ties[start.systemIndex].push({ ...arc(startX, endX, y, side), staff: address.staff });
      } else {
        const startSystem = systems[start.systemIndex];

        ties[start.systemIndex].push({
          ...arc(startX, startSystem.width - edgeMargin, y, side),
          staff: address.staff,
        });
        ties[end.systemIndex].push({
          ...arc(end.x - reopeningLength, endX, y, side),
          staff: address.staff,
        });
      }
    }

    return systems.map((system, systemIndex) => ({ ...system, ties: ties[systemIndex] }));
  },
};
