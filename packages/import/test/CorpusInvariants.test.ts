import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { Result } from '@scoregrove/domain/Result';
import { Invariants } from '@scoregrove/engraving/Invariants';
import { ScoreLayout } from '@scoregrove/engraving/ScoreLayout';
import { ScoreAssembly } from '../src/ScoreAssembly';
import { XmlReading } from '../src/XmlReading';

/**
 * The engraving invariants, run over the whole imported quartet.
 *
 * This is the pairing the project was built for: 531 measures of real music
 * the engraver has never seen, checked against properties that are true or
 * false rather than matters of taste. A layout snapshot of this would change
 * on every spacing tweak and teach nothing; these survive refactoring.
 *
 * It lives here rather than in `engraving` because this is where the corpus is
 * — the invariants themselves are engraving's, and are unit-tested there
 * against deliberately broken layouts.
 */

const corpusPath = fileURLToPath(new URL('../corpus/haydn-op76-no3.musicxml', import.meta.url));

/** The width a printed page gives a system, in staff spaces */
const pageWidth = 110;

const laidOut = (() => {
  const document = XmlReading.parse(readFileSync(corpusPath, 'utf8'));

  if (!Result.isOk(document)) throw new Error(document.error.messages.join('; '));

  const assembled = ScoreAssembly.build(document.value);

  if (!Result.isOk(assembled)) throw new Error(assembled.error.messages.join('; '));

  return ScoreLayout.layout(assembled.value.score, { width: pageWidth });
})();

/** Reports the first few violations in full, since a bare count is not actionable */
const report = (violations: readonly { where: string; detail: string }[]) =>
  violations.slice(0, 6).map((violation) => `${violation.where}: ${violation.detail}`);

describe('the whole quartet, engraved', () => {
  it('lays out every measure into systems', () => {
    expect(laidOut.systems.length).toBeGreaterThan(0);

    const measures = laidOut.systems.reduce((sum, system) => sum + system.measures.length, 0);

    expect(measures).toBe(531);
  });

  it('fits every system to the page width', () => {
    expect(report(Invariants.systemsFitWidth(laidOut.systems, pageWidth))).toEqual([]);
  });

  it('keeps every element inside the measure that holds it', () => {
    expect(report(Invariants.elementsWithinMeasures(laidOut.systems))).toEqual([]);
  });

  it('agrees on stem direction under every beam', () => {
    expect(report(Invariants.beamGroupsAgreeOnDirection(laidOut.systems))).toEqual([]);
  });

  it('keeps every dynamic clear of the notes on its staff', () => {
    // This test was written failing, asserting the 39 collisions a fixed
    // `dynamicY` produced, so that fixing placement would break it rather than
    // let the bug sit unnoticed behind a skip. `DynamicPlacement` duly broke
    // it — twice, since the first pass left four where an accidental hangs
    // lower than the notehead it belongs to.
    expect(report(Invariants.dynamicsClearOfNotes(laidOut.systems))).toEqual([]);
  });
});
