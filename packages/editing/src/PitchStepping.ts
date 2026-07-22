import { KeySignature } from '@scoregrove/domain/KeySignature';
import { Accidental, Octave, Pitch, PitchClass, PitchLetter } from '@scoregrove/domain/Pitch';
import { Result } from '@scoregrove/domain/Result';
import { Semitone } from '@scoregrove/domain/Semitone';

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

const mod12 = (n: number): number => ((n % 12) + 12) % 12;

export type StepDirection = 'Up' | 'Down';

export const PitchStepping = {
  /**
   * The absolute semitone number of a written pitch as it sounds under `key`
   * — the domain's `Semitone.ofPitch`, re-exposed here for the stepping
   * arithmetic below. Only differences between two calls are meaningful.
   */
  chromaticIndex(pitch: Pitch, key: KeySignature): number {
    return Semitone.ofPitch(pitch, key);
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

    for (const letter of letterOrder) {
      const altered = KeySignature.impliedAccidental(key, letter);

      if (altered && mod12(Semitone.ofLetter(letter) + Semitone.ofAccidental(altered)) === target) {
        return PitchClass.of(letter);
      }
    }

    for (const letter of letterOrder) {
      if (Semitone.ofLetter(letter) === target) {
        return KeySignature.impliedAccidental(key, letter)
          ? PitchClass.of(letter, Accidental.Natural)
          : PitchClass.of(letter);
      }
    }

    const offset = direction === 'Up' ? 1 : -1;
    const accidental = direction === 'Up' ? Accidental.Sharp : Accidental.Flat;
    const letter = letterOrder.find((l) => mod12(Semitone.ofLetter(l) + offset) === target);

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

    // Semitone.effective(pitchClass, key) ≡ target (mod 12) by construction
    // of spellPitchClass, so this division is always exact
    const octave = (target - Semitone.effective(pitchClass, key)) / 12;

    if (!Octave.is(octave)) {
      return Result.invalid('Stepping that far falls outside the representable octave range');
    }

    return Result.ok(Pitch.of(pitchClass, Octave.of(octave)));
  },
};
