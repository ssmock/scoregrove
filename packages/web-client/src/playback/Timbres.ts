/**
 * Synth settings per instrument sound — enough to tell the players apart, and
 * no more.
 *
 * Phase 4's stated bar is structural correctness: right pitches, rhythms and
 * dynamics, with synthetic timbre accepted. Sampled instruments and true bowed
 * articulation are a separate project, so these are two knobs — the waveform's
 * harmonic content and a lowpass cutoff that darkens the lower instruments —
 * chosen so a listener can hear which line is which.
 *
 * **The two violins share a sound, and that is correct.** No timbre setting
 * will separate first from second violin, because a real quartet does not
 * separate them that way either; the ear follows the line, not the colour. The
 * tool for "is this part wrong?" is muting the other three, which is why
 * `Ensemble` carries mute and solo rather than leaving them to a later phase.
 */

export type Timbre = {
  wave: OscillatorType;
  /** Lowpass corner in hertz — lower is darker */
  cutoffHz: number;
  /** Per-instrument level, so a bright wave does not drown a dark one */
  gain: number;
};

/**
 * Bowed strings are rich in harmonics, so a sawtooth through a lowpass is much
 * closer than the sine this replaces — and the cutoff, falling with the
 * instrument's range, is what makes a cello read as darker than a violin
 * rather than merely lower.
 */
const strings: Record<string, Timbre> = {
  'strings.violin': { wave: 'sawtooth', cutoffHz: 3200, gain: 0.16 },
  'strings.viola': { wave: 'sawtooth', cutoffHz: 2200, gain: 0.18 },
  'strings.cello': { wave: 'sawtooth', cutoffHz: 1400, gain: 0.2 },
  'strings.contrabass': { wave: 'sawtooth', cutoffHz: 900, gain: 0.22 },
};

/** The sound of a part that names none, and of every score with no parts at all */
export const defaultTimbre: Timbre = { wave: 'triangle', cutoffHz: 2600, gain: 0.18 };

export const Timbres = {
  /**
   * The settings for a MusicXML instrument-sound identifier. An unknown or
   * absent sound falls back rather than failing: a score that never said who
   * plays it still has to be audible.
   */
  forSound(sound?: string): Timbre {
    if (!sound) return defaultTimbre;

    return strings[sound] ?? defaultTimbre;
  },
};
