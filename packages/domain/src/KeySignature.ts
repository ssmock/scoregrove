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
 * A key signature: how many sharps or flats it carries, and what the music
 * calls that — **when the source said**.
 *
 * ## Why fifths rather than a tonic
 *
 * A signature of three flats is E♭ major *or* C minor, and nothing about the
 * signature itself distinguishes them: the printed accidentals, the pitches
 * they imply, and everything both pipelines derive depend only on the count.
 * Naming it by a tonic therefore has to invent a mode, and MusicXML routinely
 * declines to supply one — the Haydn corpus states `<fifths>` 20 times and
 * `<mode>` never, so its finale, which is in C minor, arrived labelled E♭
 * major. Harmless on the page, wrong in the model, and a lie the importer was
 * forced to tell because the type had nowhere to put "unstated".
 *
 * So the signature is the fifths, and the mode is optional naming on top of
 * it. `tonic` becomes something you *derive* when the mode is known, rather
 * than something every score must assert.
 */
export type KeySignature = {
  /** Sharps when positive, flats when negative, −7 to 7 */
  fifths: number;
  /** What the music calls this signature, when it says; a signature alone does not know */
  mode?: Mode;
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

/** The circle-of-fifths position a signature's tonic sits at: 0 empty, 1–7 sharps, 8–14 flats */
const tonicIndex = (fifths: number): number => (fifths >= 0 ? fifths : 7 - fifths);

export const KeySignature = {
  /** The commonest signature, and the one an untold score starts in */
  cMajor: { fifths: 0, mode: Mode.Major } as KeySignature,

  /**
   * The tonics that form standard key signatures for the given mode
   */
  standardTonics(mode: Mode): readonly PitchClass[] {
    return mode === Mode.Major ? majorTonics : minorTonics;
  },

  /** A signature from a known-good fifths count; `create` validates arbitrary input */
  of(fifths: number, mode?: Mode): KeySignature {
    return mode ? { fifths, mode } : { fifths };
  },

  create(fifths: number, mode?: Mode): Result<KeySignature> {
    if (!Number.isInteger(fifths) || Math.abs(fifths) > 7) {
      return Result.invalid(`A key signature carries 0 to 7 sharps or flats, not ${fifths}`);
    }

    return Result.ok(KeySignature.of(fifths, mode));
  },

  /** The signature a named key carries, for music that thinks in key names rather than counts */
  ofTonic(tonic: PitchClass, mode: Mode): Result<KeySignature> {
    const index = KeySignature.standardTonics(mode).findIndex((standard) =>
      PitchClass.equals(standard, tonic),
    );

    if (index < 0) {
      return Result.invalid(
        `"${PitchClass.format(tonic)} ${mode}" is not a standard key signature`,
      );
    }

    return Result.ok(KeySignature.of(index <= 7 ? index : 7 - index, mode));
  },

  /**
   * The tonic this signature names, or undefined when the mode is unstated —
   * three flats is E♭ major or C minor, and without a mode there is no answer
   * to give rather than a default to pick.
   */
  tonic(key: KeySignature): PitchClass | undefined {
    return key.mode ? KeySignature.standardTonics(key.mode)[tonicIndex(key.fifths)] : undefined;
  },

  /**
   * Which letters the key signature alters and with which symbol; undefined
   * for the empty signature. Derived from the fifths count alone, which is
   * what makes the mode optional: E♭ major and C minor print and sound
   * identically because this function cannot tell them apart. Key theory
   * (what a signature *is*), so it lives here rather than in the renderer —
   * engraving reads it for printed positions, editing/playback for how a bare
   * letter sounds.
   */
  accidentals(key: KeySignature): KeyAccidentals | undefined {
    if (key.fifths > 0) {
      return { accidental: Accidental.Sharp, letters: sharpOrder.slice(0, key.fifths) };
    }

    if (key.fifths < 0) {
      return { accidental: Accidental.Flat, letters: flatOrder.slice(0, -key.fifths) };
    }

    return undefined;
  },

  /** The accidental the key implies for `letter` (so a bare letter sounds correctly), or undefined if the key leaves it natural */
  impliedAccidental(key: KeySignature, letter: PitchLetter): Accidental | undefined {
    const accidentals = KeySignature.accidentals(key);

    return accidentals?.letters.includes(letter) ? accidentals.accidental : undefined;
  },

  equals(a: KeySignature, b: KeySignature): boolean {
    return a.fifths === b.fifths && a.mode === b.mode;
  },

  /**
   * A named key where the mode is known, and a plain count where it is not —
   * "three flats" being exactly as much as such a signature says.
   */
  format(key: KeySignature): string {
    const tonic = KeySignature.tonic(key);

    if (tonic && key.mode) return `${PitchClass.format(tonic)} ${key.mode}`;

    if (key.fifths === 0) return 'no sharps or flats';

    const count = Math.abs(key.fifths);

    return `${count} ${key.fifths > 0 ? 'sharp' : 'flat'}${count === 1 ? '' : 's'}`;
  },
};
