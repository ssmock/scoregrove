import { Accidental, Octave, Pitch, PitchClass, PitchLetter } from '@scoregrove/domain/Pitch';
import { Result } from '@scoregrove/domain/Result';
import type { XmlElement } from '@rgrove/parse-xml';
import type { Warn } from './Reporting';
import { XmlReading } from './XmlReading';

/**
 * MusicXML `<note>` pitches into domain `Pitch`es, plus the predicates and
 * grouping the element reader needs to tell rests, chord members and grace
 * notes apart.
 *
 * ## `<alter>` and `<accidental>` say different things
 *
 * `<alter>` is the **sounding** alteration; `<accidental>` is what is
 * **printed**. They are independent, and this corpus contains all four
 * combinations: 6,968 notes with neither, 1,353 altered but unprinted (an F♯
 * in G major, where the key supplies the sharp), 663 altered and printed, and
 * **313 printed with no alteration at all** — every one of them a natural,
 * cancelling a key's flat or sharp.
 *
 * That last group is why `<alter>` alone is not enough. A B in F major with no
 * `<alter>` is B-natural, but leaving the accidental undefined means "follow
 * the key", which would sound B♭. It needs an explicit `Natural`, and only
 * `<accidental>` says so.
 *
 * So the rule is: a non-zero `<alter>` gives the accidental; otherwise a
 * printed natural gives `Natural`; otherwise the accidental is omitted and the
 * key decides. Both pipelines already treat an explicit accidental as an
 * *override* of the key rather than an addition to it (`Semitone.effective`
 * and `Accidentals.resolve` agree on this), so a redundant sharp on an F in G
 * major sounds and prints exactly as a bare F does.
 */

const lettersByStep: Record<string, PitchLetter> = {
  A: PitchLetter.A,
  B: PitchLetter.B,
  C: PitchLetter.C,
  D: PitchLetter.D,
  E: PitchLetter.E,
  F: PitchLetter.F,
  G: PitchLetter.G,
};

const accidentalsByAlter: Record<number, Accidental> = {
  [-2]: Accidental.DoubleFlat,
  [-1]: Accidental.Flat,
  1: Accidental.Sharp,
  2: Accidental.DoubleSharp,
};

/** The alteration each printed accidental implies, for cross-checking against `<alter>` */
const alterByAccidental: Record<string, number> = {
  'double-flat': -2,
  'flat-flat': -2,
  flat: -1,
  natural: 0,
  sharp: 1,
  'double-sharp': 2,
  'sharp-sharp': 2,
};

export const PitchReading = {
  /** Whether this `<note>` is a rest rather than a sounded pitch */
  isRest: (note: XmlElement): boolean => XmlReading.childNamed(note, 'rest') !== undefined,

  /** Whether this `<note>` sounds together with the one before it */
  isChordMember: (note: XmlElement): boolean => XmlReading.childNamed(note, 'chord') !== undefined,

  /** Whether this `<note>` is a grace note, which steals time rather than occupying it */
  isGrace: (note: XmlElement): boolean => XmlReading.childNamed(note, 'grace') !== undefined,

  /**
   * Groups notes that sound together. MusicXML marks the second and later
   * pitches of a chord with `<chord/>`, meaning "at the same time as the
   * previous note" — so a group is a leading note plus the `<chord/>` notes
   * that follow it, and the grouping depends entirely on document order.
   */
  chordGroups(notes: readonly XmlElement[], warn: Warn): XmlElement[][] {
    const groups: XmlElement[][] = [];

    for (const note of notes) {
      const current = groups.at(-1);

      if (PitchReading.isChordMember(note) && current) {
        current.push(note);
        continue;
      }

      if (PitchReading.isChordMember(note)) {
        // Nothing to attach to: the file marks a chord member as the first
        // note of the sequence. Treat it as starting its own chord and say so.
        warn('A <chord/> note has no preceding note to sound with; starting a new chord');
      }

      groups.push([note]);
    }

    return groups;
  },

  /**
   * The `<pitch>` of a sounded note. Rests have none, so callers should check
   * `isRest` first; asking anyway is an error rather than a silent default.
   */
  pitch(note: XmlElement, where: string, warn: Warn): Result<Pitch> {
    const pitch = XmlReading.childNamed(note, 'pitch');

    if (!pitch) {
      if (XmlReading.childNamed(note, 'unpitched')) {
        return Result.invalid(`${where}: unpitched notation is not supported`);
      }

      return Result.invalid(`${where}: a sounded note with no <pitch>`);
    }

    const stepText = XmlReading.textOf(pitch, 'step');
    const letter = stepText === undefined ? undefined : lettersByStep[stepText.toUpperCase()];

    if (!letter) return Result.invalid(`${where}: unusable pitch step "${stepText ?? ''}"`);

    const octaveText = XmlReading.textOf(pitch, 'octave');
    const octaveValue = Number(octaveText);

    if (!Octave.is(octaveValue)) {
      return Result.invalid(`${where}: octave "${octaveText ?? ''}" is outside the usable range`);
    }

    const alterText = XmlReading.textOf(pitch, 'alter');
    const alter = alterText === undefined ? 0 : Number(alterText);

    if (!Number.isInteger(alter) || Math.abs(alter) > 2) {
      // Microtones (<alter>0.5</alter>) and triple alterations both land here.
      return Result.invalid(`${where}: unsupported alteration <alter>${alterText}</alter>`);
    }

    const printed = XmlReading.textOf(note, 'accidental');

    if (printed !== undefined) {
      const implied = alterByAccidental[printed];

      if (implied === undefined) {
        warn(`${where}: unsupported printed accidental "${printed}"`);
      } else if (implied !== alter) {
        // The same disagreement the duration cross-check looks for: the file
        // says a note sounds one way and prints another.
        warn(
          `${where}: <alter>${alter}</alter> disagrees with a printed "${printed}"; ` +
            'sounding it as written',
        );
      }
    }

    // A non-zero alteration names its own accidental. An unaltered note needs
    // one only to *cancel* the key, which is what a printed natural means.
    const accidental =
      accidentalsByAlter[alter] ?? (printed === 'natural' ? Accidental.Natural : undefined);

    return Result.ok(
      Pitch.of(
        accidental ? PitchClass.of(letter, accidental) : PitchClass.of(letter),
        Octave.of(octaveValue),
      ),
    );
  },

  /**
   * Where a rest was pinned, when the writer pinned it — `<display-step>` and
   * `<display-octave>` name the staff position as a pitch, which is how both
   * the printed page and `Rest.position` think of it.
   *
   * Engraving still prints rests at their standard rows (a known gap), so this
   * is carried without yet being drawn. Holding it is the point: the choice is
   * the writer's, made to clear another voice, and re-deriving it later is
   * impossible once discarded.
   */
  restPosition(note: XmlElement, where: string, warn: Warn): Pitch | undefined {
    const rest = XmlReading.childNamed(note, 'rest');

    if (!rest) return undefined;

    const step = XmlReading.textOf(rest, 'display-step');
    const octave = XmlReading.textOf(rest, 'display-octave');

    if (step === undefined && octave === undefined) return undefined;

    const letter = step === undefined ? undefined : lettersByStep[step.toUpperCase()];
    const octaveValue = Number(octave);

    if (!letter || !Octave.is(octaveValue)) {
      warn(`${where}: unusable rest position ${step ?? ''}${octave ?? ''}`);

      return undefined;
    }

    return Pitch.of(PitchClass.of(letter), Octave.of(octaveValue));
  },
};
