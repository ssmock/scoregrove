import { Duration, NoteValue } from '@scoregrove/domain/Duration';
import { Fraction } from '@scoregrove/domain/Fraction';
import type { MeasureElement } from '@scoregrove/domain/MeasureElement';
import { BeatUnit, type TimeSignature } from '@scoregrove/domain/TimeSignature';
import { StemDirection } from './Stems';

/**
 * How many beams (or flags) each note value carries; zero for quarter notes
 * and longer, which never beam.
 */
const beamCounts: Partial<Record<NoteValue, number>> = {
  Eighth: 1,
  Sixteenth: 2,
  ThirtySecond: 3,
  SixtyFourth: 4,
};

/**
 * A run of beamable notes sharing one beam, as indices into the voice's
 * element sequence.
 */
export type BeamGroup = {
  elements: readonly number[];
};

/**
 * One beam line before thickness is applied: its endpoints in staff spaces
 * and its level (1 is the primary beam, 2 the sixteenth beam, and so on,
 * stacking toward the noteheads).
 */
export type BeamLine = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  level: number;
};

/**
 * The beat span that bounds a beam group: one beat of the time signature,
 * except in compound meters (an eighth beat unit in threes), where beams
 * group by the dotted beat.
 */
const groupSpan = (time: TimeSignature): Fraction => {
  if (time.beatUnit === BeatUnit.Eighth && time.beats % 3 === 0) return Fraction.of(3, 8);

  return Fraction.of(1, BeatUnit.numeral(time.beatUnit));
};

/** Which span an onset falls into, using exact integer arithmetic */
const spanIndex = (onset: Fraction, span: Fraction): number =>
  Math.floor((onset.numerator * span.denominator) / (onset.denominator * span.numerator));

/** The least stem length inside a beamed group, in staff spaces */
const minimumStem = 3.25;

/** The stem length the beam line starts from at the first note */
const idealStem = 3.5;

/** The most a beam may rise or fall across its group, in staff spaces */
const maximumRise = 1;

/** Vertical distance between beam levels: one thickness plus the gap */
const levelSpacing = 0.75;

/**
 * How far a fractional (stub) beam reaches from its stem, in staff spaces.
 * Never more than half the distance to the neighbour it points at, so two
 * stubs facing each other cannot meet and read as a full beam.
 */
const stubReach = 1.25;

export const Beaming = {
  beamCount(noteValue: NoteValue): number {
    return beamCounts[noteValue] ?? 0;
  },

  /**
   * Derives beam groups from the time signature's beat structure, as the
   * strategy prescribes (beaming is derived, not stored): consecutive
   * beamable notes and chords whose onsets share a beat span beam together;
   * rests, dynamics, longer notes, and span boundaries break the group. Groups
   * of one keep their flag and are not reported.
   */
  groups(elements: readonly MeasureElement[], time: TimeSignature): BeamGroup[] {
    const span = groupSpan(time);
    const groups: BeamGroup[] = [];

    let onset = Fraction.zero();
    let current: number[] = [];
    let currentSpan = -1;

    const close = () => {
      if (current.length >= 2) groups.push({ elements: current });

      current = [];
      currentSpan = -1;
    };

    elements.forEach((element, index) => {
      if (element.kind === 'dynamic') return;

      // A chord beams exactly as a note does: it has one written duration and
      // one stem, and the several noteheads hanging off that stem change where
      // the beam sits, not whether there is one.
      const beamable =
        (element.kind === 'note' || element.kind === 'chord') &&
        Beaming.beamCount(element.duration.noteValue) > 0;

      if (beamable) {
        const index_ = spanIndex(onset, span);

        if (currentSpan !== -1 && index_ !== currentSpan) close();

        current.push(index);
        currentSpan = index_;
      } else {
        close();
      }

      onset = Fraction.add(onset, Duration.fractionOfWhole(element.duration));
    });

    close();

    return groups;
  },

  /**
   * The geometry of one beamed group: where each stem must end, and the beam
   * lines. The beam slants with the outer noteheads, clamped, then shifts until
   * every stem keeps its minimum length.
   *
   * ## Secondary beams, full and fractional
   *
   * A secondary level spanning two or more adjacent notes is a full beam
   * between them. A level belonging to **one** note is a *fractional* beam — a
   * stub — and without it a dotted-eighth–sixteenth pair prints as two notes
   * that look like eighths, which is not a spacing quibble but the wrong
   * rhythm on the page.
   *
   * **Which way a stub points** is the only real decision. It points back at
   * the note before it, except at the start of a group where there is nothing
   * behind it and it must point forward. That is the conventional default and
   * it gets the two common figures right: the sixteenth of a dotted-eighth pair
   * points back at the dotted eighth, and the sixteenth that *opens* a pair
   * points forward at what follows.
   */
  geometry(args: {
    /** One entry per note in the group, in x order */
    stems: readonly { x: number; noteY: number; count: number }[];
    direction: StemDirection;
  }): { tips: number[]; lines: BeamLine[] } {
    const { stems, direction } = args;
    const up = direction === StemDirection.Up;
    const sign = up ? -1 : 1;

    const first = stems[0];
    const last = stems[stems.length - 1];

    const rise = Math.min(maximumRise, Math.max(-maximumRise, (last.noteY - first.noteY) / 2));
    const slope = last.x === first.x ? 0 : rise / (last.x - first.x);

    /** The beam line through the first note's ideal tip, before shifting */
    const lineAt = (x: number, shift: number): number =>
      first.noteY + sign * idealStem + slope * (x - first.x) + shift;

    /**
     * Shift the line away from the noteheads until every stem is at least
     * the minimum length.
     */
    const shift = stems.reduce((acc, stem) => {
      const room = (stem.noteY + sign * minimumStem - lineAt(stem.x, 0)) * sign;

      return room > 0 ? Math.max(acc, room) : acc;
    }, 0);

    const tips = stems.map((stem) => lineAt(stem.x, sign * shift));

    const lines: BeamLine[] = [
      {
        x1: first.x,
        y1: tips[0],
        x2: last.x,
        y2: tips[tips.length - 1],
        level: 1,
      },
    ];

    const maxLevel = Math.max(...stems.map((stem) => stem.count));

    for (let level = 2; level <= maxLevel; level += 1) {
      let runStart = -1;

      stems.forEach((stem, index) => {
        const qualifies = stem.count >= level;

        if (qualifies && runStart === -1) runStart = index;

        const runEnds = runStart !== -1 && (!qualifies || index === stems.length - 1);

        if (!runEnds) return;

        const runEnd = qualifies ? index : index - 1;
        const offset = -sign * (level - 1) * levelSpacing;

        if (runEnd > runStart) {
          lines.push({
            x1: stems[runStart].x,
            y1: tips[runStart] + offset,
            x2: stems[runEnd].x,
            y2: tips[runEnd] + offset,
            level,
          });
        } else {
          // One note carries this level alone, so it gets a stub rather than
          // nothing. Half the gap to the neighbour caps the reach, which keeps
          // two facing stubs from meeting and reading as a full beam.
          const at = stems[runStart];
          const forward = runStart === 0;
          const neighbour = stems[forward ? runStart + 1 : runStart - 1];
          const reach = Math.min(stubReach, Math.abs(neighbour.x - at.x) / 2);
          const x1 = forward ? at.x : at.x - reach;
          const x2 = forward ? at.x + reach : at.x;
          const y = tips[runStart] + offset;

          lines.push({
            x1,
            y1: y + slope * (x1 - at.x),
            x2,
            y2: y + slope * (x2 - at.x),
            level,
          });
        }

        runStart = -1;
      });
    }

    return { tips, lines };
  },
};
