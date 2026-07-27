import { Measure, StaffContent, Voice } from '@scoregrove/domain/Measure';
import { Chord, Note, TieRole, type MeasureElement } from '@scoregrove/domain/MeasureElement';
import { NonEmptyArray } from '@scoregrove/domain/NonEmptyArray';
import { SlurRole } from '@scoregrove/domain/Notations';
import { Pitch } from '@scoregrove/domain/Pitch';
import type { Warn } from './Reporting';

/**
 * Clears tie and slur roles whose other end is not where the model requires it.
 *
 * ## Why an importer needs this
 *
 * A tie or a slur is a relationship between two noteheads, but our model stores
 * it as a *role* on each end — Begin here, End there — and `Score.check`
 * requires the two to meet inside one voice. Two quite different things break
 * that, and both are ordinary rather than exotic:
 *
 * **A slice cuts a spanner.** Importing measures 128–148 of a 531-measure work
 * takes the end of a slur whose beginning is in measure 127. There is no other
 * end to find, so dropping the orphan is simply correct — nothing is lost that
 * the slice ever contained.
 *
 * **A voice number is not an identity.** MusicXML assigns voice numbers per
 * measure and reuses them freely, so a line can be voice 1 in one bar and voice
 * 2 in the next while the music runs straight on. The Haydn corpus does this
 * once: measure 22 ends on a G4–B4 double stop written as one voice with the G4
 * tied over, and measure 23 separates the lines so the continuation lands in
 * voice 2. Both ends are correct in the source and only the pairing is
 * unreachable for us.
 *
 * The second case is a limitation of our model rather than a defect in the
 * file, and dropping the tie is containment rather than a fix — the ways out
 * are weighed in `haydn-project.md` under "Ties that outlive a voice number".
 * What is deliberately *not* done is renumbering the file's voices to make the
 * ends meet: that would be guessing at the writer's intent to flatter our
 * model, and silently rearranging music to do it.
 *
 * Either way the alternative is worse than dropping. `Score.check` rejects the
 * score outright, and engraving pairs slur roles off a stack — so a stray End
 * does not merely fail to draw, it steals the endpoint of the enclosing slur
 * and mis-draws one we *could* have represented.
 */

/** One end of a tie, located precisely enough to rewrite it */
type TieSlot = {
  element: number;
  /** Which tone of a chord, or undefined for a plain note */
  tone?: number;
  pitch: Pitch;
  role: TieRole;
};

type Drop = { open: boolean; close: boolean };

const opensTie = (role: TieRole) => role === TieRole.Begin || role === TieRole.Both;
const closesTie = (role: TieRole) => role === TieRole.End || role === TieRole.Both;
const opensSlur = (role: SlurRole) => role === SlurRole.Begin || role === SlurRole.Both;
const closesSlur = (role: SlurRole) => role === SlurRole.End || role === SlurRole.Both;

/** The tie ends one element carries — a note has at most one, a chord one per tone */
const tieSlotsOf = (element: MeasureElement, index: number): TieSlot[] => {
  if (Note.is(element)) {
    return element.tie ? [{ element: index, pitch: element.pitch, role: element.tie }] : [];
  }

  if (!Chord.is(element)) return [];

  return element.tones.flatMap((tone, toneIndex) =>
    tone.tie ? [{ element: index, tone: toneIndex, pitch: tone.pitch, role: tone.tie }] : [],
  );
};

/**
 * The role left after removing the ends that could not be matched. Ties and
 * slurs share this because they share a shape — three names meaning the same
 * three things — even though they mean them about different relationships.
 */
const remaining = <T extends TieRole | SlurRole>(
  role: T,
  isOpen: (role: T) => boolean,
  isClose: (role: T) => boolean,
  drop: Drop,
): T | undefined => {
  const keepsOpen = isOpen(role) && !drop.open;
  const keepsClose = isClose(role) && !drop.close;

  if (keepsOpen && keepsClose) return 'Both' as T;
  if (keepsOpen) return 'Begin' as T;
  if (keepsClose) return 'End' as T;

  return undefined;
};

/**
 * The same value with a field replaced, or removed entirely when nothing is
 * left of it — not set to `undefined`, so a cleared role leaves no trace in the
 * persisted JSON.
 */
const withField = <T, K extends keyof T>(value: T, field: K, next: T[K] | undefined): T => {
  const copy = { ...value };

  if (next) copy[field] = next;
  else delete copy[field];

  return copy;
};

export const SpannerReconciliation = {
  /**
   * Returns the measures with every unmatchable tie and slur role removed.
   * Matching is per staff and per voice *index*, which is how `Score.check`
   * reads them, including its rule that a voice disappearing for a measure and
   * returning cannot carry a spanner across the gap.
   */
  apply(measures: readonly Measure[], warn: Warn): Measure[] {
    const tieDrops = new Map<string, Drop>();
    const slurDrops = new Map<string, Drop>();

    const mark = (
      drops: Map<string, Drop>,
      key: string,
      end: 'open' | 'close',
      message: string,
    ) => {
      drops.set(key, { open: false, close: false, ...drops.get(key), [end]: true });
      warn(`${message}; dropping it`);
    };

    const staffCount = measures[0]?.contents.length ?? 0;
    const voiceCount = Math.max(
      0,
      ...measures.flatMap((measure) => measure.contents.map((content) => content.voices.length)),
    );

    for (let staff = 0; staff < staffCount; staff += 1) {
      for (let voice = 0; voice < voiceCount; voice += 1) {
        // Ties awaiting the *very next* sounding element, which is what a tie
        // is: a matching pitch several elements later is a different tie. Slurs
        // instead nest, so they are a stack and may span any distance.
        let pendingTies: { key: string; slot: TieSlot; measure: number }[] = [];
        const openSlurs: { key: string; measure: number }[] = [];
        let lastMeasure: number | undefined;

        const abandonTies = (reason: string) => {
          for (const pending of pendingTies) {
            mark(
              tieDrops,
              pending.key,
              'open',
              `Measure ${pending.measure}: the tie begun on ${Pitch.format(pending.slot.pitch)} ${reason}`,
            );
          }

          pendingTies = [];
        };

        measures.forEach((measure, measureIndex) => {
          const elements = measure.contents[staff]?.voices[voice]?.elements;

          if (!elements) return;

          if (lastMeasure !== undefined && lastMeasure !== measureIndex - 1) {
            abandonTies('is never continued in this voice');
          }

          lastMeasure = measureIndex;

          elements.forEach((element, elementIndex) => {
            if (element.kind === 'dynamic') return;

            if (element.kind === 'rest') {
              abandonTies('is interrupted by a rest');

              return;
            }

            const slots = tieSlotsOf(element, elementIndex);
            const keyOf = (slot: TieSlot) => `${measureIndex}:${slot.element}:${slot.tone ?? -1}`;
            const incoming = slots.filter((slot) => closesTie(slot.role));

            for (const pending of pendingTies) {
              if (!incoming.some(({ pitch }) => Pitch.equals(pitch, pending.slot.pitch))) {
                mark(
                  tieDrops,
                  pending.key,
                  'open',
                  `Measure ${pending.measure}: the tie begun on ` +
                    `${Pitch.format(pending.slot.pitch)} is not continued by the element that follows it`,
                );
              }
            }

            for (const slot of incoming) {
              if (!pendingTies.some(({ slot: open }) => Pitch.equals(open.pitch, slot.pitch))) {
                mark(
                  tieDrops,
                  keyOf(slot),
                  'close',
                  `Measure ${measureIndex}: the tie ended on ${Pitch.format(slot.pitch)} was never begun in this voice`,
                );
              }
            }

            pendingTies = slots
              .filter((slot) => opensTie(slot.role))
              .map((slot) => ({ key: keyOf(slot), slot, measure: measureIndex }));

            const slurKey = `${measureIndex}:${elementIndex}`;

            if (element.slur && closesSlur(element.slur)) {
              if (openSlurs.length) openSlurs.pop();
              else {
                mark(
                  slurDrops,
                  slurKey,
                  'close',
                  `Measure ${measureIndex}: a slur ends that was never begun in this voice`,
                );
              }
            }

            if (element.slur && opensSlur(element.slur)) {
              openSlurs.push({ key: slurKey, measure: measureIndex });
            }
          });
        });

        abandonTies('is never continued in this voice');

        for (const open of openSlurs) {
          mark(
            slurDrops,
            open.key,
            'open',
            `Measure ${open.measure}: a slur begins that is never closed in this voice`,
          );
        }
      }
    }

    if (!tieDrops.size && !slurDrops.size) return [...measures];

    return measures.map((measure, measureIndex) => ({
      ...measure,
      contents: NonEmptyArray.of(
        measure.contents.map((content) =>
          StaffContent.of(
            NonEmptyArray.of(
              content.voices.map((voice) =>
                Voice.of(
                  NonEmptyArray.of(
                    voice.elements.map((element, elementIndex) => {
                      const slurDrop = slurDrops.get(`${measureIndex}:${elementIndex}`);
                      const tieDrop = (tone: number) =>
                        tieDrops.get(`${measureIndex}:${elementIndex}:${tone}`);

                      let next = element;

                      if ((Note.is(next) || Chord.is(next)) && next.slur && slurDrop) {
                        next = withField(
                          next,
                          'slur',
                          remaining(next.slur, opensSlur, closesSlur, slurDrop),
                        );
                      }

                      if (Note.is(next) && next.tie) {
                        const drop = tieDrop(-1);

                        if (drop) {
                          next = withField(
                            next,
                            'tie',
                            remaining(next.tie, opensTie, closesTie, drop),
                          );
                        }
                      }

                      if (Chord.is(next)) {
                        next = {
                          ...next,
                          tones: NonEmptyArray.of(
                            next.tones.map((tone, toneIndex) => {
                              const drop = tone.tie ? tieDrop(toneIndex) : undefined;

                              if (!drop || !tone.tie) return tone;

                              return withField(
                                tone,
                                'tie',
                                remaining(tone.tie, opensTie, closesTie, drop),
                              );
                            }),
                          ),
                        };
                      }

                      return next;
                    }),
                  ),
                ),
              ),
            ),
            content.clef,
          ),
        ),
      ),
    }));
  },
};
