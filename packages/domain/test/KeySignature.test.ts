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
      KeySignature.ofTonic(PitchClass.of(PitchLetter.B, Accidental.Flat), Mode.Major),
    );
    // Two flats, named: the signature is the count, the name is the naming
    expect(bFlatMajor).toEqual({ fifths: -2, mode: 'Major' });
    expect(KeySignature.tonic(bFlatMajor)).toEqual({ letter: 'B', accidental: 'Flat' });

    expectOk(KeySignature.ofTonic(PitchClass.of(PitchLetter.C), Mode.Major));
    expectOk(KeySignature.ofTonic(PitchClass.of(PitchLetter.D, Accidental.Sharp), Mode.Minor));
  });

  it('rejects non-standard signatures with a formatted name', () => {
    const error = expectInvalid(
      KeySignature.ofTonic(PitchClass.of(PitchLetter.D, Accidental.Sharp), Mode.Major),
    );
    expect(error.messages).toEqual(['"D♯ Major" is not a standard key signature']);
  });

  it('compares by tonic and mode', () => {
    const cMajor = expectOk(KeySignature.ofTonic(PitchClass.of(PitchLetter.C), Mode.Major));
    const cMinor = expectOk(KeySignature.ofTonic(PitchClass.of(PitchLetter.C), Mode.Minor));

    expect(
      KeySignature.equals(
        cMajor,
        expectOk(KeySignature.ofTonic(PitchClass.of(PitchLetter.C), Mode.Major)),
      ),
    ).toBe(true);
    expect(KeySignature.equals(cMajor, cMinor)).toBe(false);
  });

  it('formats as tonic and mode', () => {
    const aFlatMinor = expectOk(
      KeySignature.ofTonic(PitchClass.of(PitchLetter.A, Accidental.Flat), Mode.Minor),
    );
    expect(KeySignature.format(aFlatMinor)).toBe('A♭ Minor');
  });
});

const keyOf = (letter: PitchLetter, mode: Mode, accidental?: Accidental): KeySignature =>
  expectOk(KeySignature.ofTonic(PitchClass.of(letter, accidental), mode));

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

describe('KeySignature, with no mode stated', () => {
  it('carries the signature without inventing a key', () => {
    // MusicXML routinely gives <fifths> and no <mode> — the Haydn corpus does
    // so 20 times — and the model used to have nowhere to put that, so the
    // importer had to pick one. Its finale, in C minor, arrived as E♭ major.
    const threeFlats = expectOk(KeySignature.create(-3));

    expect(threeFlats.mode).toBeUndefined();
    expect(KeySignature.tonic(threeFlats)).toBeUndefined();
  });

  it('prints and implies exactly what the named key does', () => {
    const threeFlats = expectOk(KeySignature.create(-3));
    const eFlatMajor = expectOk(
      KeySignature.ofTonic(PitchClass.of(PitchLetter.E, Accidental.Flat), Mode.Major),
    );
    const cMinor = expectOk(KeySignature.ofTonic(PitchClass.of(PitchLetter.C), Mode.Minor));

    // All three are three flats, which is the whole reason the mode is optional
    expect(KeySignature.accidentals(threeFlats)).toEqual(KeySignature.accidentals(eFlatMajor));
    expect(KeySignature.accidentals(threeFlats)).toEqual(KeySignature.accidentals(cMinor));
    expect(KeySignature.impliedAccidental(threeFlats, PitchLetter.E)).toBe(Accidental.Flat);
  });

  it('says how many rather than naming a key it does not know', () => {
    expect(KeySignature.format(expectOk(KeySignature.create(-3)))).toBe('3 flats');
    expect(KeySignature.format(expectOk(KeySignature.create(1)))).toBe('1 sharp');
    expect(KeySignature.format(expectOk(KeySignature.create(0)))).toBe('no sharps or flats');
  });

  it('is not equal to the same signature that names a key', () => {
    // They print identically and are different statements
    const bare = expectOk(KeySignature.create(-3));
    const named = expectOk(KeySignature.ofTonic(PitchClass.of(PitchLetter.C), Mode.Minor));

    expect(KeySignature.equals(bare, named)).toBe(false);
  });

  it('refuses a count no signature can carry', () => {
    expect(expectInvalid(KeySignature.create(8)).messages).toEqual([
      'A key signature carries 0 to 7 sharps or flats, not 8',
    ]);
  });
});
