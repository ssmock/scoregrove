import { SlurRole } from '@scoregrove/domain/Notations';
import type { Score } from '@scoregrove/domain/Score';
import { Glyphs } from './Glyphs';
import type {
  LaidOutArc,
  LaidOutChord,
  LaidOutNote,
  LaidOutStaffArc,
  LaidOutSystem,
} from './LayoutTree';
import { StaffPosition } from './StaffPosition';
import { StemDirection } from './Stems';

/** How far past a notehead's vertical extent a slur endpoint sits */
const endpointClearance = 0.6;

/** How far the arc must stay clear of the notes it spans */
const spanClearance = 0.75;

/** How far along the arc the control points sit */
const controlInset = 0.35;

/** The arc's base rise, growing gently with length */
const riseOf = (length: number): number => Math.min(2.5, 0.8 + length * 0.06);

/** The length of the reopening stub when a slur continues onto a new system */
const reopeningLength = 3;

/** Margin the open end of a split slur keeps from the system edge */
const edgeMargin = 0.5;

type SlurSide = 'Over' | 'Under';

/**
 * One sounded element under (or ending) a slur: its x in system coordinates
 * and its vertical extents, stems included.
 */
type SpanNote = {
  systemIndex: number;
  x: number;
  noteheadWidth: number;
  /** The topmost y the element reaches (stem tip or notehead edge) */
  top: number;
  /** The bottommost y the element reaches */
  bottom: number;
  stemDirection?: StemDirection;
  slur?: SlurRole;
};

const spanNoteOf = (
  element: LaidOutNote | LaidOutChord,
  systemIndex: number,
  x: number,
  slur: SlurRole | undefined,
): SpanNote => {
  const positions =
    element.kind === 'note' ? [element.position] : element.tones.map((tone) => tone.position);
  const noteTop = Math.min(...positions.map(StaffPosition.y)) - 0.5;
  const noteBottom = Math.max(...positions.map(StaffPosition.y)) + 0.5;

  return {
    systemIndex,
    x,
    noteheadWidth: Glyphs.width(element.notehead),
    top: element.stem ? Math.min(noteTop, element.stem.top) : noteTop,
    bottom: element.stem ? Math.max(noteBottom, element.stem.bottom) : noteBottom,
    ...(element.stem ? { stemDirection: element.stem.direction } : {}),
    ...(slur ? { slur } : {}),
  };
};

/**
 * A slur curves away from the majority stem direction of the notes it spans
 * (ties break toward Over, matching the common engraved default).
 */
const sideOf = (spanned: readonly SpanNote[]): SlurSide => {
  const ups = spanned.filter((note) => note.stemDirection === StemDirection.Up).length;
  const downs = spanned.filter((note) => note.stemDirection === StemDirection.Down).length;

  return ups > downs ? 'Under' : 'Over';
};

/**
 * The cubic bézier through the two endpoints whose apex clears every spanned
 * element by the span clearance. With equal control-point heights the apex
 * sits at (y1 + y2)/8 + 3·cy/4, which inverts to the control height.
 */
const arcOver = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  side: SlurSide,
  spanned: readonly SpanNote[],
): LaidOutArc => {
  const length = Math.max(x2 - x1, 1);
  const rise = riseOf(length);

  const apex =
    side === 'Over'
      ? Math.min(
          Math.min(y1, y2) - rise,
          Math.min(...spanned.map((note) => note.top)) - spanClearance,
        )
      : Math.max(
          Math.max(y1, y2) + rise,
          Math.max(...spanned.map((note) => note.bottom)) + spanClearance,
        );

  const cy = (apex - (y1 + y2) / 8) * (4 / 3);

  return {
    x1,
    y1,
    cx1: x1 + length * controlInset,
    cy1: cy,
    cx2: x2 - length * controlInset,
    cy2: cy,
    x2,
    y2,
  };
};

export const Slurs = {
  /**
   * Resolves every slur of every staff and voice into arcs attached to the
   * systems. Slur roles pair on a stack walked through each voice in score
   * order (the domain cannot distinguish nested or overlapping slurs yet, so
   * pairing is strictly innermost-first, matching Score.check). An unpaired
   * Begin or End — a draft mid-edit — is silently dropped. A slur whose ends
   * sit on different systems splits into an open-ended arc at each side.
   *
   * The arc spans notehead centers, sits past the spanned notes' stems, and
   * lifts its apex until it clears everything it covers.
   */
  attach(score: Score, systems: readonly LaidOutSystem[]): LaidOutSystem[] {
    /** Sounded elements per staff:voice, in score order */
    const chains = new Map<string, SpanNote[]>();

    systems.forEach((system, systemIndex) => {
      system.measures.forEach((entry) => {
        entry.staves.forEach((staffMeasure, staffIndex) => {
          staffMeasure.elements.forEach((element) => {
            if (element.kind !== 'note' && element.kind !== 'chord') return;

            const domain =
              score.measures[element.address.measure]?.contents[staffIndex]?.voices[
                element.address.voice
              ]?.elements[element.address.element];

            if (!domain || (domain.kind !== 'note' && domain.kind !== 'chord')) return;

            const chainKey = `${staffIndex}:${element.address.voice}`;
            const chain = chains.get(chainKey) ?? [];

            chain.push(spanNoteOf(element, systemIndex, entry.x + element.x, domain.slur));
            chains.set(chainKey, chain);
          });
        });
      });
    });

    const slurs = systems.map((): LaidOutStaffArc[] => []);

    chains.forEach((chain, chainKey) => {
      const staff = Number(chainKey.split(':')[0]);
      const open: number[] = [];

      chain.forEach((note, index) => {
        const role = note.slur;

        if (role === SlurRole.End || role === SlurRole.Both) {
          const startIndex = open.pop();

          if (startIndex !== undefined) {
            const start = chain[startIndex];
            const spanned = chain.slice(startIndex, index + 1);
            const side = sideOf(spanned);
            const drop = side === 'Over' ? -endpointClearance : endpointClearance;

            const x1 = start.x + start.noteheadWidth / 2;
            const y1 = (side === 'Over' ? start.top : start.bottom) + drop;
            const x2 = note.x + note.noteheadWidth / 2;
            const y2 = (side === 'Over' ? note.top : note.bottom) + drop;

            if (start.systemIndex === note.systemIndex) {
              slurs[start.systemIndex].push({
                ...arcOver(x1, y1, x2, y2, side, spanned),
                staff,
              });
            } else {
              const startSystem = systems[start.systemIndex];
              const outgoing = spanned.filter((n) => n.systemIndex === start.systemIndex);
              const incoming = spanned.filter((n) => n.systemIndex === note.systemIndex);

              slurs[start.systemIndex].push({
                ...arcOver(x1, y1, startSystem.width - edgeMargin, y1, side, outgoing),
                staff,
              });
              slurs[note.systemIndex].push({
                ...arcOver(x2 - reopeningLength, y2, x2, y2, side, incoming),
                staff,
              });
            }
          }
        }

        if (role === SlurRole.Begin || role === SlurRole.Both) {
          open.push(index);
        }
      });
    });

    return systems.map((system, systemIndex) => ({ ...system, slurs: slurs[systemIndex] }));
  },
};
