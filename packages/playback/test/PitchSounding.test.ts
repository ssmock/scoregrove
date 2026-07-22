import { describe, expect, it } from 'vitest';
import { KeySignature, Mode } from '@scoregrove/domain/KeySignature';
import { Accidental, Octave, Pitch, PitchClass, PitchLetter } from '@scoregrove/domain/Pitch';
import { PitchSounding } from '../src/PitchSounding';

const key = (letter: PitchLetter, mode: Mode, accidental?: Accidental): KeySignature => ({
  tonic: PitchClass.of(letter, accidental),
  mode,
});

const pitch = (letter: PitchLetter, octave: number, accidental?: Accidental): Pitch =>
  Pitch.of(PitchClass.of(letter, accidental), Octave.of(octave));

const cMajor = key(PitchLetter.C, Mode.Major);
const gMajor = key(PitchLetter.G, Mode.Major);

describe('PitchSounding.pitchNumber', () => {
  it('uses standard MIDI numbering', () => {
    expect(PitchSounding.pitchNumber(pitch(PitchLetter.C, 4), cMajor)).toBe(60);
    expect(PitchSounding.pitchNumber(pitch(PitchLetter.A, 4), cMajor)).toBe(69);
    expect(PitchSounding.pitchNumber(pitch(PitchLetter.C, 5), cMajor)).toBe(72);
  });

  it('is key-aware: a bare F in G major sounds F♯', () => {
    expect(PitchSounding.pitchNumber(pitch(PitchLetter.F, 4), gMajor)).toBe(
      PitchSounding.pitchNumber(pitch(PitchLetter.F, 4, Accidental.Sharp), gMajor),
    );
    // and one semitone above the C-major reading of the same written note
    expect(PitchSounding.pitchNumber(pitch(PitchLetter.F, 4), gMajor)).toBe(
      PitchSounding.pitchNumber(pitch(PitchLetter.F, 4), cMajor) + 1,
    );
  });
});

describe('PitchSounding.frequency', () => {
  it('tunes A4 to 440 Hz and octaves double', () => {
    expect(PitchSounding.frequency(pitch(PitchLetter.A, 4), cMajor)).toBeCloseTo(440, 6);
    expect(PitchSounding.frequency(pitch(PitchLetter.A, 5), cMajor)).toBeCloseTo(880, 6);
    expect(PitchSounding.frequency(pitch(PitchLetter.A, 3), cMajor)).toBeCloseTo(220, 6);
  });

  it('gives middle C ≈ 261.63 Hz', () => {
    expect(PitchSounding.frequency(pitch(PitchLetter.C, 4), cMajor)).toBeCloseTo(261.6256, 3);
  });

  it('frequencyOfNumber matches the semitone ratio', () => {
    // one semitone up multiplies frequency by the twelfth root of two
    expect(PitchSounding.frequencyOfNumber(70) / PitchSounding.frequencyOfNumber(69)).toBeCloseTo(
      2 ** (1 / 12),
      9,
    );
  });
});
