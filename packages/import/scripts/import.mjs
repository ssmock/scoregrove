#!/usr/bin/env node
/**
 * The importer's command line: MusicXML in, a `Score` as JSON out, plus the
 * report of everything the import decided along the way.
 *
 * It lives in `scripts/` rather than `src/` on purpose. The package is
 * environment-agnostic — `@types/node` is wired into the test config only, so
 * nothing under `src` can reach for a Node API and reading a file from disk
 * stays the caller's job. This *is* that caller.
 *
 * The JSON it writes is exactly what `Projects.ts` persists, which is also what
 * `pnpm --filter web-client haydn` engraves, so the two commands compose into
 * the review loop the project is built around:
 *
 *     pnpm --filter @scoregrove/import import corpus/haydn-op76-no3.musicxml \
 *       --from=128 --to=148 --out=theme.json
 *     pnpm --filter web-client haydn ../import/theme.json
 *
 * Usage: `pnpm --filter @scoregrove/import import <file.musicxml>`
 *
 * Options:
 *   --from=<n>   first measure to import, by position (default 0)
 *   --to=<n>     last measure to import, inclusive (default the last)
 *   --out=<path> where to write the score JSON (default alongside the source)
 *   --verify     run every estimator in `Verification` against the result
 *   --quiet      print the summary but not every warning
 */
import { readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Result } from '@scoregrove/domain/Result';
import { Score } from '@scoregrove/domain/Score';
import { ImportReport } from '../dist/ImportReport.js';
import { Verification } from '../dist/Verification.js';
import { XmlReading } from '../dist/XmlReading.js';

const args = process.argv.slice(2);
const flags = new Map(
  args.filter((arg) => arg.startsWith('--')).map((arg) => arg.replace(/^--/, '').split('=')),
);
const [source] = args.filter((arg) => !arg.startsWith('--'));

const fail = (message) => {
  console.error(`\n  ${message}\n`);
  process.exit(1);
};

if (!source)
  fail('Usage: pnpm --filter @scoregrove/import import <file.musicxml> [--from=n] [--to=n]');

const packageRoot = fileURLToPath(new URL('..', import.meta.url));
const sourcePath = resolve(process.cwd(), source);
const number = (name) => {
  const raw = flags.get(name);

  if (raw === undefined) return undefined;

  const value = Number(raw);

  if (!Number.isInteger(value) || value < 0) fail(`--${name} must be a whole number, got "${raw}"`);

  return value;
};

const from = number('from');
const to = number('to');

const document = XmlReading.parse(await readFile(sourcePath, 'utf8'));

if (!Result.isOk(document)) fail(document.error.messages.join('\n  '));

const built = ImportReport.build(document.value, {
  ...(from === undefined ? {} : { from }),
  ...(to === undefined ? {} : { to }),
});

if (!Result.isOk(built)) fail(built.error.messages.join('\n  '));

const report = built.value;
const { score, warnings } = report;

const outPath = flags.get('out')
  ? resolve(process.cwd(), flags.get('out'))
  : join(dirname(sourcePath), `${basename(sourcePath).replace(/\.[^.]+$/, '')}.score.json`);

await writeFile(outPath, JSON.stringify(score, undefined, 2));

const checked = Score.check(score);
const staves = score.staves.length;

console.log(`
  ${basename(sourcePath)} -> ${outPath.startsWith(packageRoot) ? outPath.slice(packageRoot.length) : outPath}

  ${score.measures.length} measures on ${staves} stave${staves === 1 ? '' : 's'}${
    from === undefined && to === undefined ? '' : ` (source measures ${from ?? 0}-${to ?? '.'})`
  }
  ${score.title ?? '(untitled)'}${score.composer ? ` — ${score.composer}` : ''}

  Score.check       ${Result.isOk(checked) ? 'passes' : `FAILS\n${checked.error.messages.map((m) => `      ${m}`).join('\n')}`}

  ${report.elements} elements, partitioned by name against Coverage's manifest.
  This balances by construction, so it proves the vocabulary is known — not that
  nothing was lost. Run --verify for the checks that compare against the source.

  consumed          ${ImportReport.total(report.consumed)}
  dropped by design ${ImportReport.total(report.ignored)}
  unrepresented     ${ImportReport.total(report.unrepresented)}${[...report.unrepresented].map(([name, count]) => `\n      ${name} x${count}`).join('')}
  unaccounted       ${ImportReport.total(report.unaccounted)}${report.unaccounted.size ? ` (${[...report.unaccounted.keys()].join(', ')}) <- these are holes` : ''}
  balances          ${ImportReport.balances(report) ? 'yes' : 'NO — the partition itself is broken'}
  warnings          ${warnings.length}`);

if (warnings.length && !flags.has('quiet')) {
  const kinds = new Map();

  for (const warning of warnings) {
    // Group by shape, not by text: the position varies, the decision does not
    const kind = warning.replace(/^[^:]*:\s*/, '').replace(/\b[A-G][#b]?\d\b|\d+/g, 'N');

    kinds.set(kind, (kinds.get(kind) ?? 0) + 1);
  }

  console.log();

  for (const [kind, count] of [...kinds].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(count).padStart(5)}  ${kind}`);
  }
}

let verified = true;

if (flags.has('verify')) {
  const verification = Verification.run(document.value);

  if (!Result.isOk(verification)) fail(verification.error.messages.join('\n  '));

  console.log('\n  Verification — each of these compares the result against the source:\n');

  for (const check of verification.value.checks) {
    console.log(`  ${check.passed ? 'pass' : 'FAIL'}  ${check.name}`);

    for (const failure of check.failures) console.log(`          ${failure}`);
  }

  verified = verification.value.passed;
}

console.log();

if (!Result.isOk(checked) || report.unaccounted.size || !verified) process.exit(1);
