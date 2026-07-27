import { Chord, Note } from '@scoregrove/domain/MeasureElement';
import { Articulation } from '@scoregrove/domain/Notations';
import type { Score } from '@scoregrove/domain/Score';
import { addressKey } from './EventFlattening';

/**
 * How an attack mark shapes the note it sits on: how much of its written length
 * actually sounds, and how hard it is struck.
 *
 * Two knobs, because that is what the marks mean. Staccato and staccatissimo
 * shorten the sound without moving anything — the next note begins exactly when
 * it was written to, and the gap is what a listener hears as detachment.
 * Accent and marcato leave the length alone and hit harder. Nothing here shifts
 * a start time, which is what keeps articulation independent of the tempo map.
 *
 * These are performance parameters, freely retunable, so they live in playback
 * rather than the domain — the same reasoning as `Dynamics`.
 *
 * ## Tenuto is a deliberate no-op
 *
 * A note with no articulation already sounds its **full** written length, so
 * "tenuto sustains" is nothing to add. Making it audible means giving
 * unarticulated notes a shorter default — a detaché of perhaps 0.9 — so that
 * tenuto's full length reads as held against it. That is a real change to how
 * every note sounds, needs an ear to judge, and belongs with the bowed-envelope
 * work rather than here; the table below is written so it is one number when
 * that comes.
 */

/** What fraction of its written length a marked note sounds for */
const durationScale: Record<Articulation, number> = {
  Staccato: 0.5,
  Staccatissimo: 0.3,
  // Full length, which is also the unmarked default — see the header
  Tenuto: 1,
  Accent: 1,
  Marcato: 1,
};

/** How much harder a marked note is struck, as a multiplier on its velocity */
const velocityScale: Record<Articulation, number> = {
  Staccato: 1,
  Staccatissimo: 1,
  Tenuto: 1,
  Accent: 1.3,
  Marcato: 1.45,
};

/** How a note's written length and velocity are adjusted by its marks */
export type Shaping = {
  duration: number;
  velocity: number;
};

const unshaped: Shaping = { duration: 1, velocity: 1 };

/**
 * Several marks combine by taking the strongest of each: a note that is both
 * staccato and accented is short *and* loud, rather than one or the other
 * depending on which was written first.
 */
const shapingOf = (articulations: readonly Articulation[]): Shaping =>
  articulations.reduce<Shaping>(
    (shaping, articulation) => ({
      duration: Math.min(shaping.duration, durationScale[articulation]),
      velocity: Math.max(shaping.velocity, velocityScale[articulation]),
    }),
    unshaped,
  );

export const Articulations = {
  unshaped,

  /** The shaping for one set of marks, exposed for testing the table itself */
  shapingOf,

  /**
   * Shaping per sounded element, keyed by `addressKey`. Elements with no marks
   * are absent rather than mapped to the identity, so a caller can tell "no
   * articulation" from "articulated, and it happens to change nothing".
   */
  shapings(score: Score): Map<string, Shaping> {
    const result = new Map<string, Shaping>();

    score.measures.forEach((measure, measureIndex) => {
      measure.contents.forEach((content, staff) => {
        content.voices.forEach((voice, voiceIndex) => {
          voice.elements.forEach((element, elementIndex) => {
            if (!Note.is(element) && !Chord.is(element)) return;
            if (!element.articulations?.length) return;

            result.set(
              addressKey({
                measure: measureIndex,
                staff,
                voice: voiceIndex,
                element: elementIndex,
              }),
              shapingOf(element.articulations),
            );
          });
        });
      });
    });

    return result;
  },
};
