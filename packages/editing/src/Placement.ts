import { Duration } from '@scoregrove/domain/Duration';
import { Fraction } from '@scoregrove/domain/Fraction';
import { NonEmptyArray } from '@scoregrove/domain/NonEmptyArray';
import { Voice, type Measure } from '@scoregrove/domain/Measure';
import { Chord, Note, Rest, type MeasureElement } from '@scoregrove/domain/MeasureElement';
import type { Articulation, Notations } from '@scoregrove/domain/Notations';
import { Pitch } from '@scoregrove/domain/Pitch';
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
 * unset. Chords are never placed directly through `spec` — a chord is
 * formed by placing a second `note` at an onset a same-duration note or
 * chord already occupies (see `place`'s `formChord` branch).
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

/**
 * Adds a pitch to whatever note or chord already sits at this onset, forming
 * or extending a chord — the second (or third, etc.) tone at one beat. Same
 * duration is required (a chord is one written duration for every tone); no
 * rest re-decomposition is needed, since the element being replaced doesn't
 * change length, just which pitches sound. Refuses a tied or slurred note or
 * chord, for the same reason `erase` does: neither role is user-editable in
 * v1, and merging into one would leave the tie/slur ambiguous about which
 * tone it now belongs to.
 */
const formChord = (
  score: Score,
  address: PlacementAddress,
  spec: Extract<ElementSpec, { kind: 'note' }>,
  elements: readonly MeasureElement[],
  at: OnsetLocation,
): Result<Score> => {
  const { element } = at;

  if (element.kind === 'note') {
    if (element.tie || element.slur) {
      return Result.invalid('Adding to a tied or slurred note is not supported yet');
    }

    const chordResult = Chord.create([element.pitch, spec.pitch], element.duration, {
      articulations: element.articulations,
      fermata: element.fermata,
      graces: element.graces,
      lyrics: element.lyrics,
    });

    if (!Result.isOk(chordResult)) return Result.mapError(chordResult);

    const newElements = elements.map((el, index) => (index === at.index ? chordResult.value : el));

    return Result.ok(withVoiceElements(score, address, newElements));
  }

  if (element.kind === 'chord') {
    if (element.slur || element.tones.some((tone) => tone.tie)) {
      return Result.invalid('Adding to a tied or slurred chord is not supported yet');
    }

    const chordResult = Chord.create([...element.tones, spec.pitch], element.duration, {
      articulations: element.articulations,
      fermata: element.fermata,
      graces: element.graces,
      lyrics: element.lyrics,
    });

    if (!Result.isOk(chordResult)) return Result.mapError(chordResult);

    const newElements = elements.map((el, index) => (index === at.index ? chordResult.value : el));

    return Result.ok(withVoiceElements(score, address, newElements));
  }

  return Result.invalid('That time is already occupied');
};

/**
 * Removes one tone from a chord (the eraser clicked on a chord, targeting
 * whichever pitch the click landed nearest — the caller derives that pitch
 * the same way `place` derives one to add). Collapses back to a plain `Note`
 * once only one tone is left, rather than leaving a one-tone "chord" around.
 * Refuses if `targetPitch` doesn't exactly match a tone, or if the chord (or
 * the matched tone) carries a tie/slur, for the same reason `erase` refuses
 * those on a plain note.
 */
const removeChordTone = (
  score: Score,
  address: ScoreAddress,
  chord: Chord,
  targetPitch: Pitch,
  elements: readonly MeasureElement[],
): Result<Score> => {
  if (chord.slur) return Result.invalid('Erasing part of a slurred chord is not supported yet');

  const toneIndex = chord.tones.findIndex((tone) => Pitch.equals(tone.pitch, targetPitch));

  if (toneIndex === -1) return Result.invalid('No matching pitch in that chord');

  if (chord.tones.some((tone) => tone.tie)) {
    return Result.invalid('Erasing part of a tied chord is not supported yet');
  }

  const remaining = chord.tones.filter((_tone, index) => index !== toneIndex);
  const sharedNotations: Notations = {
    articulations: chord.articulations,
    fermata: chord.fermata,
    graces: chord.graces,
    lyrics: chord.lyrics,
  };

  if (remaining.length === 1) {
    const [lone] = remaining;
    const note = Note.of(lone.pitch, chord.duration, { tie: lone.tie, ...sharedNotations });
    const newElements = elements.map((el, index) => (index === address.element ? note : el));

    return Result.ok(withVoiceElements(score, address, newElements));
  }

  const chordResult = Chord.create(remaining, chord.duration, sharedNotations);

  if (!Result.isOk(chordResult)) return Result.mapError(chordResult);

  const newElements = elements.map((el, index) =>
    index === address.element ? chordResult.value : el,
  );

  return Result.ok(withVoiceElements(score, address, newElements));
};

export const Placement = {
  /**
   * Places a note or rest at a moment in time, consuming rest time there.
   * The target moment must fall inside a rest (or a contiguous run of them
   * long enough to hold the new duration) — placing over existing sounded
   * content, or past the voice's rest-backed content, fails rather than
   * overwriting or silently clipping, *unless* it's a note landing exactly
   * on an existing note or chord of the same duration, in which case it
   * forms or extends a chord instead (see `formChord`) — the pallet's note
   * tool clicked twice on one beat is how a chord gets built. Leftover time
   * on either side of a fresh placement is re-decomposed into rests, so the
   * measure stays exactly full.
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

    if (at.element.kind !== 'rest') {
      if (
        spec.kind === 'note' &&
        Fraction.equals(at.onset, address.onset) &&
        (at.element.kind === 'note' || at.element.kind === 'chord') &&
        Duration.equals(at.element.duration, spec.duration)
      ) {
        return formChord(score, address, spec, elements, at);
      }

      return Result.invalid('That time is already occupied');
    }

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
   * A chord needs `targetPitch` (the eraser click's derived pitch, same as
   * `place` would use to add a tone) to know *which* tone to remove — it's
   * removed from the chord, or the chord collapses to a plain `Note` if one
   * tone is left. Without a `targetPitch`, a chord is refused outright
   * (unchanged from before chords were placeable), since there's no
   * reasonable single tone to pick.
   *
   * Refuses a note carrying a tie or slur role: it would otherwise strand
   * its neighbor's matching role and break `Score.check`, and ties/slurs
   * aren't user-editable in v1, so the safe move is to leave them alone
   * rather than repair them.
   */
  erase(score: Score, address: ScoreAddress, targetPitch?: Pitch): Result<Score> {
    const located = locateVoice(score, address);

    if (!Result.isOk(located)) return Result.mapError(located);

    const { elements } = located.value;
    const target = elements[address.element];

    if (!target) return Result.invalid('No element at that address');

    if (target.kind === 'chord') {
      if (!targetPitch) return Result.invalid('Chords are not editable yet');

      return removeChordTone(score, address, target, targetPitch, elements);
    }

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
   * doesn't attempt). Preserves the measure's own clef change (if it
   * genuinely has one), key/time/tempo change, barline, and navigation
   * fields, resetting only its musical content. An ordinary chord resets
   * along with everything else — a chord doesn't reach outside its own
   * measure, so wiping the whole bar is safe the same way it is for a
   * plain note.
   *
   * Leaves a staff's clef unset when the measure didn't already carry a
   * change there, rather than filling in the staff's starting clef: an
   * explicit `StaffContent.clef` means "a change happens here," and
   * `ContextWalk` already carries the previous effective clef forward on
   * its own — the same reasoning `MeasureOps.addMeasure` follows.
   *
   * Refuses the whole reset only if the measure contains a tied or slurred
   * note, or a chord carrying a tie on any tone or a chord-level slur: any
   * of those would strand its matching role in an adjacent measure and
   * break `Score.check`, and ties/slurs aren't user-editable in v1.
   */
  eraseBar(score: Score, measureIndex: number): Result<Score> {
    const measure = score.measures[measureIndex];

    if (!measure) return Result.invalid(`No measure at index ${measureIndex}`);

    for (const content of measure.contents) {
      for (const voice of content.voices) {
        for (const element of voice.elements) {
          if (element.kind === 'note' && (element.tie || element.slur)) {
            return Result.invalid(
              'This measure has a tied or slurred note; erasing it is not supported yet',
            );
          }

          if (
            element.kind === 'chord' &&
            (element.slur || element.tones.some((tone) => tone.tie))
          ) {
            return Result.invalid(
              'This measure has a tied or slurred chord; erasing it is not supported yet',
            );
          }
        }
      }
    }

    const time = ContextWalk.walk(score)[measureIndex][0].time;

    const resetMeasure: Measure = {
      ...measure,
      contents: NonEmptyArray.of(
        score.staves.map((_staff, staffIndex) =>
          RestBacking.emptyStaffContent(time, measure.contents[staffIndex]?.clef),
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
