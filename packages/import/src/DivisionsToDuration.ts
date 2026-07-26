import { DotCount, Duration, NoteValue, Tuplet } from '@scoregrove/domain/Duration';
import { Fraction } from '@scoregrove/domain/Fraction';
import { Result } from '@scoregrove/domain/Result';
import type { XmlElement } from '@rgrove/parse-xml';
import type { Warn } from './Reporting';
import { XmlReading } from './XmlReading';

/**
 * MusicXML durations into domain `Duration`s.
 *
 * MusicXML states a note's length twice, and the two are different kinds of
 * fact. `<type>`/`<dot>`/`<time-modification>` are the **written** form — the
 * notehead a reader sees — and that is what our `Duration` models. `<duration>`
 * is the **sounded** length in `<divisions>` units, which is what advances the
 * position within a measure and what `<backup>`/`<forward>` speak in.
 *
 * So the written form drives, and the sounded value is used to **check** it:
 * converting the parsed `Duration` back into divisions must reproduce
 * `<duration>` exactly. A mismatch means either the file disagrees with itself
 * or we misread it, and either is worth hearing about. All arithmetic is exact
 * `Fraction`, never floating point, matching editing and engraving.
 *
 * Elements with no `<type>` at all need the inverse: a whole-measure rest
 * (`<rest measure="yes"/>`, 160 of them in this corpus) states only how long it
 * lasts. That is recovered by searching the representable written values for
 * one of exactly the right length — and a length no written value can express
 * is a reported failure, never a rounding.
 */

const noteValuesByType: Record<string, NoteValue> = {
  breve: NoteValue.Breve,
  whole: NoteValue.Whole,
  half: NoteValue.Half,
  quarter: NoteValue.Quarter,
  eighth: NoteValue.Eighth,
  '16th': NoteValue.Sixteenth,
  '32nd': NoteValue.ThirtySecond,
  '64th': NoteValue.SixtyFourth,
};

/** Longest first, so the inverse prefers a plain value over a dotted shorter one */
const searchOrder: readonly NoteValue[] = [
  NoteValue.Breve,
  NoteValue.Whole,
  NoteValue.Half,
  NoteValue.Quarter,
  NoteValue.Eighth,
  NoteValue.Sixteenth,
  NoteValue.ThirtySecond,
  NoteValue.SixtyFourth,
];

const dotOptions: readonly (DotCount | undefined)[] = [undefined, 1, 2];

const readTimeModification = (note: XmlElement, warn: Warn): Tuplet | undefined => {
  const modification = XmlReading.childNamed(note, 'time-modification');

  if (!modification) return undefined;

  const actual = Number(XmlReading.textOf(modification, 'actual-notes'));
  const normal = Number(XmlReading.textOf(modification, 'normal-notes'));
  const tuplet = Tuplet.create(actual, normal);

  if (!Result.isOk(tuplet)) {
    warn(`Ignoring an unusable <time-modification> of ${actual}:${normal}`);

    return undefined;
  }

  return tuplet.value;
};

export const DivisionsToDuration = {
  /**
   * A `<duration>` value as an exact fraction of a whole note. `divisions`
   * counts units per *quarter*, so a whole note is four of them.
   */
  wholeNotes(durationValue: number, divisions: number): Fraction {
    return Fraction.of(durationValue, divisions * 4);
  },

  /**
   * The written duration expressing exactly `wholeNotes`, or a failure when no
   * combination of note value and dots does. Used for elements that state a
   * length but no written value.
   */
  fromWholeNotes(wholeNotes: Fraction): Result<Duration> {
    for (const noteValue of searchOrder) {
      for (const dots of dotOptions) {
        const candidate = Duration.of(noteValue, dots ? { dots } : {});

        if (Fraction.equals(Duration.fractionOfWhole(candidate), wholeNotes)) {
          return Result.ok(candidate);
        }
      }
    }

    return Result.invalid(
      `No written note value spans ${Fraction.format(wholeNotes)} of a whole note`,
    );
  },

  /**
   * The `<duration>` a written duration should carry, for cross-checking.
   * Returns a `Fraction` because a tuplet need not land on a whole number of
   * divisions — comparing exactly is the point, so it must not be rounded here.
   */
  divisionsOf(duration: Duration, divisions: number): Fraction {
    return Fraction.multiply(Duration.fractionOfWhole(duration), Fraction.of(divisions * 4, 1));
  },

  /**
   * Reads one `<note>`'s written duration, preferring `<type>` and falling back
   * to the sounded `<duration>` when there is none, then checking the two
   * against each other.
   *
   * Grace notes carry no `<duration>` at all — they steal their time from a
   * neighbour rather than occupying any — so there is nothing to check them
   * against, and their absence is not a defect.
   */
  read(note: XmlElement, divisions: number, where: string, warn: Warn): Result<Duration> {
    const durationText = XmlReading.textOf(note, 'duration');
    const durationValue = durationText === undefined ? undefined : Number(durationText);

    if (durationValue !== undefined && (!Number.isFinite(durationValue) || durationValue < 0)) {
      return Result.invalid(`${where}: unusable <duration> "${durationText}"`);
    }

    const typeText = XmlReading.textOf(note, 'type');

    if (typeText === undefined) {
      if (durationValue === undefined) {
        return Result.invalid(`${where}: a note with neither <type> nor <duration>`);
      }

      // A whole-measure rest states only its length. Recovering a written value
      // from it is exactly the inverse this module exists to provide.
      const recovered = DivisionsToDuration.fromWholeNotes(
        DivisionsToDuration.wholeNotes(durationValue, divisions),
      );

      if (!Result.isOk(recovered)) {
        return Result.invalid(`${where}: ${recovered.error.messages.join('; ')}`);
      }

      return recovered;
    }

    const noteValue = noteValuesByType[typeText];

    if (!noteValue) return Result.invalid(`${where}: unsupported note type "${typeText}"`);

    const dotCount = XmlReading.childrenNamed(note, 'dot').length;

    if (dotCount > 2) {
      warn(`${where}: ${dotCount} augmentation dots; only 1 and 2 are representable`);
    }

    const dots = DotCount.is(dotCount) ? dotCount : undefined;
    const tuplet = readTimeModification(note, warn);
    const duration = Duration.of(noteValue, {
      ...(dots ? { dots } : {}),
      ...(tuplet ? { tuplet } : {}),
    });

    // The cross-check. Grace notes are exempt: no <duration> to compare with.
    if (durationValue !== undefined && !XmlReading.childNamed(note, 'grace')) {
      const expected = DivisionsToDuration.divisionsOf(duration, divisions);

      if (!Fraction.equals(expected, Fraction.of(durationValue, 1))) {
        warn(
          `${where}: written ${Duration.format(duration)} should last ` +
            `${Fraction.format(expected)} divisions but <duration> says ${durationValue}`,
        );
      }
    }

    return Result.ok(duration);
  },
};
