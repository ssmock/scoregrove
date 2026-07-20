import type { KeySignature } from '@scoregrove/domain/KeySignature';
import { Accidental, Octave, Pitch, PitchClass, PitchLetter } from '@scoregrove/domain/Pitch';
import { Result } from '@scoregrove/domain/Result';
import { KeySignatureLayout } from '@scoregrove/engraving/KeySignatureLayout';

/** Score order of the seven letters, used to search for a spelling deterministically */
const letterOrder: readonly PitchLetter[] = [
  PitchLetter.C,
  PitchLetter.D,
  PitchLetter.E,
  PitchLetter.F,
  PitchLetter.G,
  PitchLetter.A,
  PitchLetter.B,
];

/** Each letter's semitone within its own octave, before any accidental */
const baseSemitones: Record<PitchLetter, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

const accidentalOffsets: Record<Accidental, number> = {
  DoubleFlat: -2,
  Flat: -1,
  Natural: 0,
  Sharp: 1,
  DoubleSharp: 2,
};

const mod12 = (n: number): number => ((n % 12) + 12) % 12;

/** Which accidental, if any, the key signature implies for each letter */
const keyAccidentalsOf = (key: KeySignature): Partial<Record<PitchLetter, Accidental>> => {
  const accidentals = KeySignatureLayout.accidentals(key);

  if (!accidentals) return {};

  const map: Partial<Record<PitchLetter, Accidental>> = {};

  for (const letter of accidentals.letters) map[letter] = accidentals.accidental;

  return map;
};

/**
 * A pitch class's semitone *as it actually sounds under `key`*: an explicit
 * accidental (including an explicit Natural, which cancels the key) always
 * wins; an omitted one defers to whatever the key signature implies for
 * that letter, per the domain's own convention ("an absent accidental means
 * the letter is played as the key signature dictates"). Getting this wrong
 * is exactly how a bare "F" in a key that implies F♯ would silently be
 * treated as F-natural instead of the F♯ it actually sounds like.
 */
const effectiveSemitone = (pitchClass: PitchClass, key: KeySignature): number => {
  const implied = pitchClass.accidental ?? keyAccidentalsOf(key)[pitchClass.letter];

  return baseSemitones[pitchClass.letter] + (implied ? accidentalOffsets[implied] : 0);
};

export type StepDirection = 'Up' | 'Down';

export const PitchStepping = {
  /**
   * The absolute semitone number of a written pitch *as it sounds under
   * `key`* (see `effectiveSemitone` — the key matters whenever the pitch
   * omits its own accidental). Only differences between two calls are
   * meaningful; this is purely an intermediate for stepping arithmetic, not
   * a performance-parameter mapping.
   */
  chromaticIndex(pitch: Pitch, key: KeySignature): number {
    return pitch.octave * 12 + effectiveSemitone(pitch.pitchClass, key);
  },

  /**
   * Spells a chromatic pitch class (any integer; folded mod 12) the way a
   * keyboard-step editor should, in priority order:
   *
   * 1. If this pitch class matches a letter the key signature already
   *    alters, spell it that way (G major steps to F♯, never G♭) — no
   *    explicit accidental needed, since the key signature supplies it.
   * 2. Otherwise, if it matches a letter's plain semitone, use that letter —
   *    with an explicit Natural only if the key alters that letter (so the
   *    true-natural pitch in a sharp/flat key doesn't silently sound wrong).
   * 3. Otherwise (one of the five pitch classes with no natural-letter
   *    match) spell it sharp going up, flat going down.
   */
  spellPitchClass(pitchClass: number, key: KeySignature, direction: StepDirection): PitchClass {
    const target = mod12(pitchClass);
    const keyAccidentals = keyAccidentalsOf(key);

    for (const letter of letterOrder) {
      const altered = keyAccidentals[letter];

      if (altered && mod12(baseSemitones[letter] + accidentalOffsets[altered]) === target) {
        return PitchClass.of(letter);
      }
    }

    for (const letter of letterOrder) {
      if (baseSemitones[letter] === target) {
        return keyAccidentals[letter]
          ? PitchClass.of(letter, Accidental.Natural)
          : PitchClass.of(letter);
      }
    }

    const offset = direction === 'Up' ? 1 : -1;
    const accidental = direction === 'Up' ? Accidental.Sharp : Accidental.Flat;
    const letter = letterOrder.find((l) => mod12(baseSemitones[l] + offset) === target);

    if (!letter) {
      // Every pitch class matches either a natural letter or one of these
      // ± searches — reaching neither is a bug in this table, not a
      // reachable runtime case.
      throw new Error(`No letter spells pitch class ${target}`);
    }

    return PitchClass.of(letter, accidental);
  },

  /**
   * Steps a written pitch by a number of semitones (positive up, negative
   * down), respelling per `spellPitchClass`. Fails if the result would fall
   * outside the representable octave range (0–9); a zero step returns the
   * pitch unchanged, spelling included.
   */
  step(pitch: Pitch, semitones: number, key: KeySignature): Result<Pitch> {
    if (semitones === 0) return Result.ok(pitch);

    const target = PitchStepping.chromaticIndex(pitch, key) + semitones;
    const direction: StepDirection = semitones > 0 ? 'Up' : 'Down';
    const pitchClass = PitchStepping.spellPitchClass(target, key, direction);

    // effectiveSemitone(pitchClass, key) ≡ target (mod 12) by construction
    // of spellPitchClass, so this division is always exact
    const octave = (target - effectiveSemitone(pitchClass, key)) / 12;

    if (!Octave.is(octave)) {
      return Result.invalid('Stepping that far falls outside the representable octave range');
    }

    return Result.ok(Pitch.of(pitchClass, Octave.of(octave)));
  },
};
