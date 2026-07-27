import { Result } from '@scoregrove/domain/Result';
import type { Score } from '@scoregrove/domain/Score';
import { Coverage } from './Coverage';
import { MeasureSlicing } from './MeasureSlicing';
import { PartwiseToTimewise } from './PartwiseToTimewise';
import { ScoreAssembly } from './ScoreAssembly';
import { XmlReading, type MusicXmlDocument } from './XmlReading';

/**
 * One import's whole account of itself: the score, what became of every element
 * in the file, and everything the readers had to say.
 *
 * ## What the identity proves, and what it does not
 *
 * The plan called for `consumed + unsupported == total elements` as the thing
 * that "turns *never drop silently* from an intention into something enforced".
 * Building it exposed that the identity is weaker than it sounds, and saying so
 * is more useful than shipping a number that reads as a guarantee.
 *
 * Every element is partitioned by **name**, against `Coverage`'s hand-kept
 * manifest. The partition therefore balances *by construction*: every name is
 * on exactly one list, so the counts always add up, and a run where they did
 * not would mean the partition itself was broken rather than the import. What
 * the audit genuinely catches is a name on **no** list — vocabulary the
 * importer has never been told about, which is real and which did catch the
 * score header the moment it moved lists.
 *
 * What it cannot catch is a reader meeting an element and discarding part of
 * it. `<notations>` is the standing example: a note may carry several blocks,
 * 155 notes here do, and reading only the first silently lost 25 staccatos
 * while `notations` stayed firmly in the consumed column the whole time. Corpus
 * counts caught that, not the audit.
 *
 * So the honest reading of a clean report is **"no unknown vocabulary, and
 * every decision stated"** — not "nothing was lost". The checks that compare
 * the import against the source rather than against a manifest live in
 * `Verification`, and they are what a new file should be put through.
 */

export type Histogram = ReadonlyMap<string, number>;

export type ImportReport = {
  score: Score;
  /** Element names a reader turns into domain data, by how often the file used them */
  consumed: Histogram;
  /** Read and deliberately dropped, with the decision recorded in `Coverage` */
  ignored: Histogram;
  /** Met, and the model has nowhere to put it — every one a real loss */
  unrepresented: Histogram;
  /**
   * Met and on no list at all. **The one entry that indicates a defect**: an
   * element the importer has never been told about cannot be warning about
   * itself either.
   */
  unaccounted: Histogram;
  /** Every element in the file, the denominator the four histograms partition */
  elements: number;
  warnings: readonly string[];
};

const histogram = (counts: Map<string, number>, names: Iterable<string>): Histogram =>
  new Map(
    [...names]
      .map((name): [string, number] => [name, counts.get(name) ?? 0])
      .filter(([, count]) => count > 0),
  );

const total = (entries: Histogram): number => [...entries.values()].reduce((sum, n) => sum + n, 0);

export const ImportReport = {
  /**
   * Imports a document and reports on it. `from`/`to` slice the measures, for
   * the same reason `MeasureSlicing` exists: looking at 21 bars has to be
   * cheaper than looking at 531.
   */
  build(
    document: MusicXmlDocument,
    range: { from?: number; to?: number } = {},
  ): Result<ImportReport> {
    const grid = PartwiseToTimewise.build(document);

    if (!Result.isOk(grid)) return Result.mapError(grid);

    const sliced =
      range.from === undefined && range.to === undefined
        ? grid
        : MeasureSlicing.slice(
            grid.value,
            range.from ?? 0,
            range.to ?? grid.value.measures.length - 1,
          );

    if (!Result.isOk(sliced)) return Result.mapError(sliced);

    const assembled = ScoreAssembly.fromTimewise(sliced.value, ScoreAssembly.header(document.root));

    if (!Result.isOk(assembled)) return Result.mapError(assembled);

    const counts = XmlReading.countElements(document.root);
    const audit = Coverage.audit(counts.keys());

    return Result.ok({
      score: assembled.value.score,
      consumed: histogram(counts, [...audit.consumed, ...audit.pending]),
      ignored: histogram(
        counts,
        audit.ignored.map((entry) => entry.name),
      ),
      unrepresented: histogram(
        counts,
        audit.unrepresented.map((entry) => entry.name),
      ),
      unaccounted: histogram(counts, audit.unaccounted),
      elements: XmlReading.totalElements(document.root),
      warnings: assembled.value.warnings,
    });
  },

  /**
   * Whether the four histograms account for every element in the file. It
   * balances by construction (see the module header), so a failure means the
   * partition is broken rather than the import — which is worth catching, but
   * is not the loss detector the plan first took it for.
   */
  balances(report: ImportReport): boolean {
    return (
      total(report.consumed) +
        total(report.ignored) +
        total(report.unrepresented) +
        total(report.unaccounted) ===
      report.elements
    );
  },

  /** How many elements a histogram accounts for */
  total,
};
