import { ClosingBarline, OpeningBarline } from './Barline';
import type { Clef } from './Clef';
import { Duration } from './Duration';
import { Fraction } from './Fraction';
import type { KeySignature } from './KeySignature';
import type { MeasureElement } from './MeasureElement';
import type { NavigationJump, NavigationMark } from './Navigation';
import { NonEmptyArray } from './NonEmptyArray';
import type { NonEmptyString } from './NonEmptyString';
import type { PositiveInteger } from './PositiveInteger';
import { Result } from './Result';
import type { Tempo } from './Tempo';
import { TimeSignature, type Swing } from './TimeSignature';
import { reduceDistinct } from './Utils';

/**
 * A single melodic or rhythmic line within one staff. Multiple voices let one
 * staff carry independent lines at once (e.g. soprano and alto sharing the
 * treble staff). Voice count may vary measure to measure — voices genuinely
 * appear and disappear.
 */
export type Voice = {
  elements: NonEmptyArray<MeasureElement>;
};

export const Voice = {
  of(elements: NonEmptyArray<MeasureElement>): Voice {
    return { elements };
  },
};

/**
 * What one staff plays within one measure: one or more voices, with an
 * optional clef change taking effect at the start of the measure.
 */
export type StaffContent = {
  clef?: Clef;
  voices: NonEmptyArray<Voice>;
};

export const StaffContent = {
  of(voices: NonEmptyArray<Voice>, clef?: Clef): StaffContent {
    return clef ? { clef, voices } : { voices };
  },

  /**
   * Convenience for the common single-voice case
   */
  singleVoice(elements: NonEmptyArray<MeasureElement>, clef?: Clef): StaffContent {
    return StaffContent.of(NonEmptyArray.of([Voice.of(elements)]), clef);
  },
};

/**
 * One measure across every staff of the score. `contents` holds one entry per
 * staff, in score order. Everything else is a score-wide attribute of the
 * measure:
 *
 * - `key`/`time`/`tempo`/`swing` are changes taking effect at this measure
 * - `opening`/`closing` are special barlines (repeats, double, final)
 * - `repeatTimes` is the total number of passes through a repeated passage,
 *   allowed only alongside a RepeatClose closing barline
 * - `ending` marks this measure as part of a volta bracket for the given
 *   passage numbers (e.g. [1] for a first ending)
 * - `marks` places navigation landmarks (segno, coda, fine) at this measure
 * - `jump` is a navigation instruction taking effect at the end of this measure
 * - `label` is what an imported source *calls* this measure, for display only
 * - `partial` opts this measure out of the fullness rule (see below)
 *
 * ## `label` is not an index
 *
 * A measure's identity is its **position** in `Score.measures`, and nothing
 * else. `label` exists solely to carry a source's own bar numbering through
 * import so it can be printed, and it is deliberately not named `number` to
 * make keying on it read as the mistake it is.
 *
 * Real scores make this concrete. In the Haydn corpus (see
 * `packages/import/corpus`) the labels restart at every movement, so four
 * different measures are labelled `0`; fifteen are labelled `X1`–`X6`, which
 * are not numbers at all; and `X1` alone occurs four times. Any lookup, slice,
 * or address keyed on `label` is therefore ambiguous by construction. Use the
 * positional index — including in error messages, where the temptation is
 * strongest.
 *
 * ## `partial` measures
 *
 * Normally every voice must exactly fill the measure. `partial` says the
 * shortfall is deliberate, and is the only way to write a measure that doesn't
 * fill — position confers no exemption, not even the first measure's.
 *
 * These are commoner than the anacrusis alone suggests, because a partial
 * measure is usually half of a pair: a pickup at a section's start is completed
 * by a short bar at its end. The Haydn corpus has 22 across four movements, at
 * every variation and Menuetto/Trio boundary. Deliberately *not* modeled is
 * which measure completes which — the partner is sometimes the next measure and
 * sometimes a backward repeat's target dozens of bars away, so identifying it
 * means unfolding the navigation. That belongs to whoever has already done so
 * (playback's `NavigationUnfolding`), not to a measure in isolation.
 *
 * The flag only lifts the *lower* bound. Overfull stays an error, and a partial
 * measure must still hold some sounding duration — a measure of nothing but
 * dynamics is a mistake in any position.
 */
export type Measure = {
  contents: NonEmptyArray<StaffContent>;
  label?: NonEmptyString;
  partial?: boolean;
  key?: KeySignature;
  time?: TimeSignature;
  tempo?: Tempo;
  swing?: Swing;
  opening?: OpeningBarline;
  closing?: ClosingBarline;
  repeatTimes?: PositiveInteger;
  ending?: NonEmptyArray<PositiveInteger>;
  marks?: NonEmptyArray<NavigationMark>;
  jump?: NavigationJump;
};

export const Measure = {
  create(spec: Measure): Result<Measure> {
    const messages: string[] = [];

    if (spec.repeatTimes !== undefined) {
      if (spec.closing !== ClosingBarline.RepeatClose) {
        messages.push('repeatTimes requires a RepeatClose closing barline');
      }

      if (spec.repeatTimes < 2) {
        messages.push('repeatTimes must be at least 2 (the total number of passes)');
      }
    }

    if (messages.length) return Result.invalid(messages);

    const marks = spec.marks
      ? NonEmptyArray.of(spec.marks.reduce(reduceDistinct, [] as NavigationMark[]))
      : undefined;

    const ending = spec.ending
      ? NonEmptyArray.of(spec.ending.reduce(reduceDistinct, [] as PositiveInteger[]))
      : undefined;

    return Result.ok({
      ...spec,
      ...(marks ? { marks } : {}),
      ...(ending ? { ending } : {}),
    });
  },

  /**
   * Checks that every voice's written durations exactly fill the measure under
   * the given (effective) time signature. Dynamics and grace notes consume no
   * time.
   *
   * A `partial` measure lifts the lower bound only: it may hold less than the
   * capacity, but never nothing, and never more. Nothing here depends on the
   * measure's position in the score — a pickup is partial because it says so.
   *
   * Messages are labeled by staff and voice but not measure number — the caller
   * knows the measure's position.
   */
  check(time: TimeSignature, measure: Measure): Result<void> {
    const capacity = TimeSignature.capacity(time);
    const messages: string[] = [];

    measure.contents.forEach((content, staffIndex) => {
      content.voices.forEach((voice, voiceIndex) => {
        const total = voice.elements.reduce((sum, element) => {
          if (element.kind === 'dynamic') return sum;

          return Fraction.add(sum, Duration.fractionOfWhole(element.duration));
        }, Fraction.zero());

        const comparison = Fraction.compare(total, capacity);
        const label = `staff ${staffIndex + 1}, voice ${voiceIndex + 1}`;
        const amounts = `${Fraction.format(total)} of a whole note; the ${TimeSignature.format(time)} measure holds ${Fraction.format(capacity)}`;

        if (comparison > 0) {
          messages.push(`${label} overfills the measure: ${amounts}`);

          return;
        }

        if (comparison === 0) return;

        if (!measure.partial) {
          messages.push(`${label} underfills the measure: ${amounts}`);
        } else if (Fraction.compare(total, Fraction.zero()) <= 0) {
          messages.push(`${label} is empty; a partial measure still needs some duration`);
        }
      });
    });

    if (messages.length) return Result.invalid(messages);

    return Result.okNoValue();
  },
};
