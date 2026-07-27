import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { Result } from '@scoregrove/domain/Result';
import { MeasureSlicing } from '../src/MeasureSlicing';
import { PartwiseToTimewise } from '../src/PartwiseToTimewise';
import { ScoreAssembly } from '../src/ScoreAssembly';
import { XmlReading } from '../src/XmlReading';

/**
 * The committed excerpt the web client's stories render.
 *
 * Stories want real imported music rather than an invented fixture, and the
 * corpus itself is a 4 MB XML file no story should parse. So movement II's
 * theme is committed as score JSON — and this test is what keeps it honest: a
 * change to any reader that alters the theme fails here, naming the command
 * that regenerates it, rather than leaving the stories quietly rendering what
 * the importer used to produce.
 */

const corpusPath = fileURLToPath(new URL('../corpus/haydn-op76-no3.musicxml', import.meta.url));
const fixturePath = fileURLToPath(
  new URL('../../web-client/src/music/fixtures/haydnTheme.score.json', import.meta.url),
);

describe('the committed theme fixture', () => {
  it('is still what the importer produces for measures 128-148', () => {
    const document = XmlReading.parse(readFileSync(corpusPath, 'utf8'));

    if (!Result.isOk(document)) throw new Error(document.error.messages.join('; '));

    const grid = PartwiseToTimewise.build(document.value);

    if (!Result.isOk(grid)) throw new Error(grid.error.messages.join('; '));

    const sliced = MeasureSlicing.slice(grid.value, 128, 148);

    if (!Result.isOk(sliced)) throw new Error(sliced.error.messages.join('; '));

    const assembled = ScoreAssembly.fromTimewise(
      sliced.value,
      ScoreAssembly.header(document.value.root),
    );

    if (!Result.isOk(assembled)) throw new Error(assembled.error.messages.join('; '));

    const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as unknown;

    expect(JSON.parse(JSON.stringify(assembled.value.score))).toEqual(fixture);
  });
});
