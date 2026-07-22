import { Duration } from '@scoregrove/domain/Duration';
import { Fraction } from '@scoregrove/domain/Fraction';
import type { KeySignature } from '@scoregrove/domain/KeySignature';
import { TieRole, type Chord, type Note } from '@scoregrove/domain/MeasureElement';
import { Pitch } from '@scoregrove/domain/Pitch';
import type { Score } from '@scoregrove/domain/Score';
import { measureContentLength } from './MeasureTiming';
import type { PlayStep } from './NavigationUnfolding';
import { PitchSounding } from './PitchSounding';

/**
 * The stage that turns the unfolded play order into a flat stream of sounded
 * events, in **beat time** — positions and durations as exact `Fraction`s of a
 * whole note from the performance's start. Converting those beats to seconds
 * (through the tempo map) is the next stage's job; keeping this one tempo-free
 * means cross-voice alignment stays exact, the same reason engraving spaces on
 * fractions.
 *
 * One event per sounded pitch: a chord yields one per tone at a shared onset;
 * a tie chain folds into a single event spanning the whole chain (the tied-into
 * notes are absorbed, not re-struck). Rests advance time but sound nothing;
 * dynamics take no time.
 *
 * Not yet applied (they await the still-unsettled mapping tables — see
 * playback.md): velocity/dynamics, articulation and slur shaping of duration,
 * fermata lengthening, and grace-note stealing. Those layer on top without
 * changing this stage's shape. Ties are folded by written adjacency, which is
 * exact when the tied measures are performed consecutively (the common case)
 * and a known simplification only at a repeat back-jump.
 */

/**
 * A position in the written score. Structurally identical to engraving's
 * `ScoreAddress`, so it lines up with the rendered element for highlight-sync
 * without either package depending on the other.
 */
export type EventAddress = {
  measure: number;
  staff: number;
  voice: number;
  element: number;
};

/** A stable string key for an address — for joining events to per-element data (e.g. velocities). */
export const addressKey = (address: EventAddress): string =>
  `${address.measure}:${address.staff}:${address.voice}:${address.element}`;

/** One sounded pitch, positioned in beats (whole notes) from the performance start. */
export type BeatEvent = {
  startBeat: Fraction;
  durationBeats: Fraction;
  pitchNumber: number;
  address: EventAddress;
};

/** A pitch begins an event (rather than continuing a tie) unless it is a tie's End or Both. */
const isOnset = (tie: TieRole | undefined): boolean => tie === undefined || tie === TieRole.Begin;

/** The effective key at each measure — the score's key updated by every mid-piece change. */
const effectiveKeys = (score: Score): KeySignature[] => {
  let key = score.key;

  return score.measures.map((measure) => {
    key = measure.key ?? key;

    return key;
  });
};

/** The next sounded (note/chord) element after a position, in the same staff/voice, across measures; undefined at a rest (a broken tie) or the end. */
const nextSounded = (
  score: Score,
  staff: number,
  voice: number,
  measureIndex: number,
  elementIndex: number,
): { measure: number; element: number; sounded: Note | Chord } | undefined => {
  let mi = measureIndex;
  let ei = elementIndex + 1;

  for (;;) {
    const elements = score.measures[mi]?.contents[staff]?.voices[voice]?.elements;

    if (!elements) return undefined;

    while (ei < elements.length) {
      const element = elements[ei];

      if (element.kind === 'dynamic') {
        ei += 1;
        continue;
      }

      if (element.kind === 'note' || element.kind === 'chord') {
        return { measure: mi, element: ei, sounded: element };
      }

      // A rest breaks a tie chain (Score.check forbids a tie across one), so a
      // valid fold never reaches here mid-chain.
      return undefined;
    }

    mi += 1;
    ei = 0;
  }
};

/** The tie role carried on `pitch` within a note or chord tone, or undefined if it doesn't sound that pitch. */
const tieForPitch = (sounded: Note | Chord, pitch: Pitch): TieRole | undefined => {
  if (sounded.kind === 'note') {
    return Pitch.equals(sounded.pitch, pitch) ? sounded.tie : undefined;
  }

  return sounded.tones.find((tone) => Pitch.equals(tone.pitch, pitch))?.tie;
};

/**
 * The sounding length of a pitch, folding a tie chain into one span. A pitch
 * that begins a tie extends through its consecutive continuations (End closes
 * the chain, Both carries it on) — the same adjacency `Score.check` validates.
 */
const foldedDuration = (
  score: Score,
  staff: number,
  voice: number,
  measureIndex: number,
  elementIndex: number,
  pitch: Pitch,
  headTie: TieRole | undefined,
  headDuration: Duration,
): Fraction => {
  let total = Duration.fractionOfWhole(headDuration);

  if (headTie !== TieRole.Begin) return total;

  let mi = measureIndex;
  let ei = elementIndex;

  for (;;) {
    const next = nextSounded(score, staff, voice, mi, ei);

    if (!next) break;

    const tie = tieForPitch(next.sounded, pitch);

    if (tie === undefined) break;

    total = Fraction.add(total, Duration.fractionOfWhole(next.sounded.duration));
    mi = next.measure;
    ei = next.element;

    if (tie !== TieRole.Both) break;
  }

  return total;
};

export const EventFlattening = {
  /**
   * Flattens `score` along `playOrder` (from `NavigationUnfolding`) into beat
   * events, sorted by start. Each performed measure contributes its content at
   * the running offset; the offset advances by the measure's actual filled
   * length, so an underfull pickup doesn't leave a gap before the next bar.
   */
  flatten(score: Score, playOrder: readonly PlayStep[]): BeatEvent[] {
    const keys = effectiveKeys(score);
    const events: BeatEvent[] = [];
    let offset = Fraction.zero();

    for (const step of playOrder) {
      const measureIndex = step.measureIndex;
      const measure = score.measures[measureIndex];
      const key = keys[measureIndex];

      measure.contents.forEach((content, staffIndex) => {
        content.voices.forEach((voice, voiceIndex) => {
          let onset = Fraction.zero();

          voice.elements.forEach((element, elementIndex) => {
            if (element.kind === 'dynamic') return;

            const address: EventAddress = {
              measure: measureIndex,
              staff: staffIndex,
              voice: voiceIndex,
              element: elementIndex,
            };

            if (element.kind === 'note' && isOnset(element.tie)) {
              events.push({
                startBeat: Fraction.add(offset, onset),
                durationBeats: foldedDuration(
                  score,
                  staffIndex,
                  voiceIndex,
                  measureIndex,
                  elementIndex,
                  element.pitch,
                  element.tie,
                  element.duration,
                ),
                pitchNumber: PitchSounding.pitchNumber(element.pitch, key),
                address,
              });
            } else if (element.kind === 'chord') {
              element.tones.forEach((tone) => {
                if (!isOnset(tone.tie)) return;

                events.push({
                  startBeat: Fraction.add(offset, onset),
                  durationBeats: foldedDuration(
                    score,
                    staffIndex,
                    voiceIndex,
                    measureIndex,
                    elementIndex,
                    tone.pitch,
                    tone.tie,
                    element.duration,
                  ),
                  pitchNumber: PitchSounding.pitchNumber(tone.pitch, key),
                  address,
                });
              });
            }

            onset = Fraction.add(onset, Duration.fractionOfWhole(element.duration));
          });
        });
      });

      offset = Fraction.add(offset, measureContentLength(measure));
    }

    return events.sort((a, b) => Fraction.compare(a.startBeat, b.startBeat));
  },
};
