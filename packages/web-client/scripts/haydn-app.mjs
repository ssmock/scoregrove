#!/usr/bin/env node
/**
 * Loads a score into the **real app** and reads it — the one thing every
 * capture so far has skipped.
 *
 * `haydn.mjs` renders a score through a Storybook harness story, which
 * exercises the engraving pipeline and `ScoreView` but nothing around them.
 * This drives the built application instead: the project store, the shell, the
 * scrolling document, and the print stylesheet. Those are where a score of 531
 * measures behaves differently from a fixture of six, and none of them have
 * ever seen one.
 *
 * The score is seeded straight into `localStorage` under the key `Projects`
 * uses, then opened through the project dialog exactly as a person would —
 * clicking rather than calling, so the path being tested is the real one.
 *
 * Two modes. By default it captures headlessly and exits, which is what CI and
 * a quick look want. With `--serve` it stays up instead and prints a URL for
 * you to open, having already seeded the score — no console paste, no manual
 * import step, and the app is fully interactive once it is loaded.
 *
 * Usage: `pnpm --filter web-client haydn-app <score.json> [outDir]`
 *
 * Options:
 *   --serve        keep the server running and print a URL instead of capturing
 *   --width=<px>   viewport width (default 1400)
 *   --height=<px>  viewport height (default 1000)
 *   --name=<text>  project name to save under (default "Haydn")
 *   --scrolls=<n>  how many screenfuls to capture (default 3)
 *   --timeout=<ms> how long to allow for the app to open (default 180000)
 */
import { createServer } from 'node:http';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const packageRoot = fileURLToPath(new URL('..', import.meta.url));
const distDir = join(packageRoot, 'dist');

const args = process.argv.slice(2);
const flags = new Map(
  args.filter((arg) => arg.startsWith('--')).map((arg) => arg.replace(/^--/, '').split('=')),
);
const [scorePath, outArg] = args.filter((arg) => !arg.startsWith('--'));

const fail = (message) => {
  console.error(`\n  ${message}\n`);
  process.exit(1);
};

if (!scorePath) fail('Usage: pnpm --filter web-client haydn-app <score.json> [outDir]');

const outDir = resolve(process.cwd(), outArg ?? join(packageRoot, 'haydn-app'));
const width = Number(flags.get('width') ?? 1400);
const height = Number(flags.get('height') ?? 1000);
const projectName = flags.get('name') ?? 'Haydn';
const scrolls = Number(flags.get('scrolls') ?? 3);

const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
};

const score = await readFile(resolve(process.cwd(), scorePath), 'utf8').catch(() =>
  fail(`Cannot read ${scorePath}`),
);

const template = await readFile(join(distDir, 'index.html'), 'utf8').catch(() =>
  fail('No dist/ — run `pnpm --filter web-client build` first'),
);

/**
 * The score is seeded by a script tag in the served HTML rather than by the
 * driver, so that opening the URL by hand works exactly as the headless run
 * does. `JSON.stringify` twice: once for the score, once to embed that string
 * as a JS literal without `</script>` or a stray quote breaking the document.
 */
const index = template.replace(
  '</head>',
  `<script>localStorage.setItem(${JSON.stringify(`scoregrove:project:${projectName}`)}, ${JSON.stringify(score)});</script></head>`,
);

// A single-page app: anything without a file extension falls back to index.html
const server = createServer(async (request, response) => {
  const path = decodeURIComponent((request.url ?? '/').split('?')[0]);
  const file = path === '/' || !extname(path) ? 'index.html' : path.replace(/^\//, '');

  try {
    const body = file === 'index.html' ? index : await readFile(join(distDir, file));

    response.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
    response.end(body);
  } catch {
    response.writeHead(404).end('not found');
  }
});

await new Promise((ready) => server.listen(0, ready));

const origin = `http://localhost:${server.address().port}`;

if (flags.has('serve')) {
  console.log(`
  ${origin}

  The project "${projectName}" is already seeded — open the URL, click
  Projects, and choose it. A whole quartet takes about a minute to appear and
  the tab will be unresponsive while it does; a movement is quick.

  Ctrl-C to stop.`);

  // Nothing further to do: the server keeps the process alive on its own.
} else {
  const problems = [];
  let browser;

  try {
    await rm(outDir, { recursive: true, force: true });
    await mkdir(outDir, { recursive: true });

    browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });

    page.on('console', (message) => {
      if (message.type() === 'error') problems.push(`console: ${message.text()}`);
    });
    page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));

    // The served HTML seeds the project itself, so the driver and a person
    // opening the URL by hand take exactly the same path.
    await page.goto(origin, { waitUntil: 'networkidle' });

    // Open it the way a person does, through the project dialog
    const started = Date.now();

    const patience = Number(flags.get('timeout') ?? 180_000);

    await page
      .getByRole('button', { name: /project|open/i })
      .first()
      .click({ timeout: patience });
    // A large score blocks the main thread while it lays out and mounts, so the
    // click itself can outlast Playwright's default patience — `noWaitAfter`
    // stops it waiting for navigations that are never coming.
    await page
      .getByRole('button', { name: projectName, exact: true })
      .click({ timeout: patience, noWaitAfter: true });
    await page.waitForSelector('.system-view', { timeout: patience });

    const systems = await page.locator('.system-view').count();
    const openedMs = Date.now() - started;

    await page.screenshot({ path: join(outDir, 'app-top.png') });

    for (let index = 1; index <= scrolls; index += 1) {
      await page.mouse.wheel(0, height * 0.9);
      await page.waitForTimeout(250);
      await page.screenshot({ path: join(outDir, `app-scroll-${index}.png`) });
    }

    // The print stylesheet is the one thing no on-screen capture exercises
    await page.emulateMedia({ media: 'print' });
    await page.waitForTimeout(250);
    await page.screenshot({ path: join(outDir, 'app-print.png'), fullPage: false });
    await page.pdf({ path: join(outDir, 'app-print.pdf'), format: 'A4', printBackground: true });
    await page.emulateMedia({ media: 'screen' });

    await writeFile(
      join(outDir, 'app.json'),
      JSON.stringify({ score: scorePath, systems, openedMs, width, height, problems }, null, 2),
    );

    console.log(`\n  Opened ${systems} systems in ${openedMs} ms; captures in ${outDir}`);

    if (problems.length) {
      console.error(`\n  ${problems.length} problem(s):`);
      for (const problem of problems) console.error(`    ${problem}`);
    }

    if (!systems) fail('The app rendered no systems — the score did not reach ScoreView');
  } finally {
    await browser?.close();
    server.close();
  }

  if (problems.length) process.exit(1);
}
