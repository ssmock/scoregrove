/**
 * One note asked of an instrument: a frequency to sound, when to begin (in the
 * audio clock's seconds), how long to hold, and how hard to strike (0–1).
 * Frequency, not a pitch number, so the instrument stays ignorant of notation.
 *
 * Deliberately **not** called `Voice`, which it was until the ensemble arrived.
 * The domain already uses that word for a melodic line within a staff, and it
 * is also the natural word for one of a quartet's four players — three meanings
 * of one word, in a codebase that has all three.
 *
 * `staff` is the only notational thing here, and it earns its place: it is what
 * an `Ensemble` routes on. A lone instrument ignores it, exactly as it ignores
 * which measure a note came from.
 */
export type Tone = {
  frequency: number;
  startTime: number;
  durationSeconds: number;
  velocity: number;
  /** The staff this note was written on; an ensemble maps it to a player */
  staff: number;
};

/**
 * The seam between the transport (which decides *what* sounds *when*) and the
 * audio graph (which decides *how* it sounds). The oscillator synth is the v1
 * implementation; a sampled or SoundFont instrument could replace it behind
 * this same interface without the transport changing — and an `Ensemble` of
 * several instruments satisfies it too, which is how four players reach a
 * transport that still holds a single object.
 */
export type Instrument = {
  /** Schedules one tone at a sample-accurate audio-clock time. */
  schedule(tone: Tone): void;

  /** Immediately silences and cancels every tone — for stop, pause, and seek. */
  stopAll(): void;
};
