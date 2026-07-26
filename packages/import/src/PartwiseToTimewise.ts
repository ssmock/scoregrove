import type { Clef } from '@scoregrove/domain/Clef';
import { KeySignature } from '@scoregrove/domain/KeySignature';
import { StaffGroup, StaffGroupSymbol } from '@scoregrove/domain/Part';
import { Result } from '@scoregrove/domain/Result';
import { TimeSignature } from '@scoregrove/domain/TimeSignature';
import type { XmlElement } from '@rgrove/parse-xml';
import { AttributeReading } from './AttributeReading';
import { Reporting, type Warn } from './Reporting';
import { type MusicXmlDocument, XmlReading } from './XmlReading';

/**
 * The core transposition: MusicXML's **partwise** layout (each part owning its
 * own measure sequence) into our **timewise** grid (each measure owning one
 * entry per staff).
 *
 * ## What this module does and does not do
 *
 * It builds the *structure* — the aligned measure grid, the score-wide
 * attributes, and each part's identity — and hands every measure's children
 * on, per part, as raw elements in document order. It reads no notes. Keeping
 * the split there means the alignment and reconciliation logic, which is the
 * genuinely tricky part, is testable before a single pitch is parsed, and a
 * note-reading bug can never masquerade as an alignment bug.
 *
 * ## Score-wide data arrives two different ways
 *
 * The plan called this "MusicXML's per-part duplication", which is only half
 * of it. Measuring the Haydn corpus, score-wide data splits three ways:
 *
 * - **genuinely per-part** — notes, clefs, dynamics (Vln 1 carries 122
 *   directions, the cello 93)
 * - **score-wide, duplicated on every part** — key, time, divisions, repeats
 *   (all four parts, identical indices *and* values)
 * - **score-wide, written on one part only** — voltas appear on Violin I and
 *   nowhere else; so do the `<sound>` attributes carrying Fine and the da capo
 *
 * That third class is the trap. Reading score-wide attributes from part 1
 * would work on this corpus by luck while silently dropping anything a lower
 * part carries alone — and the viola does carry two `<words>` of its own.
 * Demanding that all parts agree fails immediately, since three of them have
 * no voltas at all.
 *
 * So the rule is **union with conflict detection**: gather a given attribute
 * from every part; none means absent, all-equal means take it, and a genuine
 * disagreement is reported and resolved in favour of the first part in score
 * order. One rule covers both score-wide classes.
 */

/** One part's identity, from `<part-list>` */
export type PartInfo = {
  id: string;
  name?: string;
  abbreviation?: string;
  /** MusicXML's `<instrument-sound>`, e.g. "strings.violin" — playback's hook */
  instrumentSound?: string;
};

/** One measure of the grid, aligned across every part */
export type TimewiseMeasure = {
  /** Positional index — the only reliable identity (see `Measure.label`) */
  index: number;
  /** The source's own `number` attribute, for display only */
  label?: string;
  /** Score-wide, reconciled across parts */
  key?: KeySignature;
  time?: TimeSignature;
  /** Per part: a clef effective at this measure, when one is declared */
  clefs: readonly (Clef | undefined)[];
  /** Per part: divisions in force here, carried forward from earlier declarations */
  divisions: readonly (number | undefined)[];
  /** Per part: this measure's children, in document order, for later readers */
  contents: readonly (readonly XmlElement[])[];
};

export type TimewiseScore = {
  parts: readonly PartInfo[];
  /** Brackets and braces over ranges of staves, ready for `Score.groups` */
  groups: readonly StaffGroup[];
  measures: readonly TimewiseMeasure[];
  warnings: readonly string[];
};

/**
 * Resolves one score-wide attribute across the parts that declare it. Absent
 * everywhere is simply absent; agreement is the value; disagreement is
 * reported and the first part in score order wins, because refusing the import
 * over a conflict would be worse than engraving it with a stated bias.
 */
const reconcile = <T>(
  candidates: readonly { partIndex: number; value: T }[],
  equals: (a: T, b: T) => boolean,
  format: (value: T) => string,
  what: string,
  parts: readonly PartInfo[],
  warn: Warn,
): T | undefined => {
  const [first, ...rest] = candidates;

  if (!first) return undefined;

  const disagreeing = rest.filter((candidate) => !equals(candidate.value, first.value));

  if (disagreeing.length) {
    const describe = (candidate: { partIndex: number; value: T }) =>
      `${parts[candidate.partIndex]?.name ?? parts[candidate.partIndex]?.id ?? `part ${candidate.partIndex + 1}`} has ${format(candidate.value)}`;

    warn(
      `${what}: parts disagree — ${[first, ...disagreeing].map(describe).join(', ')}; ` +
        `using ${format(first.value)}`,
    );
  }

  return first.value;
};

const groupSymbols: Record<string, StaffGroupSymbol> = {
  bracket: StaffGroupSymbol.Bracket,
  brace: StaffGroupSymbol.Brace,
  line: StaffGroupSymbol.Line,
  square: StaffGroupSymbol.Bracket,
};

/**
 * `<part-group>` pairs → staff groups over part ranges.
 *
 * MusicXML opens and closes groups *between* `<score-part>` entries, so a
 * group's extent is the parts declared while it is open. Groups nest, so the
 * open ones form a stack. Ranges here are part indices; the caller converts
 * them to staff indices once it knows how many staves each part takes.
 */
const readGroups = (
  partList: XmlElement,
  warn: Warn,
): { symbol: StaffGroupSymbol; from: number; to: number; barlines: boolean }[] => {
  const groups: { symbol: StaffGroupSymbol; from: number; to: number; barlines: boolean }[] = [];
  const open: { symbol: StaffGroupSymbol; from: number; barlines: boolean }[] = [];
  let partIndex = 0;

  for (const child of XmlReading.elements(partList)) {
    if (child.name === 'score-part') {
      partIndex += 1;
      continue;
    }

    if (child.name !== 'part-group') continue;

    if (XmlReading.attribute(child, 'type') === 'stop') {
      const started = open.pop();

      if (!started) {
        warn('A <part-group> closes without opening; ignoring it');
        continue;
      }

      groups.push({ ...started, to: partIndex - 1 });
      continue;
    }

    const symbolText = XmlReading.textOf(child, 'group-symbol');
    const symbol = symbolText ? groupSymbols[symbolText] : undefined;

    if (symbolText && !symbol) warn(`Unsupported <group-symbol> "${symbolText}"; using a bracket`);

    open.push({
      symbol: symbol ?? StaffGroupSymbol.Bracket,
      from: partIndex,
      barlines: XmlReading.textOf(child, 'group-barline') === 'yes',
    });
  }

  for (const unclosed of open) {
    warn(`A <part-group> starting at part ${unclosed.from + 1} never closes; ignoring it`);
  }

  return groups;
};

/** `<part-list>` → part identities, in score order */
const readParts = (root: XmlElement): PartInfo[] => {
  const partList = XmlReading.childNamed(root, 'part-list');

  if (!partList) return [];

  return XmlReading.childrenNamed(partList, 'score-part').map((scorePart) => {
    const instrument = XmlReading.childNamed(scorePart, 'score-instrument');

    return {
      id: XmlReading.attribute(scorePart, 'id') ?? '',
      name: XmlReading.textOf(scorePart, 'part-name'),
      abbreviation: XmlReading.textOf(scorePart, 'part-abbreviation'),
      instrumentSound: instrument ? XmlReading.textOf(instrument, 'instrument-sound') : undefined,
    };
  });
};

/** What one part's `<attributes>` elements declare in a single measure */
type MeasureAttributes = {
  key?: KeySignature;
  time?: TimeSignature;
  clef?: Clef;
  divisions?: number;
};

const readMeasureAttributes = (
  measure: XmlElement,
  where: string,
  warn: Warn,
): MeasureAttributes => {
  const result: MeasureAttributes = {};
  let sounded = false;

  for (const child of XmlReading.elements(measure)) {
    if (child.name === 'note' || child.name === 'backup' || child.name === 'forward') {
      sounded = true;
      continue;
    }

    if (child.name !== 'attributes') continue;

    if (sounded) {
      // A clef change belongs where the register changes, which is wherever the
      // music demands rather than at a barline — routine in cello, bassoon and
      // trombone parts. `StaffContent.clef` takes effect at the measure start,
      // so we apply it there and say so: the affected notes still sound
      // correctly, they are simply drawn with more ledger lines than the
      // source intended.
      warn(`${where}: <attributes> appears mid-measure; applying it at the measure start`);
    }

    const divisions = AttributeReading.divisions(child, warn);

    if (divisions !== undefined) result.divisions = divisions;

    const keyElement = XmlReading.childNamed(child, 'key');

    if (keyElement) {
      const key = AttributeReading.key(keyElement, warn);

      if (Result.isOk(key)) result.key = key.value;
      else warn(`${where}: ${key.error.messages.join('; ')}`);
    }

    const timeElement = XmlReading.childNamed(child, 'time');

    if (timeElement) {
      const time = AttributeReading.time(timeElement, warn);

      if (Result.isOk(time)) result.time = time.value;
      else warn(`${where}: ${time.error.messages.join('; ')}`);
    }

    const clefElement = XmlReading.childNamed(child, 'clef');

    if (clefElement) {
      const clef = AttributeReading.clef(clefElement, warn);

      if (Result.isOk(clef)) result.clef = clef.value;
      else warn(`${where}: ${clef.error.messages.join('; ')}`);
    }

    if (XmlReading.childNamed(child, 'staves')) {
      warn(`${where}: multi-staff parts are not supported; treating this part as one staff`);
    }
  }

  return result;
};

export const PartwiseToTimewise = {
  /**
   * Builds the aligned grid. Refuses only what cannot be aligned at all —
   * everything else is a warning, so an import that is merely imperfect still
   * produces a score to look at.
   */
  build(document: MusicXmlDocument): Result<TimewiseScore> {
    const { warn, messages } = Reporting.collector();
    const root = document.root;
    const parts = readParts(root);
    const partList = XmlReading.childNamed(root, 'part-list');
    const partElements = XmlReading.childrenNamed(root, 'part');

    if (!partElements.length) return Result.invalid('The score contains no <part> elements');

    if (parts.length !== partElements.length) {
      warn(
        `<part-list> declares ${parts.length} part(s) but the score contains ` +
          `${partElements.length}; matching them by position`,
      );
    }

    const measuresPerPart = partElements.map((part) => XmlReading.childrenNamed(part, 'measure'));
    const counts = measuresPerPart.map((measures) => measures.length);

    if (counts.some((count) => count === 0)) {
      return Result.invalid('A part contains no measures, so the parts cannot be aligned');
    }

    if (counts.some((count) => count !== counts[0])) {
      // Nothing downstream can proceed: measure *i* of one part would not be
      // the same music-time as measure *i* of another, and every later stage
      // assumes it is.
      return Result.invalid(
        `Parts have different measure counts (${counts.join(', ')}), so they cannot be aligned`,
      );
    }

    const measureCount = counts[0];
    const measures: TimewiseMeasure[] = [];
    const divisionsInForce: (number | undefined)[] = partElements.map(() => undefined);

    for (let index = 0; index < measureCount; index += 1) {
      const perPart = measuresPerPart.map((partMeasures) => partMeasures[index]);
      const attributes = perPart.map((measure, partIndex) =>
        readMeasureAttributes(
          measure,
          `${parts[partIndex]?.name ?? `part ${partIndex + 1}`}, measure index ${index}`,
          warn,
        ),
      );

      attributes.forEach((declared, partIndex) => {
        if (declared.divisions !== undefined) divisionsInForce[partIndex] = declared.divisions;
      });

      const candidates = <T>(pick: (a: MeasureAttributes) => T | undefined) =>
        attributes.flatMap((declared, partIndex) => {
          const value = pick(declared);

          return value === undefined ? [] : [{ partIndex, value }];
        });

      const at = `Measure index ${index}`;

      const key = reconcile(
        candidates((declared) => declared.key),
        KeySignature.equals,
        KeySignature.format,
        `${at} key signature`,
        parts,
        warn,
      );

      const time = reconcile(
        candidates((declared) => declared.time),
        TimeSignature.equals,
        TimeSignature.format,
        `${at} time signature`,
        parts,
        warn,
      );

      // Taken from the first part rather than reconciled: a bar label is
      // display-only, so parts disagreeing about one is cosmetic, and warning
      // about it on a 531-measure score would drown the warnings that matter.
      const label = XmlReading.attribute(perPart[0], 'number');

      measures.push({
        index,
        ...(label ? { label } : {}),
        ...(key ? { key } : {}),
        ...(time ? { time } : {}),
        clefs: attributes.map((declared) => declared.clef),
        divisions: [...divisionsInForce],
        contents: perPart.map((measure) => XmlReading.elements(measure)),
      });
    }

    // Every part here occupies one staff (multi-staff parts are reported
    // above), so a group's part range is also its staff range.
    const groups = (partList ? readGroups(partList, warn) : []).map((group) =>
      StaffGroup.of(group.symbol, group.from, group.to, group.barlines),
    );

    return Result.ok({ parts, groups, measures, warnings: messages });
  },
};
