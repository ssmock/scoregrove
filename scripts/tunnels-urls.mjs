// Prints the current ngrok tunnel URLs, if `pnpm tunnels` is running. Reads the
// `.tunnels.json` the orchestrator maintains — handy for grabbing the public
// URLs from another terminal or a Claude session. If the file is left over from
// an orchestrator that's no longer running, it's treated as stale (and removed)
// rather than reported as live.

import { readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const urlsFile = join(dirname(fileURLToPath(import.meta.url)), '..', '.tunnels.json');

/** Is a process with this pid still around? (EPERM = alive but not ours; ESRCH = gone.) */
const isAlive = (pid) => {
  try {
    process.kill(pid, 0);

    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
};

let data;
try {
  data = JSON.parse(readFileSync(urlsFile, 'utf8'));
} catch {
  console.error('No live tunnels found (.tunnels.json is missing). Start them with: pnpm tunnels');
  process.exit(1);
}

const { startedAt, pid, stopsAt, ...urls } = data;

if (pid && !isAlive(pid)) {
  rmSync(urlsFile, { force: true });
  console.error(
    'Tunnels are no longer running (stale .tunnels.json removed). Restart: pnpm tunnels',
  );
  process.exit(1);
}

for (const [name, url] of Object.entries(urls)) console.log(`${name}: ${url}`);
if (startedAt) console.log(`(started ${startedAt}${pid ? `, pid ${pid}` : ''})`);
if (stopsAt) console.log(`(auto-stops ${stopsAt})`);
