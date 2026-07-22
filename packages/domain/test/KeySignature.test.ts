import { describe, expect, it } from 'vitest';
import { KeySignature, Mode } from '../src/KeySignature';
import { Accidental, PitchClass, PitchLetter } from '../src/Pitch';
import { expectInvalid, expectOk, expectVocabulary } from './helpers';

describe('Mode', () => {
  it('covers major and minor', () => {
    expectVocabulary(Mode, ['Major', 'Minor']);
  });
});

describe('KeySignature', () => {
  it('lists fifteen standard tonics per mode', () => {
    expect(KeySignature.standardTonics(Mode.Major)).toHaveLength(15);
    expect(KeySignature.standardTonics(Mode.Minor)).toHaveLength(15);
  });

  it('orders tonics by accidental count starting from the plain key', () => {
    expect(KeySignature.standardTonics(Mode.Major)[0]).toEqual({ letter: 'C' });
    expect(KeySignature.standardTonics(Mode.Minor)[0]).toEqual({ letter: 'A' });
  });

  it('creates standard signatures', () => {
    const bFlatMajor = expectOk(
      KeySignature.create(PitchClass.of(PitchLetter.B, Accidental.Flat), Mode.Major),
    );
    expect(bFlatMajor).toEqual({ tonic: { letter: 'B', accidental: 'Flat' }, mode: 'Major' });

    expectOk(KeySignature.create(PitchClass.of(PitchLetter.C), Mode.Major));
    expectOk(KeySignature.create(PitchClass.of(PitchLetter.D, Accidental.Sharp), Mode.Minor));
  });

  it('rejects non-standard signatures with a formatted name', () => {
    const error = expectInvalid(
      KeySignature.create(PitchClass.of(PitchLetter.D, Accidental.Sharp), Mode.Major),
    );
    expect(error.messages).toEqual(['"D♯ Major" is not a standard key signature']);
  });

  it('compares by tonic and mode', () => {
    const cMajor = expectOk(KeySignature.create(PitchClass.of(PitchLetter.C), Mode.Major));
    const cMinor = expectOk(KeySignature.create(PitchClass.of(PitchLetter.C), Mode.Minor));

    expect(
      KeySignature.equals(
        cMajor,
        expectOk(KeySignature.create(PitchClass.of(PitchLetter.C), Mode.Major)),
      ),
    ).toBe(true);
    expect(KeySignature.equals(cMajor, cMinor)).toBe(false);
  });

  it('formats as tonic and mode', () => {
    const aFlatMinor = expectOk(
      KeySignature.create(PitchClass.of(PitchLetter.A, Accidental.Flat), Mode.Minor),
    );
    expect(KeySignature.format(aFlatMinor)).toBe('A♭ Minor');
  });
});

const keyOf = (letter: PitchLetter, mode: Mode, accidental?: Accidental): KeySignature => ({
  tonic: PitchClass.of(letter, accidental),
  mode,
});

describe('KeySignature.accidentals', () => {
  it('is empty for C major and A minor', () => {
    expect(KeySignature.accidentals(keyOf(PitchLetter.C, Mode.Major))).toBeUndefined();
    expect(KeySignature.accidentals(keyOf(PitchLetter.A, Mode.Minor))).toBeUndefined();
  });

  it('accumulates sharps in fifths order', () => {
    expect(KeySignature.accidentals(keyOf(PitchLetter.G, Mode.Major))).toEqual({
      accidental: Accidental.Sharp,
      letters: [PitchLetter.F],
    });

    expect(KeySignature.accidentals(keyOf(PitchLetter.A, Mode.Major))).toEqual({
      accidental: Accidental.Sharp,
      letters: [PitchLetter.F, PitchLetter.C, PitchLetter.G],
    });
  });

  it('accumulates flats in fourths order, minor keys included', () => {
    expect(KeySignature.accidentals(keyOf(PitchLetter.E, Mode.Major, Accidental.Flat))).toEqual({
      accidental: Accidental.Flat,
      letters: [PitchLetter.B, PitchLetter.E, PitchLetter.A],
    });

    expect(KeySignature.accidentals(keyOf(PitchLetter.D, Mode.Minor))).toEqual({
      accidental: Accidental.Flat,
      letters: [PitchLetter.B],
    });
  });
});

describe('KeySignature.impliedAccidental', () => {
  it('reports the accidental a key implies for a letter, or undefined', () => {
    const gMajor = keyOf(PitchLetter.G, Mode.Major);

    expect(KeySignature.impliedAccidental(gMajor, PitchLetter.F)).toBe(Accidental.Sharp);
    expect(KeySignature.impliedAccidental(gMajor, PitchLetter.C)).toBeUndefined();
    expect(
      KeySignature.impliedAccidental(keyOf(PitchLetter.C, Mode.Major), PitchLetter.F),
    ).toBeUndefined();
  });
});
