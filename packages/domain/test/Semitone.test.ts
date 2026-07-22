import { describe, expect, it } from 'vitest';
import { KeySignature, Mode } from '../src/KeySignature';
import { Accidental, Octave, Pitch, PitchClass, PitchLetter } from '../src/Pitch';
import { Semitone } from '../src/Semitone';

const key = (letter: PitchLetter, mode: Mode, accidental?: Accidental): KeySignature => ({
  tonic: PitchClass.of(letter, accidental),
  mode,
});

const pitch = (letter: PitchLetter, octave: number, accidental?: Accidental): Pitch =>
  Pitch.of(PitchClass.of(letter, accidental), Octave.of(octave));

const cMajor = key(PitchLetter.C, Mode.Major);
const gMajor = key(PitchLetter.G, Mode.Major);

describe('Semitone.ofLetter / ofAccidental', () => {
  it('gives natural-letter semitones and accidental shifts', () => {
    expect(Semitone.ofLetter(PitchLetter.C)).toBe(0);
    expect(Semitone.ofLetter(PitchLetter.G)).toBe(7);
    expect(Semitone.ofLetter(PitchLetter.B)).toBe(11);

    expect(Semitone.ofAccidental(Accidental.Flat)).toBe(-1);
    expect(Semitone.ofAccidental(Accidental.Natural)).toBe(0);
    expect(Semitone.ofAccidental(Accidental.DoubleSharp)).toBe(2);
  });
});

describe('Semitone.effective', () => {
  it('follows the key when a pitch omits its accidental', () => {
    // a bare F in G major sounds as F♯
    expect(Semitone.effective(PitchClass.of(PitchLetter.F), gMajor)).toBe(
      Semitone.effective(PitchClass.of(PitchLetter.F, Accidental.Sharp), gMajor),
    );
    // but a bare F in C major is F-natural
    expect(Semitone.effective(PitchClass.of(PitchLetter.F), cMajor)).toBe(5);
  });

  it('lets an explicit accidental (including natural) override the key', () => {
    // an explicit natural cancels the key's sharp
    expect(Semitone.effective(PitchClass.of(PitchLetter.F, Accidental.Natural), gMajor)).toBe(5);
  });
});

describe('Semitone.ofPitch', () => {
  it('numbers pitches absolutely, twelve per octave (C4 = 48)', () => {
    expect(Semitone.ofPitch(pitch(PitchLetter.C, 4), cMajor)).toBe(48);
    expect(Semitone.ofPitch(pitch(PitchLetter.A, 4), cMajor)).toBe(57);
    expect(
      Semitone.ofPitch(pitch(PitchLetter.C, 5), cMajor) -
        Semitone.ofPitch(pitch(PitchLetter.C, 4), cMajor),
    ).toBe(12);
  });

  it('is key-aware: a bare F in G major sounds a semitone above C-major F', () => {
    expect(Semitone.ofPitch(pitch(PitchLetter.F, 4), gMajor)).toBe(
      Semitone.ofPitch(pitch(PitchLetter.F, 4), cMajor) + 1,
    );
  });
});
