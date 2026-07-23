import { Fraction } from '@scoregrove/domain/Fraction';
import type { Score } from '@scoregrove/domain/Score';
import type { Tempo } from '@scoregrove/domain/Tempo';
import type { TimeSignature } from '@scoregrove/domain/TimeSignature';
import { addressKey, type BeatEvent, type EventAddress } from './EventFlattening';
import { measureContentLength } from './MeasureTiming';
import type { PlayStep } from './NavigationUnfolding';
import { TempoResolution, type ResolvedTempo } from './TempoResolution';

/**
 * The stage that turns beat time into seconds. It builds a **tempo map** over
 * the unfolded play order — one segment per performed measure, each holding
 * that measure's start (in beats and seconds) and its whole-note length in
 * seconds — then places every beat event onto real time. This is the single
 * deliberate exact→inexact boundary of the pipeline: beats are exact
 * `Fraction`s up to here; seconds are floating point beyond it.
 *
 * Tempo is resolved per written measure with the prevailing absolute tempo
 * carried forward: a marking or metronome mark sets it, a `TempoChange`
 * (accel./rit.) inherits it (its gradual ramp is not performed yet — see
 * playback.md), and an untempo'd score defaults to Moderato. A resolved tempo
 * locks its bpm and beat note value where stated; a later meter change alone
 * does not re-resolve it.
 */

/** Loudness for an event whose address isn't in the velocities map (or when none is supplied). */
const fallbackVelocity = 0.7;

/** One measure's span in the performance, in both beats and seconds, at a constant tempo. */
export type TempoSegment = {
  beatStart: Fraction;
  beatEnd: Fraction;
  secondsStart: number;
  /** Seconds per whole note within this measure */
  wholeNoteSeconds: number;
};

export type TempoMap = {
  segments: readonly TempoSegment[];
  durationSeconds: number;
};

/** The real-time span of a measure's first performance in the play order. */
export type MeasureTime = {
  startSeconds: number;
  endSeconds: number;
};

/** A sounded pitch placed in real time — the `Performance`'s unit. */
export type NoteEvent = {
  startSeconds: number;
  durationSeconds: number;
  pitchNumber: number;
  velocity: number;
  address: EventAddress;
};

const fractionToNumber = (fraction: Fraction): number => fraction.numerator / fraction.denominator;

/**
 * The resolved absolute tempo in force at each written measure, prevailing
 * tempo carried forward. A change indication keeps the prevailing tempo (it
 * resolves to `undefined`); before any absolute tempo, the default is used.
 */
const resolvedTempos = (score: Score): ResolvedTempo[] => {
  let time: TimeSignature = score.time;
  let prevailing: ResolvedTempo | undefined;

  const apply = (tempo: Tempo | undefined): void => {
    if (!tempo) return;

    const resolved = TempoResolution.resolve(tempo, time);

    if (resolved) prevailing = resolved;
  };

  return score.measures.map((measure, index) => {
    time = measure.time ?? time;

    if (index === 0) apply(score.tempo);
    apply(measure.tempo);

    return prevailing ?? TempoResolution.defaultTempo(time);
  });
};

export const TimeMapping = {
  /**
   * The tempo map for a score along its play order: a segment per performed
   * measure, plus the total duration in seconds. `secondsAt` reads positions
   * off it.
   */
  build(score: Score, playOrder: readonly PlayStep[]): TempoMap {
    const tempos = resolvedTempos(score);
    const segments: TempoSegment[] = [];

    let beatCursor = Fraction.zero();
    let secondsCursor = 0;

    for (const step of playOrder) {
      const measure = score.measures[step.measureIndex];
      const wholeNoteSeconds = TempoResolution.wholeNoteSeconds(tempos[step.measureIndex]);
      const length = measureContentLength(measure);
      const beatEnd = Fraction.add(beatCursor, length);

      segments.push({
        beatStart: beatCursor,
        beatEnd,
        secondsStart: secondsCursor,
        wholeNoteSeconds,
      });

      secondsCursor += fractionToNumber(length) * wholeNoteSeconds;
      beatCursor = beatEnd;
    }

    return { segments, durationSeconds: secondsCursor };
  },

  /**
   * The real-time span of each measure's *first* occurrence in the play order,
   * indexed by measure index. Repeated measures keep their earliest slot — the
   * anchor for seeking to a bar or looping over a passage. (Segments are 1:1
   * with the play order, so `segments[i]` is `playOrder[i]`'s occurrence.)
   */
  measureTimes(playOrder: readonly PlayStep[], map: TempoMap): MeasureTime[] {
    const times: MeasureTime[] = [];

    playOrder.forEach((step, index) => {
      const segment = map.segments[index];

      if (!segment || times[step.measureIndex] !== undefined) return;

      times[step.measureIndex] = {
        startSeconds: segment.secondsStart,
        endSeconds: TimeMapping.secondsAt(map, segment.beatEnd),
      };
    });

    return times;
  },

  /**
   * The real-time position of a beat. Within a segment, seconds advance
   * linearly at that measure's rate; at a segment boundary both sides agree,
   * and the end of the piece maps to its total duration.
   */
  secondsAt(map: TempoMap, beat: Fraction): number {
    const { segments } = map;

    if (segments.length === 0) return 0;

    // The last segment whose start is at or before `beat` (binary search).
    let lo = 0;
    let hi = segments.length - 1;

    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);

      if (Fraction.compare(segments[mid].beatStart, beat) <= 0) lo = mid;
      else hi = mid - 1;
    }

    const segment = segments[lo];
    const offsetBeats = fractionToNumber(Fraction.subtract(beat, segment.beatStart));

    return segment.secondsStart + offsetBeats * segment.wholeNoteSeconds;
  },

  /**
   * Places beat events onto real time through `map`. A folded (tied) event's
   * end is mapped the same way, so a note spanning measures at different
   * tempos gets the right total. `velocities` (keyed by `addressKey`) supplies
   * each note's loudness from the dynamics resolution; absent, everything
   * sounds at a uniform fallback.
   */
  toNoteEvents(
    beatEvents: readonly BeatEvent[],
    map: TempoMap,
    velocities?: ReadonlyMap<string, number>,
  ): NoteEvent[] {
    return beatEvents.map((event) => {
      const startSeconds = TimeMapping.secondsAt(map, event.startBeat);
      const endSeconds = TimeMapping.secondsAt(
        map,
        Fraction.add(event.startBeat, event.durationBeats),
      );

      return {
        startSeconds,
        durationSeconds: endSeconds - startSeconds,
        pitchNumber: event.pitchNumber,
        velocity: velocities?.get(addressKey(event.address)) ?? fallbackVelocity,
        address: event.address,
      };
    });
  },
};
