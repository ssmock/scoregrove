import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { Result } from '@scoregrove/domain/Result';
import { Compiler } from '@scoregrove/playback/Compiler';
import { PerformanceChecks } from '@scoregrove/playback/PerformanceChecks';
import { ScoreAssembly } from '../src/ScoreAssembly';
import { XmlReading } from '../src/XmlReading';

/**
 * The structural playback checks, run over the whole imported quartet.
 *
 * Listening is ground truth and is unavailable in CI, so these stand in for the
 * classes an ear would catch at once: a part that stopped sounding, a tie that
 * sounds twice, a note of no length, music that never plays at all.
 */

const corpusPath = fileURLToPath(new URL('../corpus/haydn-op76-no3.musicxml', import.meta.url));

const { score, performance } = (() => {
  const document = XmlReading.parse(readFileSync(corpusPath, 'utf8'));

  if (!Result.isOk(document)) throw new Error(document.error.messages.join('; '));

  const assembled = ScoreAssembly.build(document.value);

  if (!Result.isOk(assembled)) throw new Error(assembled.error.messages.join('; '));

  const compiled = Compiler.compile(assembled.value.score);

  if (!Result.isOk(compiled)) throw new Error(compiled.error.messages.join('; '));

  return { score: assembled.value.score, performance: compiled.value };
})();

const checks = PerformanceChecks.run(score, performance);
const named = (name: string) => checks.find((check) => check.name === name)!;

describe('the whole quartet, performed', () => {
  it('compiles the corpus into a performance', () => {
    expect(performance.events.length).toBe(10_882);
    expect(performance.durationSeconds).toBeGreaterThan(0);
  });

  it('sounds every note of every part, folding tie chains once each', () => {
    expect(named('every part sounds every note it is written').failures).toEqual([]);
    expect(named('tie chains fold into one event each').failures).toEqual([]);
    expect(named('no written part is silent').failures).toEqual([]);
  });

  it('produces no degenerate or out-of-order events', () => {
    expect(named('no event has a zero, negative or unreal length').failures).toEqual([]);
    expect(named('events are in start order').failures).toEqual([]);
  });

  it('lasts exactly what tempo and meter say it should', () => {
    // Recomputed over the play order from the written tempo of each measure —
    // which is not the same as carrying tempo along the play order, since a
    // repeat does not change the tempo of the bars it returns to.
    expect(named('the total duration matches tempo times meter').failures).toEqual([]);
  });

  /**
   * A real defect, kept running rather than omitted — the same device the
   * engraving invariants used for the dynamics collisions. When navigation
   * learns that a Fine ends a *movement* rather than the piece, this starts
   * failing and forces the number to be revisited.
   */
  it('never performs the finale, because a Fine ends the whole score', () => {
    const failures = named('every written measure is performed').failures;

    expect(failures).toEqual(['190 of 531 measures are never performed, from 341 to 530']);

    // Measure 294 carries the Fine and 340 the Menuetto's da capo; everything
    // after the Fine — the entire fourth movement — is unreachable.
    expect(score.measures[294].marks).toContain('Fine');
    expect(score.measures[340].jump).toBe('DaCapoAlFine');
    expect(score.measures[341].newSection?.title).toBe('IV. Finale');
  });
});
