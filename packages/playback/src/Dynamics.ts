import { DynamicChange, DynamicMark } from '@scoregrove/domain/Dynamic';
import type { Score } from '@scoregrove/domain/Score';
import { addressKey } from './EventFlattening';

/**
 * Resolves the written dynamics of a score into a velocity (0–1 loudness) per
 * sounded element, keyed by `addressKey`. A dynamic mark sets the level from
 * the next note onward; the level carries forward until the next mark. Sforzando
 * accents just its one following note; fortepiano hits its note loud then drops
 * to piano.
 *
 * These are performance parameters, freely retunable, so they live here rather
 * than the domain. **Deliberate v1 simplifications (see playback.md):** a
 * crescendo/diminuendo is not yet a gradual ramp — the level simply steps to
 * the next mark's when it arrives; a dynamic applies only to the voice it sits
 * in (not the whole staff); and events with no dynamic take the default.
 */

/** ppp…fff, plus the two accent dynamics; the curve is a starting point, not settled. */
const markVelocity: Record<DynamicMark, number> = {
  Pianississimo: 0.12,
  Pianissimo: 0.22,
  Piano: 0.34,
  MezzoPiano: 0.45,
  MezzoForte: 0.56,
  Forte: 0.7,
  Fortissimo: 0.85,
  Fortississimo: 1.0,
  Sforzando: 0.9,
  Fortepiano: 0.7,
};

const defaultVelocity = markVelocity.MezzoForte;

export const Dynamics = {
  /** The default loudness of a note with no dynamic in force. */
  defaultVelocity,

  /** Velocity per sounded element (note/chord), keyed by `addressKey`. */
  velocities(score: Score): Map<string, number> {
    const result = new Map<string, number>();

    // Dynamic state carries forward across measures within one voice, so walk
    // by (staff, voice) across the whole score rather than measure by measure.
    score.staves.forEach((_staff, staffIndex) => {
      const voiceCount = Math.max(
        0,
        ...score.measures.map((measure) => measure.contents[staffIndex]?.voices.length ?? 0),
      );

      for (let voiceIndex = 0; voiceIndex < voiceCount; voiceIndex += 1) {
        let level = defaultVelocity;
        let pendingAccent: number | null = null;

        score.measures.forEach((measure, measureIndex) => {
          const elements = measure.contents[staffIndex]?.voices[voiceIndex]?.elements;

          if (!elements) return;

          elements.forEach((element, elementIndex) => {
            if (element.kind === 'dynamic') {
              const dynamic = element.dynamic;

              if (DynamicChange.is(dynamic)) return; // ramp deferred; level steps at the next mark

              if (dynamic === DynamicMark.Sforzando) {
                pendingAccent = markVelocity.Sforzando; // one-note accent, level unchanged
              } else if (dynamic === DynamicMark.Fortepiano) {
                pendingAccent = markVelocity.Fortepiano; // loud attack…
                level = markVelocity.Piano; // …then soft
              } else {
                level = markVelocity[dynamic];
              }

              return;
            }

            if (element.kind === 'note' || element.kind === 'chord') {
              const velocity = pendingAccent ?? level;
              pendingAccent = null;

              result.set(
                addressKey({
                  measure: measureIndex,
                  staff: staffIndex,
                  voice: voiceIndex,
                  element: elementIndex,
                }),
                velocity,
              );
            }
            // Rests sound nothing and keep any pending accent for the next note.
          });
        });
      }
    });

    return result;
  },
};
