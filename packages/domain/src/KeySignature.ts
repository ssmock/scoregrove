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

/** The order in which sharps and flats accumulate in a key signature */
const sharpOrder: readonly PitchLetter[] = [
  PitchLetter.F,
  PitchLetter.C,
  PitchLetter.G,
  PitchLetter.D,
  PitchLetter.A,
  PitchLetter.E,
  PitchLetter.B,
];
const flatOrder: readonly PitchLetter[] = [
  PitchLetter.B,
  PitchLetter.E,
  PitchLetter.A,
  PitchLetter.D,
  PitchLetter.G,
  PitchLetter.C,
  PitchLetter.F,
];

/**
 * A key signature named by its tonic and mode (e.g. B♭ Major). Only the
 * standard circle-of-fifths signatures are permitted.
 */
export type KeySignature = {
  tonic: PitchClass;
  mode: Mode;
};

/**
 * The accidentals a key signature carries: which symbol, and which letters it
 * alters, in the order they accumulate (sharps F♯ C♯ …, flats B♭ E♭ …).
 * Undefined for the empty signature (C major / A minor).
 */
export type KeyAccidentals = {
  accidental: Accidental;
  letters: readonly PitchLetter[];
};

export const KeySignature = {
  /**
   * The tonics that form standard key signatures for the given mode
   */
  standardTonics(mode: Mode): readonly PitchClass[] {
    return mode === Mode.Major ? majorTonics : minorTonics;
  },

  /**
   * Which letters the key signature alters and with which symbol; undefined
   * for the empty signature (C major / A minor). Derived from the tonic's
   * place in the circle-of-fifths ordering: index 0 is empty, 1–7 are sharp
   * counts, 8–14 are flat counts. This is key theory (what a signature *is*),
   * so it lives here rather than in the renderer — engraving reads it for
   * printed positions, editing/playback for how a bare letter sounds.
   */
  accidentals(key: KeySignature): KeyAccidentals | undefined {
    const index = KeySignature.standardTonics(key.mode).findIndex((tonic) =>
      PitchClass.equals(tonic, key.tonic),
    );

    if (index <= 0) return undefined;

    if (index <= 7) {
      return { accidental: Accidental.Sharp, letters: sharpOrder.slice(0, index) };
    }

    return { accidental: Accidental.Flat, letters: flatOrder.slice(0, index - 7) };
  },

  /** The accidental the key implies for `letter` (so a bare letter sounds correctly), or undefined if the key leaves it natural */
  impliedAccidental(key: KeySignature, letter: PitchLetter): Accidental | undefined {
    const accidentals = KeySignature.accidentals(key);

    return accidentals?.letters.includes(letter) ? accidentals.accidental : undefined;
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
