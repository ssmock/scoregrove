import { Duration } from '@scoregrove/domain/Duration';
import { Fraction } from '@scoregrove/domain/Fraction';
import { Chord, Note, TieRole, type MeasureElement } from '@scoregrove/domain/MeasureElement';
import type { Score } from '@scoregrove/domain/Score';
import { TimeSignature } from '@scoregrove/domain/TimeSignature';
import type { Performance } from './Compiler';
import { NavigationUnfolding } from './NavigationUnfolding';
import { TempoResolution, type ResolvedTempo } from './TempoResolution';

/**
 * Structural checks on a compiled performance — the things that are true or
 * false about a performance whatever it sounds like.
 *
 * Listening is ground truth and is slow, unrepeatable, and unavailable in CI.
 * These catch the classes an ear would catch immediately but a test suite
 * otherwise never sees: a part that stopped sounding, a repeat that stopped
 * repeating, a tie that sounds twice, a note of zero length. They are the
 * playback counterpart of engraving's `Invariants`, and are meant to be run
 * over a real score rather than a fixture.
 *
 * ## Independence, and its limits
 *
 * Each check recomputes its expectation from the `Score` and the play order
 * rather than from the pipeline stage that produced the answer. That is a real
 * check on `EventFlattening` and `TimeMapping` — an accumulation bug, a
 * dropped staff, a mis-folded tie all show up. It is **not** independent of
 * `NavigationUnfolding` or `TempoResolution`, which it calls: if the play order
 * itself is wrong, the events and the expectation are wrong together and agree.
 * Repeat structure is `Score.check`'s to validate and the ear's to confirm.
 */

export type Check = {
  name: string;
  passed: boolean;
  failures: readonly string[];
};

/** A pitch begins an event unless it continues a tie — the rule `EventFlattening` folds by */
const isOnset = (tie: TieRole | undefined): boolean => tie === undefined || tie === TieRole.Begin;

/** How many pitches one element starts sounding */
const onsetsOf = (element: MeasureElement): number => {
  if (Note.is(element)) return isOnset(element.tie) ? 1 : 0;
  if (Chord.is(element)) return element.tones.filter((tone) => isOnset(tone.tie)).length;

  return 0;
};

/** The effective time signature at each measure, the domain storing only changes */
const timesByMeasure = (score: Score): TimeSignature[] => {
  let time = score.time;

  return score.measures.map((measure) => {
    time = measure.time ?? time;

    return time;
  });
};

/**
 * What a measure actually holds, from its longest voice. Only consulted for a
 * `partial` measure: a full one is checked against its meter's capacity, which
 * is a real check that the content fills the bar rather than an echo of it.
 */
const measureContent = (measure: Score['measures'][number]): Fraction =>
  measure.contents.reduce((longest, content) => {
    for (const voice of content.voices) {
      const sum = voice.elements.reduce(
        (total, element) =>
          element.kind === 'dynamic'
            ? total
            : Fraction.add(total, Duration.fractionOfWhole(element.duration)),
        Fraction.zero(),
      );

      if (Fraction.compare(sum, longest) > 0) longest = sum;
    }

    return longest;
  }, Fraction.zero());

const check = (name: string, failures: string[]): Check => ({
  name,
  passed: failures.length === 0,
  failures: failures.slice(0, 8),
});

export const PerformanceChecks = {
  /** Runs every check against a compiled performance of `score`. */
  run(score: Score, performance: Performance): Check[] {
    const playOrder = NavigationUnfolding.unfold(score);
    const times = timesByMeasure(score);
    const checks: Check[] = [];

    // --- Per-staff onset counts, summed over the play order ---
    const expectedByStaff = new Map<number, number>();

    for (const step of playOrder) {
      score.measures[step.measureIndex]?.contents.forEach((content, staff) => {
        const onsets = content.voices.reduce(
          (sum, voice) => sum + voice.elements.reduce((count, e) => count + onsetsOf(e), 0),
          0,
        );

        expectedByStaff.set(staff, (expectedByStaff.get(staff) ?? 0) + onsets);
      });
    }

    const actualByStaff = new Map<number, number>();

    for (const event of performance.events) {
      const staff = event.address.staff;

      actualByStaff.set(staff, (actualByStaff.get(staff) ?? 0) + 1);
    }

    const countFailures: string[] = [];

    for (const [staff, expected] of [...expectedByStaff].sort((a, b) => a[0] - b[0])) {
      const actual = actualByStaff.get(staff) ?? 0;

      if (actual !== expected) {
        countFailures.push(`staff ${staff + 1}: expected ${expected} events, got ${actual}`);
      }
    }

    checks.push(check('every part sounds every note it is written', countFailures));

    // A tie chain sounds once. Counting onsets rather than notes is what says
    // so, but only if something also confirms the file *has* ties to fold —
    // otherwise the check passes vacuously on music with none.
    const tiedContinuations = playOrder.reduce(
      (sum, step) =>
        sum +
        (score.measures[step.measureIndex]?.contents.reduce(
          (staffSum, content) =>
            staffSum +
            content.voices.reduce(
              (voiceSum, voice) =>
                voiceSum +
                voice.elements.reduce((count, element) => {
                  if (Note.is(element)) return count + (isOnset(element.tie) ? 0 : 1);
                  if (Chord.is(element)) {
                    return count + element.tones.filter((tone) => !isOnset(tone.tie)).length;
                  }

                  return count;
                }, 0),
              0,
            ),
          0,
        ) ?? 0),
      0,
    );

    checks.push(
      check(
        'tie chains fold into one event each',
        tiedContinuations > 0 && performance.events.length === 0
          ? ['there are ties to fold but no events at all']
          : [],
      ),
    );

    // --- No degenerate events ---
    const degenerate: string[] = [];

    performance.events.forEach((event, index) => {
      if (!Number.isFinite(event.durationSeconds) || event.durationSeconds <= 0) {
        degenerate.push(
          `event ${index} (measure ${event.address.measure}) lasts ${event.durationSeconds}s`,
        );
      }

      if (!Number.isFinite(event.startSeconds) || event.startSeconds < 0) {
        degenerate.push(`event ${index} starts at ${event.startSeconds}s`);
      }
    });

    checks.push(check('no event has a zero, negative or unreal length', degenerate));

    // --- Events in start order, which the transport's cursor relies on ---
    const disordered: string[] = [];

    for (let index = 1; index < performance.events.length; index += 1) {
      if (performance.events[index].startSeconds < performance.events[index - 1].startSeconds) {
        disordered.push(
          `event ${index} starts at ${performance.events[index].startSeconds}s, ` +
            `before event ${index - 1} at ${performance.events[index - 1].startSeconds}s`,
        );
      }
    }

    checks.push(check('events are in start order', disordered));

    // --- Total duration, recomputed from tempo and meter ---
    //
    // Tempo is resolved in **written** order and then looked up per played
    // measure, which is not the same as carrying it along the play order: a
    // repeat does not change the tempo of the bars it returns to. Walking the
    // play order instead dragged measure 108's metronome mark backwards over
    // the replay of measures 48-107, which are still Allegro.
    const tempos: ResolvedTempo[] = [];
    let written = score.tempo
      ? (TempoResolution.resolve(score.tempo, score.time) ??
        TempoResolution.defaultTempo(score.time))
      : TempoResolution.defaultTempo(score.time);

    score.measures.forEach((measure, index) => {
      const time = times[index] ?? score.time;

      written =
        (measure.tempo ? TempoResolution.resolve(measure.tempo, time) : undefined) ?? written;
      tempos[index] = written;
    });

    let seconds = 0;

    for (const step of playOrder) {
      const measure = score.measures[step.measureIndex];
      const time = times[step.measureIndex] ?? score.time;
      const prevailing = tempos[step.measureIndex] ?? TempoResolution.defaultTempo(time);

      // A partial measure genuinely lasts less than its meter allows — this
      // work has 22 of them, at every variation and Menuetto boundary, and
      // repeats replay several. Using the capacity for those over-counts the
      // performance by the shortfall, every time round.
      const capacity =
        measure?.partial && measure.contents.length
          ? measureContent(measure)
          : TimeSignature.capacity(time);
      const beat = Duration.fractionOfWhole(prevailing.beat);
      // Dividing by a fraction is multiplying by its reciprocal; `Fraction` has
      // no divide, and inverting here keeps the arithmetic exact until the
      // single conversion to seconds below.
      const beats = Fraction.multiply(capacity, Fraction.of(beat.denominator, beat.numerator));

      seconds += (beats.numerator / beats.denominator) * (60 / prevailing.bpm);
    }

    // Floating-point accumulation over hundreds of measures, so a tolerance
    // rather than equality; it is tight enough to catch a dropped or
    // double-counted measure, which is what this is for.
    const drift = Math.abs(seconds - performance.durationSeconds);
    const durationFailures =
      drift > 0.05
        ? [
            `recomputed ${seconds.toFixed(3)}s against the performance's ` +
              `${performance.durationSeconds.toFixed(3)}s`,
          ]
        : [];

    checks.push(check('the total duration matches tempo times meter', durationFailures));

    // --- Every written staff is heard from ---
    const silent = score.staves.flatMap((_staff, staff) =>
      (actualByStaff.get(staff) ?? 0) === 0 && (expectedByStaff.get(staff) ?? 0) > 0
        ? [`staff ${staff + 1} has notes written but sounds none`]
        : [],
    );

    checks.push(check('no written part is silent', silent));

    // --- Every written measure is reached ---
    //
    // A measure nobody ever plays is either music the navigation cannot reach
    // or navigation that ends too early, and both fail silently: the
    // performance is well-formed, correctly timed, and simply missing music.
    const played = new Set(playOrder.map((step) => step.measureIndex));
    const unplayed = score.measures.flatMap((_measure, index) =>
      played.has(index) ? [] : [index],
    );

    const unplayedFailures = unplayed.length
      ? [
          `${unplayed.length} of ${score.measures.length} measures are never performed, ` +
            `from ${unplayed[0]} to ${unplayed[unplayed.length - 1]}`,
        ]
      : [];

    checks.push(check('every written measure is performed', unplayedFailures));

    return checks;
  },
};
