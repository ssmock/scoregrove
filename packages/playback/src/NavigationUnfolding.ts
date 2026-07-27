import { ClosingBarline, OpeningBarline } from '@scoregrove/domain/Barline';
import type { Measure } from '@scoregrove/domain/Measure';
import { NavigationJump, NavigationMark } from '@scoregrove/domain/Navigation';
import type { Score } from '@scoregrove/domain/Score';

/**
 * The first pipeline stage over a whole score: flattening its written
 * repeats, volta endings, and D.C./D.S. jumps into the linear order the
 * measures are actually performed in. Everything downstream (event
 * flattening, the tempo map, highlight sync) walks this order, not
 * `score.measures` directly.
 *
 * A `PlayStep` names a measure and which time through it this is. The same
 * measure appears once per pass — a repeated section yields several steps for
 * the same `measureIndex`, distinguished by `pass`.
 *
 * The traversal is a stateful cursor honoring the domain's navigation model,
 * relying on the structure `Score.check` already guarantees (repeats never
 * nest and always close; a `RepeatClose` with no matching open repeats from
 * the start; volta chains cover 1..max contiguously and every non-final
 * bracket closes with a repeat; every jump's target landmark exists).
 *
 * Two deliberate conventions at the hard corners, matching common notation
 * software and flagged in playback.md:
 *   - A D.C./D.S. jump is taken once, and on the traversal it starts, inner
 *     repeats are not taken again (each plays through a single time).
 *   - On that post-jump traversal, volta groups take their final ending (the
 *     passage that continues onward), skipping earlier ones.
 *
 * ## Sections
 *
 * `Capo` marks divide the score into **navigation sections**, and every jump
 * and landmark resolves inside the one it belongs to. A da capo returns to its
 * section's head; a dal segno finds the Segno in its own section; and an *al
 * Fine* return ends **that section** rather than the piece, with the
 * performance continuing at the section that follows.
 *
 * That last point is why this exists. The Haydn quartet is four movements in
 * one `Score`: the Menuetto's D.C. al Fine used to stop the whole performance
 * at the Fine in measure 294, leaving **190 measures — the entire finale —
 * never played**, in a performance that was otherwise well-formed and
 * correctly timed. Nothing but a structural check or a listener sitting
 * through eighteen minutes would have noticed.
 *
 * A score with no `Capo` is a single section, which is every ordinary piece
 * and exactly the previous behaviour.
 */

/** One measure to play, tagged with which time through it this is (1 = first sounding, 2 = second, …). */
export type PlayStep = {
  measureIndex: number;
  pass: number;
};

const dalSegnoJumps: ReadonlySet<NavigationJump> = new Set([
  NavigationJump.DalSegno,
  NavigationJump.DalSegnoAlFine,
  NavigationJump.DalSegnoAlCoda,
]);
const alFineJumps: ReadonlySet<NavigationJump> = new Set([
  NavigationJump.DaCapoAlFine,
  NavigationJump.DalSegnoAlFine,
]);
const alCodaJumps: ReadonlySet<NavigationJump> = new Set([
  NavigationJump.DaCapoAlCoda,
  NavigationJump.DalSegnoAlCoda,
]);

/** Where a section begins: the nearest `Capo` at or before `from`, else measure 0 */
const sectionStartOf = (measures: readonly Measure[], from: number): number => {
  for (let i = from; i >= 0; i -= 1) {
    if (measures[i].marks?.includes(NavigationMark.Capo)) return i;
  }

  return 0;
};

/**
 * The RepeatOpen a RepeatClose loops back to, or its **section's** head when it
 * has none.
 *
 * The section part is not a detail. The Haydn finale's repeat has no open of
 * its own, and falling back to measure 0 sent it into the first movement — and
 * worse, made its volta chain share a pass counter with a repeat 400 measures
 * earlier, so the finale's first ending was gated out by a count left over from
 * movement I and never played at all.
 */
const matchingOpen = (measures: readonly Measure[], closeIndex: number): number => {
  if (measures[closeIndex].opening === OpeningBarline.RepeatOpen) return closeIndex;

  const head = sectionStartOf(measures, closeIndex);

  for (let i = closeIndex - 1; i >= head; i -= 1) {
    // A prior repeat's close means this one has no open of its own — it repeats
    // from the section's head, not into an already-closed passage.
    if (measures[i].closing === ClosingBarline.RepeatClose) return head;
    if (measures[i].opening === OpeningBarline.RepeatOpen) return i;
  }

  return head;
};

const sameNumbers = (a: readonly number[], b: readonly number[]): boolean =>
  a.length === b.length && a.every((n, i) => n === b[i]);

type VoltaInfo = {
  /** The highest passage number in this measure's volta chain (its final ending) */
  chainMax: number;
  /** The RepeatOpen index of the repeat this chain belongs to */
  governingOpen: number;
};

/**
 * Groups volta measures into chains exactly as `Score.check` does, then maps
 * each volta measure to its chain's max passage and governing repeat, the two
 * facts the walk needs to decide whether a given ending plays on the current
 * pass.
 */
const voltaInfo = (measures: readonly Measure[]): Map<number, VoltaInfo> => {
  type Bracket = { numbers: number[]; start: number; end: number };
  const chains: Bracket[][] = [];

  measures.forEach((measure, i) => {
    if (!measure.ending) return;

    const numbers = [...measure.ending].map((n) => n as number).sort((a, b) => a - b);
    const chain = chains.at(-1);
    const bracket = chain?.at(-1);
    const continuesChain = bracket !== undefined && bracket.end === i - 1;

    if (continuesChain && sameNumbers(bracket.numbers, numbers)) {
      bracket.end = i;
    } else if (continuesChain && chain !== undefined) {
      chain.push({ numbers, start: i, end: i });
    } else {
      chains.push([{ numbers, start: i, end: i }]);
    }
  });

  const info = new Map<number, VoltaInfo>();

  for (const chain of chains) {
    const chainMax = Math.max(...chain.flatMap((bracket) => bracket.numbers));
    const closing = chain.find(
      (bracket) => measures[bracket.end].closing === ClosingBarline.RepeatClose,
    );
    const governingOpen = matchingOpen(measures, (closing ?? chain[0]).end);

    for (const bracket of chain) {
      for (let i = bracket.start; i <= bracket.end; i += 1) {
        info.set(i, { chainMax, governingOpen });
      }
    }
  }

  return info;
};

export const NavigationUnfolding = {
  /**
   * The measure indices to perform, in order, each tagged with its pass. A
   * score with no repeats or jumps yields its measures once, in order.
   */
  unfold(score: Score): PlayStep[] {
    const measures = score.measures;
    const count = measures.length;

    /**
     * Where a da capo at `from` returns to, and equally where its section
     * begins: the nearest preceding Capo mark, or measure 0 when there is none
     * — "the head" of an ordinary single-section score.
     */
    const sectionStartAt = (from: number): number => sectionStartOf(measures, from);

    /** The last measure of the section containing `from` */
    const sectionEndAt = (from: number): number => {
      for (let i = from + 1; i < count; i += 1) {
        if (measures[i].marks?.includes(NavigationMark.Capo)) return i - 1;
      }

      return count - 1;
    };

    /** The first measure carrying `mark` within a section, or -1 */
    const markIn = (mark: NavigationMark, start: number, end: number): number => {
      for (let i = start; i <= end; i += 1) {
        if (measures[i].marks?.includes(mark)) return i;
      }

      return -1;
    };
    const voltas = voltaInfo(measures);

    const output: PlayStep[] = [];
    const occurrences = new Map<number, number>();
    const passAtOpen = new Map<number, number>();
    const jumpsTaken = new Set<number>();

    let suppressRepeats = false;
    let stopAtFine = false;
    let toCodaActive = false;
    /** The Fine that ends the section a taken al Fine jump belongs to */
    let fineIndex = -1;
    /** The Coda the armed al Coda jump seeks, within its own section */
    let codaIndex = -1;
    /** Where to carry on once an al Fine return has ended its section */
    let resumeAt = count;

    // A checked score always terminates well within this; the cap only guards
    // against a malformed structure slipping through (like the throw in
    // DurationDecomposition), never a legitimate score.
    const totalPasses = measures.reduce(
      (sum, measure) =>
        sum + (measure.closing === ClosingBarline.RepeatClose ? (measure.repeatTimes ?? 2) : 0),
      0,
    );
    const maxSteps = (totalPasses + 2) * count + count + 1000;

    let pos = 0;
    let steps = 0;

    while (pos >= 0 && pos < count) {
      if ((steps += 1) > maxSteps) {
        throw new Error(
          'NavigationUnfolding did not terminate; the repeat/jump structure is malformed',
        );
      }

      const measure = measures[pos];

      // Volta gate: on a first/second-ending measure, decide whether this pass
      // plays it. Normal traversal keys on the enclosing repeat's pass; the
      // post-jump traversal takes the final ending.
      if (measure.ending) {
        const volta = voltas.get(pos);
        const target = suppressRepeats
          ? (volta?.chainMax ?? 1)
          : (passAtOpen.get(volta?.governingOpen ?? 0) ?? 1);
        const endingNumbers = [...measure.ending].map((n) => n as number);

        if (!endingNumbers.includes(target)) {
          pos += 1;
          continue;
        }
      }

      const occurrence = (occurrences.get(pos) ?? 0) + 1;
      occurrences.set(pos, occurrence);
      output.push({ measureIndex: pos, pass: occurrence });

      // An al Fine return ends its **section** at the Fine, and the piece
      // carries on with whatever section follows. Every flag resets: the next
      // section is a fresh navigation world, and without clearing
      // `suppressRepeats` its repeats would silently not be taken.
      if (stopAtFine && pos === fineIndex) {
        stopAtFine = false;
        suppressRepeats = false;
        toCodaActive = false;
        pos = resumeAt;
        continue;
      }

      // Repeat loop-back, unless we are on a post-jump traversal.
      if (!suppressRepeats && measure.closing === ClosingBarline.RepeatClose) {
        const open = matchingOpen(measures, pos);
        const pass = passAtOpen.get(open) ?? 1;
        const total = measure.repeatTimes ?? 2;

        if (pass < total) {
          passAtOpen.set(open, pass + 1);
          pos = open;
          continue;
        }
      }

      if (measure.jump) {
        const jump = measure.jump;

        if (jump === NavigationJump.ToCoda) {
          // Honored only after a D.C./D.S. return has armed it, not on the way in.
          if (toCodaActive && codaIndex >= 0) {
            toCodaActive = false;
            pos = codaIndex;
            continue;
          }
        } else if (!jumpsTaken.has(pos)) {
          const start = sectionStartAt(pos);
          const end = sectionEndAt(pos);

          jumpsTaken.add(pos);
          suppressRepeats = true;

          if (alFineJumps.has(jump)) {
            stopAtFine = true;
            fineIndex = markIn(NavigationMark.Fine, start, end);
            resumeAt = end + 1;
          }

          if (alCodaJumps.has(jump)) {
            toCodaActive = true;
            codaIndex = markIn(NavigationMark.Coda, start, end);
          }

          const segno = markIn(NavigationMark.Segno, start, end);

          pos = dalSegnoJumps.has(jump) ? (segno >= 0 ? segno : start) : start;
          continue;
        }
      }

      pos += 1;
    }

    return output;
  },
};
