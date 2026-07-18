import type { Brand } from './Brand';
import { Integer } from './Integer';
import type { Result } from './Result';
import { vocabulary } from './Vocabulary';

const letterMembers = {
  A: 'A',
  B: 'B',
  C: 'C',
  D: 'D',
  E: 'E',
  F: 'F',
  G: 'G',
} as const;

/**
 * The seven note letters of the musical alphabet.
 */
export type PitchLetter = (typeof letterMembers)[keyof typeof letterMembers];

export const PitchLetter = {
  ...letterMembers,
  ...vocabulary<PitchLetter>(letterMembers),
};

const accidentalMembers = {
  Sharp: 'Sharp',
  Flat: 'Flat',
  Natural: 'Natural',
  DoubleSharp: 'DoubleSharp',
  DoubleFlat: 'DoubleFlat',
} as const;

/**
 * An alteration applied to a note letter. An explicit Natural cancels a key
 * signature or earlier accidental; an absent accidental means the letter is
 * played as the key signature dictates.
 */
export type Accidental = (typeof accidentalMembers)[keyof typeof accidentalMembers];

const accidentalSymbols: Record<Accidental, string> = {
  Sharp: '♯',
  Flat: '♭',
  Natural: '♮',
  DoubleSharp: '𝄪',
  DoubleFlat: '𝄫',
};

export const Accidental = {
  ...accidentalMembers,
  ...vocabulary<Accidental>(accidentalMembers),

  /**
   * The symbol printed on the score (e.g. ♯ for Sharp)
   */
  symbol(accidental: Accidental): string {
    return accidentalSymbols[accidental];
  },
};

/**
 * An octave in scientific pitch notation, where C4 is middle C. The range 0–9
 * covers the audible span (the octave number is part of the written pitch name,
 * not a performance parameter).
 */
export type Octave = Brand<number, 'Octave'>;

export const Octave = {
  min: 0,
  max: 9,

  is(val: unknown): val is Octave {
    return Integer.is(val) && val >= Octave.min && val <= Octave.max;
  },

  /**
   * Brands the given number without validating it; use only when the value
   * is already known to be a valid octave (e.g. a literal or a prior `is` check)
   */
  of(val: number): Octave {
    return val as Octave;
  },

  create(fieldName: string, candidate: number | null | undefined): Result<Octave> {
    if (candidate == null || !Octave.is(candidate)) {
      return {
        error: {
          code: 'Invalid',
          messages: [
            `${fieldName} must be an integer octave between ${Octave.min} and ${Octave.max}`,
          ],
        },
      } as Result<Octave>;
    }

    return { value: Octave.of(candidate) };
  },
};

/**
 * A note name without an octave: a letter plus an optional accidental.
 * For identity purposes an explicit Natural is equivalent to no accidental.
 */
export type PitchClass = {
  letter: PitchLetter;
  accidental?: Accidental;
};

const normalizeAccidental = (accidental: Accidental | undefined): Accidental | undefined =>
  accidental === Accidental.Natural ? undefined : accidental;

export const PitchClass = {
  of(letter: PitchLetter, accidental?: Accidental): PitchClass {
    return accidental ? { letter, accidental } : { letter };
  },

  equals(a: PitchClass, b: PitchClass): boolean {
    return (
      a.letter === b.letter &&
      normalizeAccidental(a.accidental) === normalizeAccidental(b.accidental)
    );
  },

  format(pitchClass: PitchClass): string {
    const accidental = normalizeAccidental(pitchClass.accidental);

    return accidental ? `${pitchClass.letter}${Accidental.symbol(accidental)}` : pitchClass.letter;
  },
};

/**
 * A fully specified written pitch: a pitch class at a specific octave (e.g. C♯4).
 */
export type Pitch = {
  pitchClass: PitchClass;
  octave: Octave;
};

export const Pitch = {
  of(pitchClass: PitchClass, octave: Octave): Pitch {
    return { pitchClass, octave };
  },

  equals(a: Pitch, b: Pitch): boolean {
    return a.octave === b.octave && PitchClass.equals(a.pitchClass, b.pitchClass);
  },

  format(pitch: Pitch): string {
    return `${PitchClass.format(pitch.pitchClass)}${pitch.octave}`;
  },
};
