import { ClosingBarline, OpeningBarline } from '@scoregrove/domain/Barline';
import { NoteValue } from '@scoregrove/domain/Duration';
import { NavigationJump, NavigationMark } from '@scoregrove/domain/Navigation';
import { NonEmptyArray } from '@scoregrove/domain/NonEmptyArray';
import { PositiveInteger } from '@scoregrove/domain/PositiveInteger';
import { MetronomeMark, Tempo, TempoMarking } from '@scoregrove/domain/Tempo';
import type { TimewiseMeasure } from './PartwiseToTimewise';
import type { Warn } from './Reporting';
import { XmlReading } from './XmlReading';

/**
 * The measure-level structure a score is navigated by: barlines, repeats,
 * volta endings, the landmarks and jumps `NavigationUnfolding` needs, and
 * tempo. Everything here is a property of the measure rather than of a note,
 * which is exactly what `VoiceBuilding` is not for.
 *
 * ## Why this reads all four parts
 *
 * `PartwiseToTimewise` measured two classes of score-wide data: duplicated on
 * every part (key, time, repeats — identical everywhere) and written on one
 * part alone (voltas and the Fine/da capo `<sound>`, on Violin I only). Reading
 * "from part 1" would work here by luck; demanding agreement would fail on the
 * voltas. So the same rule applies as there: **union with conflict detection**,
 * with the first part in score order winning a genuine disagreement.
 *
 * ## Endings are ranges, not marks
 *
 * MusicXML brackets a volta between `<ending type="start">` and a matching
 * `stop` or `discontinue`, while `Measure.ending` says "this measure is part of
 * volta *n*". Converting one to the other needs the measures either side, which
 * is why this reads the whole grid at once rather than a measure at a time.
 *
 * ## One tempo, two sources
 *
 * The corpus states tempo twice and differently: a printed `<words>Allegro`
 * and an unprinted `<sound tempo="112">`. `Measure.tempo` holds one value, so
 * one has to win. **The printed word wins where it names a marking we model** —
 * it is what a reader sees, and playback resolves a marking to bpm anyway
 * (`TempoResolution.markingBpm`), so nothing is lost to performance by
 * preferring it. Where the words are prose the model has no name for — this
 * work's "Poco adagio; cantabile" — the metronome mark carries the measure
 * instead, and the dropped text is reported rather than quietly rounded to the
 * nearest marking it happens to contain.
 */

const closingByStyle: Record<string, ClosingBarline> = {
  'light-heavy': ClosingBarline.Final,
  'light-light': ClosingBarline.Double,
  regular: ClosingBarline.Regular,
};

/** What one measure contributes to the score's structure */
export type MeasureStructure = {
  opening?: OpeningBarline;
  closing?: ClosingBarline;
  repeatTimes?: PositiveInteger;
  ending?: NonEmptyArray<PositiveInteger>;
  marks?: NonEmptyArray<NavigationMark>;
  jump?: NavigationJump;
  tempo?: Tempo;
};

/** Every `<barline>` of every part of a measure, with the part that wrote it */
const barlinesOf = (measure: TimewiseMeasure) =>
  measure.contents.flatMap((children, part) =>
    children.filter((child) => child.name === 'barline').map((barline) => ({ part, barline })),
  );

/**
 * Every `<sound>` a measure carries, whether directly or inside a
 * `<direction>` — MusicXML allows both and this corpus uses the latter.
 */
const soundsOf = (measure: TimewiseMeasure) =>
  measure.contents.flatMap((children, part) =>
    children
      .flatMap((child) =>
        child.name === 'sound'
          ? [child]
          : child.name === 'direction'
            ? XmlReading.childrenNamed(child, 'sound')
            : [],
      )
      .map((sound) => ({ part, sound })),
  );

/** Every `<words>` of a measure, in part then document order */
export const wordsOf = (measure: TimewiseMeasure): { part: number; text: string }[] =>
  measure.contents.flatMap((children, part) =>
    children
      .filter((child) => child.name === 'direction')
      .flatMap((direction) => XmlReading.childrenNamed(direction, 'direction-type'))
      .flatMap((type) => XmlReading.childrenNamed(type, 'words'))
      .map((words) => ({ part, text: words.text.trim() }))
      .filter((entry) => entry.text.length > 0),
  );

/**
 * Resolves one value across the parts that state it. Absent everywhere is
 * absent; agreement is the value; a genuine disagreement is reported and the
 * first part in score order wins — the same policy `PartwiseToTimewise` uses,
 * for the same reason.
 */
const agree = <T>(
  found: readonly { part: number; value: T }[],
  what: string,
  where: string,
  warn: Warn,
  format: (value: T) => string = String,
): T | undefined => {
  if (!found.length) return undefined;

  const [first, ...rest] = found;
  const disagreeing = rest.filter((entry) => format(entry.value) !== format(first.value));

  if (disagreeing.length) {
    warn(
      `${where}: parts disagree about ${what} — ` +
        [first, ...disagreeing]
          .map((entry) => `part ${entry.part + 1} says ${format(entry.value)}`)
          .join(', ') +
        `; taking part ${first.part + 1}'s`,
    );
  }

  return first.value;
};

/** Whether a piece of text names a tempo marking the domain models */
const isTempoMarking = (text: string): boolean =>
  TempoMarking.values.some((value) => value.toLowerCase() === text.toLowerCase());

/** The tempo a measure states, preferring the printed word over the sounded hint */
const tempoOf = (measure: TimewiseMeasure, where: string, warn: Warn): Tempo | undefined => {
  const marking = wordsOf(measure)
    .map((entry) =>
      TempoMarking.values.find((value) => value.toLowerCase() === entry.text.toLowerCase()),
    )
    .find((value) => value !== undefined);

  if (marking) return marking;

  const stated = soundsOf(measure)
    .map(({ part, sound }) => ({ part, value: XmlReading.attribute(sound, 'tempo') }))
    .filter((entry): entry is { part: number; value: string } => entry.value !== undefined);

  const bpm = Number(agree(stated, 'the tempo', where, warn));

  if (!stated.length || !PositiveInteger.is(bpm)) return undefined;

  // MusicXML defines <sound tempo> as quarter notes per minute, whatever the
  // meter, so the beat is a quarter by definition rather than by inference.
  return MetronomeMark.of(NoteValue.Quarter, bpm);
};

export const StructureReading = {
  /** Whether text names a tempo marking, so another reader can tell it is spoken for */
  isTempoMarking,

  /**
   * Drops a repeat that opens and never closes within these measures.
   *
   * A slice is what makes this happen: importing measures 290-300 takes the
   * Trio's forward repeat at 295 and leaves its backward repeat at 303 outside
   * the range, which `Score.check` rightly rejects. The whole work never needs
   * it — every repeat there is matched.
   *
   * Only the *open* end needs balancing. A backward repeat with nothing before
   * it is ordinary music, meaning "repeat from the start", so it is left alone.
   */
  balanceRepeats(structures: readonly MeasureStructure[], warn: Warn): MeasureStructure[] {
    const balanced = structures.map((structure) => ({ ...structure }));
    let openedAt: number | undefined;

    balanced.forEach((structure, index) => {
      if (structure.opening === OpeningBarline.RepeatOpen) openedAt = index;
      if (structure.closing === ClosingBarline.RepeatClose) openedAt = undefined;
    });

    if (openedAt !== undefined) {
      warn(
        `measure ${openedAt}: a repeat opens here and never closes within the imported ` +
          'measures; dropping the repeat sign',
      );

      delete balanced[openedAt].opening;
    }

    return balanced;
  },

  /**
   * The structural fields for every measure of the grid, in order. Whole-grid
   * rather than per-measure because a volta is a range and a da capo's target
   * depends on what precedes it.
   */
  of(measures: readonly TimewiseMeasure[], warn: Warn): MeasureStructure[] {
    const structures: MeasureStructure[] = measures.map(() => ({}));

    /** Volta numbers currently open, by the measure index each opened at */
    let openEnding: { numbers: PositiveInteger[] } | undefined;

    measures.forEach((measure, index) => {
      const where = `measure ${measure.index}`;
      const structure = structures[index];

      const openings: { part: number; value: OpeningBarline }[] = [];
      const closings: { part: number; value: ClosingBarline }[] = [];

      for (const { part, barline } of barlinesOf(measure)) {
        const location = XmlReading.attribute(barline, 'location') ?? 'right';
        const style = XmlReading.textOf(barline, 'bar-style');
        const repeat = XmlReading.childNamed(barline, 'repeat');
        const direction = repeat ? XmlReading.attribute(repeat, 'direction') : undefined;

        if (direction === 'forward') openings.push({ part, value: OpeningBarline.RepeatOpen });
        else if (direction === 'backward') {
          closings.push({ part, value: ClosingBarline.RepeatClose });

          const times = repeat ? XmlReading.attribute(repeat, 'times') : undefined;
          const count = times === undefined ? undefined : Number(times);

          if (count !== undefined && PositiveInteger.is(count) && count >= 2) {
            structure.repeatTimes = count;
          }
        } else if (direction !== undefined) {
          warn(`${where}: unsupported repeat direction "${direction}"`);
        }

        if (style !== undefined && !direction) {
          const closing = closingByStyle[style];

          if (location === 'right' && closing) closings.push({ part, value: closing });
          // `heavy-light` on the left is how a forward repeat prints; the
          // `<repeat>` above is what actually says so, and it always
          // accompanies it in this corpus.
          else if (!(location === 'left' && style === 'heavy-light')) {
            warn(`${where}: unsupported ${location} bar-style "${style}"`);
          }
        }
      }

      const opening = agree(openings, 'the opening barline', where, warn);
      const closing = agree(closings, 'the closing barline', where, warn);

      if (opening) structure.opening = opening;
      if (closing) structure.closing = closing;

      // Endings. A start opens a volta that runs until its stop *inclusive*, so
      // the close is applied after this measure has been marked, not before.
      let closesEnding = false;

      for (const { barline } of barlinesOf(measure)) {
        const ending = XmlReading.childNamed(barline, 'ending');

        if (!ending) continue;

        const type = XmlReading.attribute(ending, 'type');

        if (type === 'stop' || type === 'discontinue') {
          if (!openEnding) warn(`${where}: an ending stops that never started`);

          closesEnding = true;
          continue;
        }

        if (type !== 'start') {
          if (type !== undefined) warn(`${where}: unsupported ending type "${type}"`);
          continue;
        }

        const numbers = (XmlReading.attribute(ending, 'number') ?? '')
          .split(/[,\s]+/)
          .map(Number)
          .filter((value): value is PositiveInteger => PositiveInteger.is(value));

        if (numbers.length) openEnding = { numbers };
        else warn(`${where}: an ending with no usable number; ignoring it`);
      }

      if (openEnding) structure.ending = NonEmptyArray.of([...openEnding.numbers]);

      if (closesEnding) openEnding = undefined;

      // Navigation. `<sound>` attributes carry it structurally; the `<words>`
      // at the same measures ("Fine", "Menuetto D.C.") are duplicates of them.
      const marks: NavigationMark[] = [];
      let hasDaCapo = false;
      let hasDalSegno = false;

      for (const { sound } of soundsOf(measure)) {
        if (XmlReading.attribute(sound, 'fine')) marks.push(NavigationMark.Fine);
        if (XmlReading.attribute(sound, 'segno')) marks.push(NavigationMark.Segno);
        if (XmlReading.attribute(sound, 'coda')) marks.push(NavigationMark.Coda);
        if (XmlReading.attribute(sound, 'dacapo')) hasDaCapo = true;
        if (XmlReading.attribute(sound, 'dalsegno')) hasDalSegno = true;
        if (XmlReading.attribute(sound, 'tocoda')) structure.jump = NavigationJump.ToCoda;
      }

      if (marks.length) structure.marks = NonEmptyArray.of(marks);

      const tempo = tempoOf(measure, where, warn);

      if (tempo) structure.tempo = tempo;

      // A bare jump for now; whether it is *al Fine* depends on a Fine that
      // may not have been read yet, so that is settled once the grid is done.
      if (hasDaCapo) structure.jump = NavigationJump.DaCapo;
      if (hasDalSegno) structure.jump = NavigationJump.DalSegno;

      structures[index] = structure;
    });

    const hasFine = structures.some((structure) => structure.marks?.includes(NavigationMark.Fine));

    if (hasFine) {
      for (const structure of structures) {
        if (structure.jump === NavigationJump.DaCapo) structure.jump = NavigationJump.DaCapoAlFine;
        if (structure.jump === NavigationJump.DalSegno) {
          structure.jump = NavigationJump.DalSegnoAlFine;
        }
      }
    }

    return structures;
  },
};
