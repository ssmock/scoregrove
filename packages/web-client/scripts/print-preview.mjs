#!/usr/bin/env node
/**
 * Renders a Storybook story through a real headless-Chromium print pass and
 * saves the result as a PDF — the only way to actually see page breaks,
 * `break-inside`, and per-system clipping the way a real "Print" click would,
 * since a plain screenshot never paginates.
 *
 * Requires `packages/web-client`'s `playwright-core` devDependency and the
 * Chromium build it downloads (`pnpm --filter web-client exec playwright
 * install chromium` if `~/.cache/ms-playwright` is empty) plus, on a fresh
 * Linux box, the OS shared libraries Chromium links against — if launching
 * fails with a "libnspr4.so: cannot open shared object file" (or libnss3/
 * libnssutil3/libsmime3) error, that's a missing OS package, not a Node
 * problem: `sudo apt-get install -y libnspr4 libnss3` (or `sudo npx
 * playwright install-deps`) resolves it.
 *
 * Usage: `pnpm --filter web-client print:preview [storyId] [outFile]`
 *   storyId defaults to `app--performance-long-score` (see App.stories.ts).
 *   outFile defaults to `print-preview.pdf` in this package's root.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const packageRoot = fileURLToPath(new URL('..', import.meta.url));
const storybookDir = join(packageRoot, 'storybook-static');
const storyId = process.argv[2] ?? 'app--performance-long-score';
const outFile = process.argv[3] ?? join(packageRoot, 'print-preview.pdf');

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

/** A static file server for the already-built Storybook output — no other way to give Chromium a URL to load */
function serveStorybook() {
  return new Promise((resolve, reject) => {
    const server = createServer(async (req, res) => {
      try {
        const url = new URL(req.url ?? '/', 'http://localhost');
        const path = url.pathname === '/' ? '/index.html' : url.pathname;
        const filePath = join(storybookDir, path);
        const body = await readFile(filePath);

        res.writeHead(200, {
          'Content-Type': mimeTypes[extname(filePath)] ?? 'application/octet-stream',
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

async function main() {
  if (
    !(await stat(join(storybookDir, 'iframe.html')).then(
      () => true,
      () => false,
    ))
  ) {
    console.error(
      `No build at ${storybookDir} — run "pnpm --filter web-client build-storybook" first.`,
    );
    process.exitCode = 1;
    return;
  }

  const server = await serveStorybook();
  const { port } = server.address();

  try {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    await page.goto(`http://127.0.0.1:${port}/iframe.html?id=${storyId}&viewMode=story`, {
      waitUntil: 'networkidle',
    });
    await page.waitForSelector('svg.system-view', { timeout: 10_000 });

    await page.emulateMedia({ media: 'print' });
    await page.pdf({ path: outFile, format: 'Letter', printBackground: true });

    await browser.close();
    console.log(`Wrote ${outFile}`);
  } finally {
    server.close();
  }
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
