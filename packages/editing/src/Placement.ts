import { Duration } from '@scoregrove/domain/Duration';
import { Fraction } from '@scoregrove/domain/Fraction';
import { NonEmptyArray } from '@scoregrove/domain/NonEmptyArray';
import { Voice, type Measure } from '@scoregrove/domain/Measure';
import { Note, Rest, type MeasureElement } from '@scoregrove/domain/MeasureElement';
import type { Articulation, Notations } from '@scoregrove/domain/Notations';
import type { Pitch } from '@scoregrove/domain/Pitch';
import { Result } from '@scoregrove/domain/Result';
import type { Score } from '@scoregrove/domain/Score';
import { ContextWalk } from '@scoregrove/engraving/ContextWalk';
import type { ScoreAddress } from '@scoregrove/engraving/LayoutTree';
import { DurationDecomposition } from './DurationDecomposition';
import { DurationOps } from './DurationOps';
import { PitchStepping } from './PitchStepping';
import { RestBacking } from './RestBacking';

/** The onset of the element at `index`, summing written durations before it (dynamics take no time) */
const onsetBefore = (elements: readonly MeasureElement[], index: number): Fraction => {
  let onset = Fraction.zero();

  for (let i = 0; i < index; i += 1) {
    const element = elements[i];

    if (element.kind !== 'dynamic')
      onset = Fraction.add(onset, Duration.fractionOfWhole(element.duration));
  }

  return onset;
};

/**
 * What to place: a sounded note or a rest, at a duration the caller has
 * already chosen (from the pallet's active tool). `notations` carries
 * articulations/fermata forward across an erase-then-replace edit (e.g. the
 * right-click flyout's dot cycle); ordinary pallet placement leaves it
 * unset. Chords aren't placeable in v1 — single-voice, single-pitch editing
 * only.
 */
export type ElementSpec =
  | { kind: 'note'; pitch: Pitch; duration: Duration; notations?: Notations }
  | { kind: 'rest'; duration: Duration };

/**
 * Where to place it: a moment in time (as a fraction of a whole note from
 * the measure's start), not an element index — the caller (interaction
 * geometry, translating a click into a moment) shouldn't need to know which
 * rest currently covers that moment; `place` works that out.
 */
export type PlacementAddress = {
  measure: number;
  staff: number;
  voice: number;
  onset: Fraction;
};

type VoiceLocation = { measure: number; staff: number; voice: number };

const locateVoice = (
  score: Score,
  at: VoiceLocation,
): Result<{ elements: readonly MeasureElement[] }> => {
  const measure = score.measures[at.measure];

  if (!measure) return Result.invalid(`No measure at index ${at.measure}`);

  const content = measure.contents[at.staff];

  if (!content) return Result.invalid(`Measure ${at.measure} has no staff ${at.staff}`);

  const voice = content.voices[at.voice];

  if (!voice)
    return Result.invalid(`Staff ${at.staff} in measure ${at.measure} has no voice ${at.voice}`);

  return Result.ok(voice);
};

/** Rebuilds `score` with one voice's element sequence replaced */
const withVoiceElements = (
  score: Score,
  at: VoiceLocation,
  elements: readonly MeasureElement[],
): Score => ({
  ...score,
  measures: NonEmptyArray.of(
    score.measures.map((measure, measureIndex): Measure => {
      if (measureIndex !== at.measure) return measure;

      return {
        ...measure,
        contents: NonEmptyArray.of(
          measure.contents.map((content, staffIndex) => {
            if (staffIndex !== at.staff) return content;

            return {
              ...content,
              voices: NonEmptyArray.of(
                content.voices.map((voice, voiceIndex) =>
                  voiceIndex === at.voice ? Voice.of(NonEmptyArray.of([...elements])) : voice,
                ),
              ),
            };
          }),
        ),
      };
    }),
  ),
});

type OnsetLocation = { index: number; onset: Fraction; element: MeasureElement };

/**
 * The element covering `target` and where it starts, walking onsets from
 * the top (dynamics take no time and are skipped over). Undefined if
 * `target` falls at or past the end of the voice's content.
 */
const locateOnset = (
  elements: readonly MeasureElement[],
  target: Fraction,
): OnsetLocation | undefined => {
  let onset = Fraction.zero();

  for (let index = 0; index < elements.length; index += 1) {
    const element = elements[index];

    if (element.kind === 'dynamic') continue;

    const end = Fraction.add(onset, Duration.fractionOfWhole(element.duration));

    if (Fraction.compare(target, onset) >= 0 && Fraction.compare(target, end) < 0) {
      return { index, onset, element };
    }

    onset = end;
  }

  return undefined;
};

/**
 * Walking forward from a rest at `startIndex`/`startOnset`, how far a run of
 * *consecutive* rests reaches — as many as it takes to clear `requiredEnd`.
 * Undefined if a non-rest element or the end of the voice is reached first.
 */
const findRestSpan = (
  elements: readonly MeasureElement[],
  startIndex: number,
  startOnset: Fraction,
  requiredEnd: Fraction,
): { endIndex: number; end: Fraction } | undefined => {
  let end = startOnset;
  let index = startIndex;

  while (Fraction.compare(end, requiredEnd) < 0) {
    const element = elements[index];

    if (!element || element.kind !== 'rest') return undefined;

    end = Fraction.add(end, Duration.fractionOfWhole(element.duration));
    index += 1;
  }

  return { endIndex: index - 1, end };
};

export const Placement = {
  /**
   * Places a note or rest at a moment in time, consuming rest time there.
   * The target moment must fall inside a rest (or a contiguous run of them
   * long enough to hold the new duration) — placing over existing sounded
   * content, or past the voice's rest-backed content, fails rather than
   * overwriting or silently clipping. Leftover time on either side of the
   * placed element is re-decomposed into rests, so the measure stays
   * exactly full.
   *
   * Placing past the end of the piece (auto-appending measures) isn't
   * supported yet — a known gap, not a silent behavior change.
   */
  place(score: Score, address: PlacementAddress, spec: ElementSpec): Result<Score> {
    const located = locateVoice(score, address);

    if (!Result.isOk(located)) return Result.mapError(located);

    const { elements } = located.value;
    const at = locateOnset(elements, address.onset);

    if (!at) return Result.invalid('That position falls outside the measure');

    if (at.element.kind !== 'rest') return Result.invalid('That time is already occupied');

    const placedDuration = Duration.fractionOfWhole(spec.duration);
    const placedEnd = Fraction.add(address.onset, placedDuration);
    const span = findRestSpan(elements, at.index, at.onset, placedEnd);

    if (!span) return Result.invalid('Not enough rest time there for that duration');

    const before = DurationDecomposition.decompose(Fraction.subtract(address.onset, at.onset)).map(
      (duration) => Rest.of(duration),
    );
    const after = DurationDecomposition.decompose(Fraction.subtract(span.end, placedEnd)).map(
      (duration) => Rest.of(duration),
    );
    const placed: MeasureElement =
      spec.kind === 'note'
        ? Note.of(spec.pitch, spec.duration, spec.notations ?? {})
        : Rest.of(spec.duration);

    const newElements = [
      ...elements.slice(0, at.index),
      ...before,
      placed,
      ...after,
      ...elements.slice(span.endIndex + 1),
    ];

    return Result.ok(withVoiceElements(score, address, newElements));
  },

  /**
   * Erases the note, rest, or dynamic at `address` (the same address shape
   * rendered elements carry as data-* attributes, so hit-testing feeds
   * straight into this). A note or rest is replaced by rest time, merged
   * with any immediately adjacent rests and re-decomposed — the inverse of
   * `place`. A dynamic (which takes no time) is simply removed.
   *
   * Refuses to erase a chord (not editable yet) or a note carrying a tie or
   * slur role: either would otherwise strand its neighbor's matching role
   * and break `Score.check`, and ties/slurs aren't user-editable in v1, so
   * the safe move is to leave them alone rather than repair them.
   */
  erase(score: Score, address: ScoreAddress): Result<Score> {
    const located = locateVoice(score, address);

    if (!Result.isOk(located)) return Result.mapError(located);

    const { elements } = located.value;
    const target = elements[address.element];

    if (!target) return Result.invalid('No element at that address');

    if (target.kind === 'chord') return Result.invalid('Chords are not editable yet');

    if (target.kind === 'dynamic') {
      const newElements = [
        ...elements.slice(0, address.element),
        ...elements.slice(address.element + 1),
      ];

      if (newElements.length === 0) return Result.invalid('A voice cannot become empty');

      return Result.ok(withVoiceElements(score, address, newElements));
    }

    if (target.kind === 'note' && (target.tie || target.slur)) {
      return Result.invalid('Erasing a tied or slurred note is not supported yet');
    }

    let startIndex = address.element;
    let endIndex = address.element;
    let mergedDuration = Duration.fractionOfWhole(target.duration);

    while (startIndex > 0) {
      const neighbor = elements[startIndex - 1];

      if (neighbor.kind !== 'rest') break;

      startIndex -= 1;
      mergedDuration = Fraction.add(mergedDuration, Duration.fractionOfWhole(neighbor.duration));
    }

    while (endIndex < elements.length - 1) {
      const neighbor = elements[endIndex + 1];

      if (neighbor.kind !== 'rest') break;

      endIndex += 1;
      mergedDuration = Fraction.add(mergedDuration, Duration.fractionOfWhole(neighbor.duration));
    }

    const mergedRests = DurationDecomposition.decompose(mergedDuration).map((duration) =>
      Rest.of(duration),
    );

    const newElements = [
      ...elements.slice(0, startIndex),
      ...mergedRests,
      ...elements.slice(endIndex + 1),
    ];

    return Result.ok(withVoiceElements(score, address, newElements));
  },

  /**
   * Resets one measure, across every staff and voice, to whole rests —
   * "erasing a bar" without shortening the piece (the bar eraser's other
   * reading, deleting the measure column entirely, is a distinct tool this
   * doesn't attempt). Preserves the measure's own key/time/tempo/barline/
   * navigation fields, resetting only its musical content.
   *
   * Refuses the whole reset if the measure contains a chord (not editable
   * yet, on any staff or voice) or a tied/slurred note, for the same reason
   * `erase` refuses one: either would strand something outside this
   * measure and break `Score.check`.
   */
  eraseBar(score: Score, measureIndex: number): Result<Score> {
    const measure = score.measures[measureIndex];

    if (!measure) return Result.invalid(`No measure at index ${measureIndex}`);

    for (const content of measure.contents) {
      for (const voice of content.voices) {
        for (const element of voice.elements) {
          if (element.kind === 'chord') {
            return Result.invalid('This measure has a chord, which is not editable yet');
          }

          if (element.kind === 'note' && (element.tie || element.slur)) {
            return Result.invalid(
              'This measure has a tied or slurred note; erasing it is not supported yet',
            );
          }
        }
      }
    }

    const time = ContextWalk.walk(score)[measureIndex][0].time;

    const resetMeasure: Measure = {
      ...measure,
      contents: NonEmptyArray.of(
        score.staves.map((staff, staffIndex) =>
          RestBacking.emptyStaffContent(time, measure.contents[staffIndex]?.clef ?? staff.clef),
        ),
      ),
    };

    return Result.ok({
      ...score,
      measures: NonEmptyArray.of(
        score.measures.map((m, index) => (index === measureIndex ? resetMeasure : m)),
      ),
    });
  },

  /**
   * Steps a placed note's pitch by a number of semitones (the arrow-key
   * hotkeys), respelling per the key signature in force at that measure and
   * staff. Duration, articulations, and any other notations are untouched —
   * only the pitch changes. Refuses a tied or slurred note for the same
   * reason `erase` does: transposing just one end of a tie or slur would
   * strand its matching pitch on the other side, and neither is
   * user-editable in v1.
   */
  transposeNote(score: Score, address: ScoreAddress, semitones: number): Result<Score> {
    const located = locateVoice(score, address);

    if (!Result.isOk(located)) return Result.mapError(located);

    const { elements } = located.value;
    const target = elements[address.element];

    if (!target) return Result.invalid('No element at that address');

    if (target.kind !== 'note') return Result.invalid('Only a placed note can be transposed');

    if (target.tie || target.slur) {
      return Result.invalid('Transposing a tied or slurred note is not supported yet');
    }

    const key = ContextWalk.walk(score)[address.measure][address.staff].key;
    const stepped = PitchStepping.step(target.pitch, semitones, key);

    if (!Result.isOk(stepped)) return Result.mapError(stepped);

    const newElements = elements.map((element, index) =>
      index === address.element ? { ...target, pitch: stepped.value } : element,
    );

    return Result.ok(withVoiceElements(score, address, newElements));
  },

  /**
   * Rewrites a placed note (the right-click flyout's dot cycle and
   * articulation toggle), reusing `erase` then `place` at the note's own
   * onset so the surrounding rests re-decompose exactly as they would for
   * any other duration change. Refuses a chord, dynamic, rest, or a
   * tied/slurred note, for the same reason `erase` does.
   */
  editNote(score: Score, address: ScoreAddress, transform: (note: Note) => Note): Result<Score> {
    const located = locateVoice(score, address);

    if (!Result.isOk(located)) return Result.mapError(located);

    const { elements } = located.value;
    const target = elements[address.element];

    if (!target) return Result.invalid('No element at that address');

    if (target.kind !== 'note') return Result.invalid('Only a placed note can be edited this way');

    if (target.tie || target.slur) {
      return Result.invalid('Editing a tied or slurred note is not supported yet');
    }

    const onset = onsetBefore(elements, address.element);
    const updated = transform(target);
    const erased = Placement.erase(score, address);

    if (!Result.isOk(erased)) return erased;

    return Placement.place(
      erased.value,
      { measure: address.measure, staff: address.staff, voice: address.voice, onset },
      { kind: 'note', pitch: updated.pitch, duration: updated.duration, notations: updated },
    );
  },

  /** Cycles a placed note's augmentation dots: none → single → double → none */
  cycleDots(score: Score, address: ScoreAddress): Result<Score> {
    return Placement.editNote(score, address, (note) => ({
      ...note,
      duration: DurationOps.cycleDots(note.duration),
    }));
  },

  /** Adds `articulation` to a placed note if absent, removes it if present */
  toggleArticulation(
    score: Score,
    address: ScoreAddress,
    articulation: Articulation,
  ): Result<Score> {
    return Placement.editNote(score, address, (note) => ({
      ...note,
      articulations: DurationOps.toggleArticulation(note.articulations, articulation),
    }));
  },

  /**
   * The current element index at `onset` in one voice. A note's own onset
   * never moves as a result of `cycleDots`/`toggleArticulation` (they
   * re-place at the same onset), but its *index* can — the rests before it
   * get re-decomposed too, and canonical decomposition isn't guaranteed to
   * keep the same element count. A caller re-editing "the same note" across
   * more than one flyout action should re-resolve by onset each time rather
   * than reusing an index from before the previous edit; a raw click only
   * needs this once, since `InteractionGeometry.locate` already resolves an
   * index fresh from the current layout.
   */
  elementAtOnset(
    score: Score,
    location: { measure: number; staff: number; voice: number },
    onset: Fraction,
  ): ScoreAddress | undefined {
    const located = locateVoice(score, location);

    if (!Result.isOk(located)) return undefined;

    const at = locateOnset(located.value.elements, onset);

    if (!at) return undefined;

    return {
      measure: location.measure,
      staff: location.staff,
      voice: location.voice,
      element: at.index,
    };
  },
};
