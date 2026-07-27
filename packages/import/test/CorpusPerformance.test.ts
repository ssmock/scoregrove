import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { Result } from '@scoregrove/domain/Result';
import { Articulations } from '@scoregrove/playback/Articulations';
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
    expect(performance.events.length).toBe(14_858);
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

  it('performs every written measure, finale included', () => {
    // Written failing, asserting the 190 measures a score-wide Fine left
    // unreachable, so that fixing navigation would break it rather than let the
    // bug sit unnoticed. Sections duly broke it — twice: first the finale
    // appeared at all, then measure 412 turned out still to be missing, its
    // repeat having fallen back to measure 0 and inherited a pass count from
    // movement I that gated out its first ending.
    expect(named('every written measure is performed').failures).toEqual([]);

    // The structure that used to swallow the finale: a Fine in the third
    // movement, a da capo at its end, and a fourth movement after both.
    expect(score.measures[294].marks).toContain('Fine');
    expect(score.measures[340].jump).toBe('DaCapoAlFine');
    expect(score.measures[341].newSection?.title).toBe('IV. Finale');
    expect(score.measures[341].marks).toContain('Capo');
  });
});

describe('the whole quartet, articulated', () => {
  it('shortens every staccato note, and only those', () => {
    // Every one of this work's 1,040 articulations is a staccato — not one
    // accent, tenuto or marcato in 531 measures — so the shortened events
    // should be exactly the staccato onsets, counted over the play order.
    const shapings = Articulations.shapings(score);

    expect(shapings.size).toBeGreaterThan(0);
    expect([...new Set([...shapings.values()].map((shaping) => shaping.duration))]).toEqual([0.5]);
    expect([...new Set([...shapings.values()].map((shaping) => shaping.velocity))]).toEqual([1]);
  });

  it('leaves every start time where it was written', () => {
    // Articulation shortens the sound, never the position. If it moved a start
    // the total duration check would still pass — it is measured from the
    // tempo map — so this is the assertion that catches it.
    expect(named('the total duration matches tempo times meter').failures).toEqual([]);
    expect(named('events are in start order').failures).toEqual([]);
    expect(named('no event has a zero, negative or unreal length').failures).toEqual([]);
  });
});
