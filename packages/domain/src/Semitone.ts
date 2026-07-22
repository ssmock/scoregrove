import { KeySignature } from './KeySignature';
import type { Accidental, Pitch, PitchClass, PitchLetter } from './Pitch';

/** Each letter's semitone within its own octave, before any accidental (C = 0 … B = 11) */
const baseSemitones: Record<PitchLetter, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

/** The semitone shift each accidental applies */
const accidentalOffsets: Record<Accidental, number> = {
  DoubleFlat: -2,
  Flat: -1,
  Natural: 0,
  Sharp: 1,
  DoubleSharp: 2,
};

/**
 * Semitone arithmetic on written pitches — the bridge from notation to a
 * chromatic number, shared by editing (arrow-key stepping) and playback
 * (sounding pitch). Key-aware, because an omitted accidental follows the key
 * signature, per the domain's own convention. This is structural notation
 * math (C4 → 48); the *performance* mappings on top of it (MIDI numbering,
 * frequency) live in playback, not here.
 */
export const Semitone = {
  /** A bare letter's semitone within its octave (C = 0 … B = 11) */
  ofLetter(letter: PitchLetter): number {
    return baseSemitones[letter];
  },

  /** The semitone shift an accidental applies (Flat = −1 … DoubleSharp = +2) */
  ofAccidental(accidental: Accidental): number {
    return accidentalOffsets[accidental];
  },

  /**
   * A pitch class's semitone within its octave *as it actually sounds under
   * `key`*: an explicit accidental (including a Natural, which cancels the
   * key) always wins; an omitted one defers to whatever the key implies for
   * that letter. Getting this wrong is exactly how a bare "F" in a key that
   * implies F♯ would be mistaken for F-natural instead of the F♯ it sounds.
   */
  effective(pitchClass: PitchClass, key: KeySignature): number {
    const implied = pitchClass.accidental ?? KeySignature.impliedAccidental(key, pitchClass.letter);

    return baseSemitones[pitchClass.letter] + (implied ? accidentalOffsets[implied] : 0);
  },

  /**
   * The absolute chromatic number of a written pitch as it sounds under `key`:
   * octave times twelve plus the effective within-octave semitone (C4 → 48).
   * Only differences between two numbers are inherently meaningful here — the
   * absolute zero is arbitrary until playback pins it to MIDI/frequency.
   */
  ofPitch(pitch: Pitch, key: KeySignature): number {
    return pitch.octave * 12 + Semitone.effective(pitch.pitchClass, key);
  },
};
