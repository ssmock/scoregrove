/**
 * One note asked of an instrument: a frequency to sound, when to begin (in the
 * audio clock's seconds), how long to hold, and how hard to strike (0–1).
 * Frequency, not a pitch number, so the instrument stays ignorant of notation.
 */
export type Voice = {
  frequency: number;
  startTime: number;
  durationSeconds: number;
  velocity: number;
};

/**
 * The seam between the transport (which decides *what* sounds *when*) and the
 * audio graph (which decides *how* it sounds). The oscillator synth is the v1
 * implementation; a sampled or SoundFont instrument could replace it behind
 * this same interface without the transport changing.
 */
export type Instrument = {
  /** Schedules one voice at a sample-accurate audio-clock time. */
  schedule(voice: Voice): void;

  /** Immediately silences and cancels every voice — for stop, pause, and seek. */
  stopAll(): void;
};
