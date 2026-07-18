import { Accidental, PitchClass, PitchLetter } from './Pitch';
import { Result } from './Result';
import { vocabulary } from './Vocabulary';

const modeMembers = {
  Major: 'Major',
  Minor: 'Minor',
} as const;

export type Mode = (typeof modeMembers)[keyof typeof modeMembers];

export const Mode = {
  ...modeMembers,
  ...vocabulary<Mode>(modeMembers),
};

const pc = (letter: PitchLetter, accidental?: Accidental): PitchClass =>
  PitchClass.of(letter, accidental);

/**
 * The fifteen standard major tonics, ordered by accidental count:
 * no accidentals, then 1–7 sharps, then 1–7 flats.
 */
const majorTonics: readonly PitchClass[] = [
  pc(PitchLetter.C),
  pc(PitchLetter.G),
  pc(PitchLetter.D),
  pc(PitchLetter.A),
  pc(PitchLetter.E),
  pc(PitchLetter.B),
  pc(PitchLetter.F, Accidental.Sharp),
  pc(PitchLetter.C, Accidental.Sharp),
  pc(PitchLetter.F),
  pc(PitchLetter.B, Accidental.Flat),
  pc(PitchLetter.E, Accidental.Flat),
  pc(PitchLetter.A, Accidental.Flat),
  pc(PitchLetter.D, Accidental.Flat),
  pc(PitchLetter.G, Accidental.Flat),
  pc(PitchLetter.C, Accidental.Flat),
];

/**
 * The fifteen standard minor tonics, in the same accidental-count order.
 */
const minorTonics: readonly PitchClass[] = [
  pc(PitchLetter.A),
  pc(PitchLetter.E),
  pc(PitchLetter.B),
  pc(PitchLetter.F, Accidental.Sharp),
  pc(PitchLetter.C, Accidental.Sharp),
  pc(PitchLetter.G, Accidental.Sharp),
  pc(PitchLetter.D, Accidental.Sharp),
  pc(PitchLetter.A, Accidental.Sharp),
  pc(PitchLetter.D),
  pc(PitchLetter.G),
  pc(PitchLetter.C),
  pc(PitchLetter.F),
  pc(PitchLetter.B, Accidental.Flat),
  pc(PitchLetter.E, Accidental.Flat),
  pc(PitchLetter.A, Accidental.Flat),
];

/**
 * A key signature named by its tonic and mode (e.g. B♭ Major). Only the
 * standard circle-of-fifths signatures are permitted.
 */
export type KeySignature = {
  tonic: PitchClass;
  mode: Mode;
};

export const KeySignature = {
  /**
   * The tonics that form standard key signatures for the given mode
   */
  standardTonics(mode: Mode): readonly PitchClass[] {
    return mode === Mode.Major ? majorTonics : minorTonics;
  },

  create(tonic: PitchClass, mode: Mode): Result<KeySignature> {
    const isStandard = KeySignature.standardTonics(mode).some((standard) =>
      PitchClass.equals(standard, tonic),
    );

    if (!isStandard) {
      return Result.invalid(
        `"${PitchClass.format(tonic)} ${mode}" is not a standard key signature`,
      );
    }

    return Result.ok({ tonic, mode });
  },

  equals(a: KeySignature, b: KeySignature): boolean {
    return a.mode === b.mode && PitchClass.equals(a.tonic, b.tonic);
  },

  format(key: KeySignature): string {
    return `${PitchClass.format(key.tonic)} ${key.mode}`;
  },
};
