import { describe, expect, it } from 'vitest';
import { Mode, type KeySignature } from '@scoregrove/domain/KeySignature';
import { Accidental, PitchClass, PitchLetter } from '@scoregrove/domain/Pitch';
import { Result } from '@scoregrove/domain/Result';
import { PitchStepping } from '../src/PitchStepping';
import { expectInvalid, expectOk, pitch } from './helpers';

const cMajor: KeySignature = { tonic: PitchClass.of(PitchLetter.C), mode: Mode.Major };
const gMajor: KeySignature = { tonic: PitchClass.of(PitchLetter.G), mode: Mode.Major };
const fMajor: KeySignature = { tonic: PitchClass.of(PitchLetter.F), mode: Mode.Major };
const cFlatMajor: KeySignature = {
  tonic: PitchClass.of(PitchLetter.C, Accidental.Flat),
  mode: Mode.Major,
};

describe('PitchStepping.spellPitchClass', () => {
  it('spells a black-key pitch class sharp going up, flat going down, in a plain key', () => {
    expect(PitchStepping.spellPitchClass(1, cMajor, 'Up')).toEqual(
      PitchClass.of(PitchLetter.C, Accidental.Sharp),
    );
    expect(PitchStepping.spellPitchClass(1, cMajor, 'Down')).toEqual(
      PitchClass.of(PitchLetter.D, Accidental.Flat),
    );
  });

  it('prefers the key-implied spelling over direction, in both directions', () => {
    // G major implies F♯ — pitch class 6 should spell as F♯ whichever way
    // we're stepping, not G♭
    expect(PitchStepping.spellPitchClass(6, gMajor, 'Up')).toEqual(PitchClass.of(PitchLetter.F));
    expect(PitchStepping.spellPitchClass(6, gMajor, 'Down')).toEqual(PitchClass.of(PitchLetter.F));
  });

  it('prefers the key-implied flat spelling too', () => {
    // F major implies B♭ — pitch class 10 spells as B♭ either direction
    expect(PitchStepping.spellPitchClass(10, fMajor, 'Up')).toEqual(PitchClass.of(PitchLetter.B));
    expect(PitchStepping.spellPitchClass(10, fMajor, 'Down')).toEqual(PitchClass.of(PitchLetter.B));
  });

  it('spells the true natural of an altered letter with an explicit Natural', () => {
    // G major alters F; the pitch class matching plain F-natural (5) must
    // cancel that explicitly, or it would silently sound as F♯
    expect(PitchStepping.spellPitchClass(5, gMajor, 'Up')).toEqual(
      PitchClass.of(PitchLetter.F, Accidental.Natural),
    );
  });

  it('spells an unaltered natural letter with no accidental at all', () => {
    expect(PitchStepping.spellPitchClass(7, gMajor, 'Up')).toEqual(PitchClass.of(PitchLetter.G));
  });

  it('resolves the key-implied spelling for a seven-flat key over its own natural-letter reading', () => {
    // In C♭ major, pitch class 11 (natural-B-equivalent) is the key's own
    // 7th scale degree — C♭ (base(C) + flat = -1 ≡ 11 mod 12), spelled as
    // bare "C" since the key signature already supplies the flat — not "B
    // natural", even though B naturally sits at pitch class 11 too
    expect(PitchStepping.spellPitchClass(11, cFlatMajor, 'Up')).toEqual(
      PitchClass.of(PitchLetter.C),
    );
  });
});

describe('PitchStepping.chromaticIndex', () => {
  it('is exactly 12 apart between adjacent octaves of the same pitch class', () => {
    const c4 = pitch(PitchLetter.C, 4);
    const c5 = pitch(PitchLetter.C, 5);

    expect(
      PitchStepping.chromaticIndex(c5, cMajor) - PitchStepping.chromaticIndex(c4, cMajor),
    ).toBe(12);
  });

  it('treats an omitted accidental as following the key, not as natural', () => {
    // Bare "F4" in G major sounds as F♯4 (the key supplies the sharp) — its
    // chromatic index must match an actual F♯4, not a natural F4
    const bareF4 = pitch(PitchLetter.F, 4);
    const fSharp4 = pitch(PitchLetter.F, 4, Accidental.Sharp);
    const fNatural4 = pitch(PitchLetter.F, 4, Accidental.Natural);

    expect(PitchStepping.chromaticIndex(bareF4, gMajor)).toBe(
      PitchStepping.chromaticIndex(fSharp4, gMajor),
    );
    expect(PitchStepping.chromaticIndex(bareF4, gMajor)).not.toBe(
      PitchStepping.chromaticIndex(fNatural4, gMajor),
    );
  });

  it('lets an explicit Natural cancel the key regardless of the omitted-accidental default', () => {
    const fNatural4 = pitch(PitchLetter.F, 4, Accidental.Natural);
    const bareF4InC = pitch(PitchLetter.F, 4);

    // F-natural in G major must equal plain F in C major (both true F, no alteration)
    expect(PitchStepping.chromaticIndex(fNatural4, gMajor)).toBe(
      PitchStepping.chromaticIndex(bareF4InC, cMajor),
    );
  });
});

describe('PitchStepping.step', () => {
  it('returns the same pitch, unchanged, for a zero step', () => {
    const c4 = pitch(PitchLetter.C, 4);

    expect(expectOk(PitchStepping.step(c4, 0, cMajor))).toEqual(c4);
  });

  it('steps up a semitone to a sharp in C major', () => {
    const c4 = pitch(PitchLetter.C, 4);
    const result = expectOk(PitchStepping.step(c4, 1, cMajor));

    expect(result).toEqual(pitch(PitchLetter.C, 4, Accidental.Sharp));
  });

  it('steps down a semitone across a letter boundary into the previous octave', () => {
    const c4 = pitch(PitchLetter.C, 4);
    const result = expectOk(PitchStepping.step(c4, -1, cMajor));

    expect(result).toEqual(pitch(PitchLetter.B, 3));
  });

  it('steps up across an octave boundary', () => {
    const b4 = pitch(PitchLetter.B, 4);
    const result = expectOk(PitchStepping.step(b4, 1, cMajor));

    expect(result).toEqual(pitch(PitchLetter.C, 5));
  });

  it('resolves the exact bug this design almost shipped with: stepping up from a bare, key-implied pitch', () => {
    // Bare F4 in G major sounds as F♯4; stepping up one more semitone must
    // land on G4, not some octave-scrambled result from mistreating the
    // input as F-natural
    const bareF4 = pitch(PitchLetter.F, 4);
    const result = expectOk(PitchStepping.step(bareF4, 1, gMajor));

    expect(result).toEqual(pitch(PitchLetter.G, 4));
  });

  it('steps a key-implied pitch down a semitone to its own natural, spelled explicitly', () => {
    // Bare F4 sounds as F♯4 in G major; a semitone below F♯ is F natural,
    // which must cancel the key's implied sharp explicitly
    const bareF4 = pitch(PitchLetter.F, 4);
    const result = expectOk(PitchStepping.step(bareF4, -1, gMajor));

    expect(result).toEqual(pitch(PitchLetter.F, 4, Accidental.Natural));
  });

  it('fails rather than step below the representable octave range', () => {
    const c0 = pitch(PitchLetter.C, 0);

    expectInvalid(PitchStepping.step(c0, -1, cMajor));
  });

  it('fails rather than step above the representable octave range', () => {
    const b9 = pitch(PitchLetter.B, 9);

    expectInvalid(PitchStepping.step(b9, 1, cMajor));
  });

  it('round-trips up then down back to the original pitch', () => {
    const start = pitch(PitchLetter.D, 4);
    const up = expectOk(PitchStepping.step(start, 3, gMajor));
    const back = expectOk(PitchStepping.step(up, -3, gMajor));

    expect(PitchStepping.chromaticIndex(back, gMajor)).toBe(
      PitchStepping.chromaticIndex(start, gMajor),
    );
  });
});

describe('PitchStepping.step result contract', () => {
  it('exposes Result.isOk consistently', () => {
    expect(Result.isOk(PitchStepping.step(pitch(PitchLetter.C, 4), 1, cMajor))).toBe(true);
  });
});
