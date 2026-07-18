import { describe, expect, it } from 'vitest';
import { Accidental, Octave, Pitch, PitchClass, PitchLetter } from '../src/Pitch';
import { expectInvalid, expectOk, expectVocabulary } from './helpers';

describe('PitchLetter', () => {
  it('covers the musical alphabet', () => {
    expectVocabulary(PitchLetter, ['A', 'B', 'C', 'D', 'E', 'F', 'G']);
  });
});

describe('Accidental', () => {
  it('covers the five alterations', () => {
    expectVocabulary(Accidental, ['Sharp', 'Flat', 'Natural', 'DoubleSharp', 'DoubleFlat']);
  });

  it('maps each alteration to its printed symbol', () => {
    expect(Accidental.symbol(Accidental.Sharp)).toBe('♯');
    expect(Accidental.symbol(Accidental.Flat)).toBe('♭');
    expect(Accidental.symbol(Accidental.Natural)).toBe('♮');
    expect(Accidental.symbol(Accidental.DoubleSharp)).toBe('𝄪');
    expect(Accidental.symbol(Accidental.DoubleFlat)).toBe('𝄫');
  });
});

describe('Octave', () => {
  it('spans 0 through 9', () => {
    expect(Octave.min).toBe(0);
    expect(Octave.max).toBe(9);
    expect(Octave.is(0)).toBe(true);
    expect(Octave.is(4)).toBe(true);
    expect(Octave.is(9)).toBe(true);
  });

  it('rejects out-of-range and fractional values', () => {
    expect(Octave.is(-1)).toBe(false);
    expect(Octave.is(10)).toBe(false);
    expect(Octave.is(4.5)).toBe(false);
  });

  it('creates from a valid candidate', () => {
    expect(expectOk(Octave.create('Octave', 4))).toBe(4);
  });

  it('rejects an invalid candidate with the range in the message', () => {
    const error = expectInvalid(Octave.create('Octave', 10));
    expect(error.messages).toEqual(['Octave must be an integer octave between 0 and 9']);
  });
});

describe('PitchClass', () => {
  it('omits an absent accidental', () => {
    expect(PitchClass.of(PitchLetter.C)).toEqual({ letter: 'C' });
  });

  it('carries an accidental when given', () => {
    expect(PitchClass.of(PitchLetter.F, Accidental.Sharp)).toEqual({
      letter: 'F',
      accidental: 'Sharp',
    });
  });

  it('treats an explicit Natural as equal to no accidental', () => {
    const plain = PitchClass.of(PitchLetter.C);
    const natural = PitchClass.of(PitchLetter.C, Accidental.Natural);
    expect(PitchClass.equals(plain, natural)).toBe(true);
  });

  it('distinguishes letters and accidentals', () => {
    const cSharp = PitchClass.of(PitchLetter.C, Accidental.Sharp);
    expect(PitchClass.equals(cSharp, PitchClass.of(PitchLetter.C))).toBe(false);
    expect(PitchClass.equals(cSharp, PitchClass.of(PitchLetter.D, Accidental.Sharp))).toBe(false);
  });

  it('formats with the accidental symbol, omitting Natural', () => {
    expect(PitchClass.format(PitchClass.of(PitchLetter.B, Accidental.Flat))).toBe('B♭');
    expect(PitchClass.format(PitchClass.of(PitchLetter.C, Accidental.Natural))).toBe('C');
    expect(PitchClass.format(PitchClass.of(PitchLetter.G))).toBe('G');
  });
});

describe('Pitch', () => {
  const c4 = Pitch.of(PitchClass.of(PitchLetter.C), Octave.of(4));

  it('pairs a pitch class with an octave', () => {
    expect(c4).toEqual({ pitchClass: { letter: 'C' }, octave: 4 });
  });

  it('compares by pitch class and octave', () => {
    expect(Pitch.equals(c4, Pitch.of(PitchClass.of(PitchLetter.C), Octave.of(4)))).toBe(true);
    expect(Pitch.equals(c4, Pitch.of(PitchClass.of(PitchLetter.C), Octave.of(5)))).toBe(false);
    expect(Pitch.equals(c4, Pitch.of(PitchClass.of(PitchLetter.D), Octave.of(4)))).toBe(false);
  });

  it('formats in scientific pitch notation', () => {
    expect(Pitch.format(c4)).toBe('C4');
    expect(
      Pitch.format(Pitch.of(PitchClass.of(PitchLetter.F, Accidental.Sharp), Octave.of(3))),
    ).toBe('F♯3');
  });
});
