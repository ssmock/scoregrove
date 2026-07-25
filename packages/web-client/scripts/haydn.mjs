#!/usr/bin/env node
/**
 * The Haydn project's one-command review loop: engrave a score headlessly and
 * capture it as PNGs you can put beside the reference engraving. Looking at
 * the result has to cost one command, or it stops happening.
 *
 * **Stage one of two.** There is no importer yet, so this takes a `Score` JSON
 * file (exactly what `Projects.ts` persists, and what `packages/import` will
 * emit). Once Phase 1 lands, a `--from-musicxml` path imports first and feeds
 * the result straight through here.
 *
 * It lives in `web-client` rather than the repo root because that is where
 * `playwright-core` and the built Storybook are; a root script cannot resolve
 * either without adding a dependency the workspace deliberately does not have.
 *
 * Requires a Storybook build (`pnpm --filter web-client build-storybook`) and
 * the Chromium that `playwright-core` downloads — see `print-preview.mjs` for
 * the OS-library caveat on a fresh Linux box.
 *
 * Usage: `pnpm --filter web-client haydn [score.json] [outDir]`
 *   score.json  a Score as JSON; omitted renders the harness's fallback fixture
 *   outDir      defaults to `haydn-capture/` in this package's root
 *
 * Options:
 *   --width=<px>   viewport width driving line breaking (default 1100)
 *   --scale=<n>    device scale factor for the PNGs (default 2)
 */
import { createServer } from 'node:http';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const packageRoot = fileURLToPath(new URL('..', import.meta.url));
const storybookDir = join(packageRoot, 'storybook-static');
const storyId = 'harness-scorecapture--capture';

const args = process.argv.slice(2);
const flags = new Map(
  args.filter((a) => a.startsWith('--')).map((a) => a.replace(/^--/, '').split('=')),
);
const positional = args.filter((a) => !a.startsWith('--'));

const scorePath = positional[0];
const outDir = positional[1] ?? join(packageRoot, 'haydn-capture');
const width = Number(flags.get('width') ?? 1100);
const deviceScaleFactor = Number(flags.get('scale') ?? 2);

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

/** A static server for the built Storybook — Chromium needs a URL, not a path */
function serveStorybook() {
  return new Promise((resolve, reject) => {
    const server = createServer(async (req, res) => {
      try {
        const url = new URL(req.url ?? '/', 'http://localhost');
        const path = url.pathname === '/' ? '/index.html' : url.pathname;
        const body = await readFile(join(storybookDir, path));

        res.writeHead(200, {
          'Content-Type': mimeTypes[extname(path)] ?? 'application/octet-stream',
        });
        res.end(body);
      } catch {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

const exists = (path) =>
  stat(path).then(
    () => true,
    () => false,
  );

async function main() {
  if (!(await exists(join(storybookDir, 'iframe.html')))) {
    console.error(
      `No Storybook build at ${storybookDir}.\n` +
        `Run "pnpm --filter web-client build-storybook" first.`,
    );
    process.exitCode = 1;
    return;
  }

  let score;

  if (scorePath) {
    if (!(await exists(scorePath))) {
      console.error(`No score file at ${scorePath}`);
      process.exitCode = 1;
      return;
    }

    score = JSON.parse(await readFile(scorePath, 'utf8'));
  }

  // A stale capture is worse than none — an unchanged PNG from a previous run
  // reads as "this system is fine" when it may simply no longer be produced.
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  const server = await serveStorybook();
  const { port } = server.address();
  const problems = [];
  const browser = await chromium.launch();
  let systemCount;

  try {
    const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor });

    page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error') problems.push(`console: ${message.text().slice(0, 300)}`);
    });

    if (score) {
      await page.addInitScript(
        // Runs in the page, not in Node — hence the browser global.
        // eslint-disable-next-line no-undef
        (injected) => void (window.__scoregroveHarnessScore__ = injected),
        // Structured-cloned into the page, so the score arrives as plain data —
        // which is all a Score ever is.
        score,
      );
    }

    await page.goto(`http://127.0.0.1:${port}/iframe.html?id=${storyId}&viewMode=story`, {
      waitUntil: 'networkidle',
    });

    // Deliberately not fatal. A score that fails to lay out is a *result* worth
    // reporting, and the page errors collected above are the diagnosis — so
    // reach the reporting below rather than throwing past it.
    try {
      await page.waitForSelector('svg.system-view', { timeout: 15_000 });
    } catch {
      problems.push('no systems rendered within 15s — the score probably failed to lay out');
    }

    // Bravura is a webfont; capturing before it loads yields blank noteheads.
    // eslint-disable-next-line no-undef -- runs in the page
    await page.evaluate(() => document.fonts.ready);

    const systems = await page.locator('svg.system-view').all();

    systemCount = systems.length;

    if (systemCount > 0) {
      await page.locator('.score-view').screenshot({ path: join(outDir, 'score.png') });

      for (const [index, system] of systems.entries()) {
        await system.screenshot({
          path: join(outDir, `system-${String(index + 1).padStart(3, '0')}.png`),
        });
      }
    }
  } finally {
    // Always, or a failed run leaves Chromium alive and the process never exits.
    await browser.close();
    server.close();
  }

  await writeFile(
    join(outDir, 'capture.json'),
    `${JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        source: scorePath ?? '(harness fallback fixture)',
        width,
        deviceScaleFactor,
        systems: systemCount,
        problems,
      },
      null,
      2,
    )}\n`,
  );

  console.log(`Captured ${systemCount} system(s) to ${outDir}`);
  console.log('Compare against packages/import/corpus/reference/haydn-op76-no3.pdf');

  // Loud, because a blank-but-"successful" capture is the failure mode that
  // wastes the most time — a screenshot of nothing still writes a PNG.
  if (problems.length) {
    console.error(`\n${problems.length} problem(s) while rendering:`);
    for (const problem of problems) console.error(`  - ${problem}`);
  }

  if (problems.length || systemCount === 0) process.exitCode = 1;
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
