import type { KeySignature } from '@scoregrove/domain/KeySignature';
import type { Pitch } from '@scoregrove/domain/Pitch';
import { Semitone } from '@scoregrove/domain/Semitone';

/**
 * How a written pitch actually sounds — the performance mapping on top of the
 * domain's structural `Semitone.ofPitch`. `pitchNumber` pins the domain's
 * arbitrary chromatic zero to standard MIDI numbering (C4 = 60, A4 = 69), and
 * `frequency` gives the equal-tempered pitch in hertz (A4 = 440). Key-aware
 * throughout, since a bare letter's sounding pitch follows the key signature.
 */

/** The domain's chromatic number (C4 = 48) is twelve below MIDI's (C4 = 60) */
const midiOffset = 12;

/** MIDI number of A4, the 440 Hz reference */
const referenceMidi = 69;
const referenceHz = 440;

export const PitchSounding = {
  /** The MIDI note number a written pitch sounds, under `key` (C4 = 60, A4 = 69) */
  pitchNumber(pitch: Pitch, key: KeySignature): number {
    return Semitone.ofPitch(pitch, key) + midiOffset;
  },

  /** The equal-tempered frequency in hertz for a MIDI note number (A4 = 69 → 440) */
  frequencyOfNumber(pitchNumber: number): number {
    return referenceHz * 2 ** ((pitchNumber - referenceMidi) / 12);
  },

  /** The equal-tempered frequency in hertz a written pitch sounds, under `key` */
  frequency(pitch: Pitch, key: KeySignature): number {
    return PitchSounding.frequencyOfNumber(PitchSounding.pitchNumber(pitch, key));
  },
};
