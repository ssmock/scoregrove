// Stops a running `pnpm tunnels` from anywhere (another terminal, a Claude
// session) by signalling the orchestrator recorded in `.tunnels.json`. SIGINT
// triggers its graceful shutdown: close the ngrok tunnels, stop the dev
// servers, and remove `.tunnels.json`.

import { readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

const urlsFile = join(dirname(fileURLToPath(import.meta.url)), '..', '.tunnels.json');

const isAlive = (pid) => {
  try {
    process.kill(pid, 0);

    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
};

let pid;
try {
  ({ pid } = JSON.parse(readFileSync(urlsFile, 'utf8')));
} catch {
  console.log('No tunnels appear to be running (.tunnels.json is missing).');
  process.exit(0);
}

if (!pid || !isAlive(pid)) {
  rmSync(urlsFile, { force: true });
  console.log('Tunnels were not running; cleaned up the stale .tunnels.json.');
  process.exit(0);
}

process.kill(pid, 'SIGINT');
console.log(`Sent stop signal to the tunnels (pid ${pid})…`);

// Give the orchestrator a moment to tear down and remove its file.
for (let i = 0; i < 20 && isAlive(pid); i += 1) await sleep(250);

if (isAlive(pid)) {
  console.error(`Orchestrator (pid ${pid}) is still running — you may need to stop it manually.`);
  process.exit(1);
}

rmSync(urlsFile, { force: true });
console.log('Tunnels stopped.');
