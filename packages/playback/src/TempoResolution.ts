import { Duration, NoteValue } from '@scoregrove/domain/Duration';
import { MetronomeMark, Tempo, TempoMarking } from '@scoregrove/domain/Tempo';
import type { TimeSignature } from '@scoregrove/domain/TimeSignature';

/**
 * The first stage of the performance pipeline: turning a written `Tempo` into
 * a concrete speed. A `MetronomeMark` already is one (it carries an exact
 * `bpm` on its own note value). An Italian `TempoMarking` carries only a
 * name, so it is looked up in the default table below and counted on the
 * measure's metric pulse. A `TempoChange` (accel./rit.) is *not* an absolute
 * tempo — it inherits the prevailing one — so it resolves to `undefined`
 * here; carrying the prevailing tempo forward across measures is the future
 * tempo-map layer's job, not this pure per-indication resolver's.
 *
 * All of this is interpretation, not notation, which is why it lives in
 * playback and not the domain — the table and pulse rules are freely
 * retunable performance parameters.
 */

/**
 * The default beats-per-minute for each Italian marking, slowest to fastest.
 * A representative single value per marking (real markings span a range);
 * used only as the fallback when no exact `MetronomeMark` is in force.
 */
const markingBpm: Record<TempoMarking, number> = {
  Larghissimo: 24,
  Grave: 35,
  Largo: 50,
  Larghetto: 63,
  Adagio: 71,
  Adagietto: 78,
  Andante: 92,
  Andantino: 100,
  Moderato: 112,
  Allegretto: 118,
  Allegro: 132,
  Vivace: 150,
  Vivacissimo: 168,
  Presto: 184,
  Prestissimo: 200,
};

/** What an untempo'd score plays at — a neutral middle, resolved through the same table and pulse logic. */
const defaultMarking: TempoMarking = TempoMarking.Moderato;

/**
 * One tier longer on the note-value ladder, for building a compound meter's
 * dotted pulse from its denominator (6/8's eighth denominator → a quarter,
 * which dotted spans the three eighths of one beat). Only the denominators a
 * compound meter can take need an entry.
 */
const oneTierLonger: Partial<Record<NoteValue, NoteValue>> = {
  [NoteValue.Eighth]: NoteValue.Quarter,
  [NoteValue.Sixteenth]: NoteValue.Eighth,
  [NoteValue.ThirtySecond]: NoteValue.Sixteenth,
};

/**
 * Whether the meter is compound: the beat is a dotted grouping of three
 * denominator units, not the denominator itself. The conventional test —
 * a numerator that is a multiple of three and at least six (6/8, 9/8, 12/8,
 * 6/16, …) over an eighth-or-shorter denominator. 3/8 stays simple (felt in
 * three), and 6/4 stays simple (its quarter denominator has no compound
 * grouping here) — both documented simplifications.
 */
const isCompound = (time: TimeSignature): boolean =>
  time.beats % 3 === 0 && time.beats >= 6 && time.beatUnit in oneTierLonger;

/** A resolved, sounding tempo: how many `beat`s pass per minute. */
export type ResolvedTempo = {
  bpm: number;
  /** The note value one beat spans (a dotted quarter in compound time, the metronome mark's own value for an exact mark) */
  beat: Duration;
};

export const TempoResolution = {
  /** The default marking→BPM table, exposed for inspection and tuning */
  markingBpm,

  /** The marking an untempo'd score defaults to */
  defaultMarking,

  /**
   * The metric pulse of a meter: the note value a listener counts. Simple
   * meters count the denominator (a quarter in x/4, a half in x/2); compound
   * meters count the dotted grouping of three denominator units (a dotted
   * quarter in 6/8). This is the "musically correct unit" a marking's BPM is
   * counted on.
   */
  metricBeat(time: TimeSignature): Duration {
    if (isCompound(time)) {
      return Duration.of(oneTierLonger[time.beatUnit]!, { dots: 1 });
    }

    return Duration.of(time.beatUnit);
  },

  /**
   * The sounding tempo of one indication, or `undefined` when it is not an
   * absolute tempo (a `TempoChange`, which inherits the prevailing one). An
   * exact `MetronomeMark` resolves to its own bpm and note value, ignoring
   * the meter; a `TempoMarking` resolves to its table value counted on the
   * meter's metric pulse.
   */
  resolve(tempo: Tempo, time: TimeSignature): ResolvedTempo | undefined {
    if (MetronomeMark.is(tempo)) {
      return {
        bpm: tempo.bpm,
        beat: tempo.dots
          ? Duration.of(tempo.noteValue, { dots: tempo.dots })
          : Duration.of(tempo.noteValue),
      };
    }

    if (Tempo.isMarking(tempo)) {
      return { bpm: markingBpm[tempo], beat: TempoResolution.metricBeat(time) };
    }

    return undefined;
  },

  /** The tempo an untempo'd score (or one carrying only a change) falls back to: the default marking on the meter's pulse. */
  defaultTempo(time: TimeSignature): ResolvedTempo {
    return { bpm: markingBpm[defaultMarking], beat: TempoResolution.metricBeat(time) };
  },

  /**
   * How long a whole note lasts, in seconds, at a resolved tempo — the single
   * scalar the event stage multiplies each element's exact `fractionOfWhole`
   * by. One beat lasts `60 / bpm` seconds and spans `fractionOfWhole(beat)`
   * of a whole note, so the whole note is that beat length divided by the
   * beat's share of it. This is the deliberate exact→inexact boundary: the
   * beat's length is an exact `Fraction`, the seconds are floating point.
   */
  wholeNoteSeconds(resolved: ResolvedTempo): number {
    const beatFraction = Duration.fractionOfWhole(resolved.beat);
    const beatShareOfWhole = beatFraction.numerator / beatFraction.denominator;

    return 60 / resolved.bpm / beatShareOfWhole;
  },
};
