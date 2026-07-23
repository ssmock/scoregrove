// Starts the web-client dev server and Storybook, opens an ngrok tunnel to each,
// and writes the public URLs to `.tunnels.json` at the repo root so they can be
// picked up from anywhere — including a Claude session (`pnpm tunnels:urls`, or
// just read `.tunnels.json`). Ctrl-C tears the whole thing down.
//
// Requires a (free) ngrok authtoken in the environment:
//   export NGROK_AUTHTOKEN=<token>   # https://dashboard.ngrok.com/get-started/your-authtoken
//
// Bring up a subset by naming targets, e.g. `pnpm tunnels web` (handy if your
// ngrok plan caps simultaneous tunnels). Tunnels auto-stop after an hour by
// default; override with `--ttl=<minutes>` or TUNNELS_TTL_MINUTES (0 disables).

import { spawn } from 'node:child_process';
import { createConnection } from 'node:net';
import { rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ngrok from '@ngrok/ngrok';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const urlsFile = join(repoRoot, '.tunnels.json');

/** What each named target runs and which local port it listens on. */
const TARGETS = {
  web: { port: 5173, args: ['--filter', 'web-client', 'dev'] },
  storybook: { port: 6006, args: ['--filter', 'web-client', 'storybook'] },
};

const requested = process.argv.slice(2).filter((arg) => !arg.startsWith('-'));
const selected = requested.length ? requested : Object.keys(TARGETS);

const unknown = selected.filter((name) => !TARGETS[name]);
if (unknown.length) {
  console.error(
    `Unknown target(s): ${unknown.join(', ')}. Choose from: ${Object.keys(TARGETS).join(', ')}.`,
  );
  process.exit(1);
}

if (!process.env.NGROK_AUTHTOKEN) {
  console.error(
    'NGROK_AUTHTOKEN is not set.\n' +
      'Grab a free authtoken at https://dashboard.ngrok.com/get-started/your-authtoken,\n' +
      'then: export NGROK_AUTHTOKEN=<token>  (add it to your shell profile to persist it).',
  );
  process.exit(1);
}

// Tunnels are a public door to a dev server, so they auto-stop after a while by
// default (an hour) rather than lingering. Override with `--ttl=<minutes>` or
// TUNNELS_TTL_MINUTES; 0 disables the auto-stop.
const ttlFlag = process.argv.slice(2).find((arg) => arg.startsWith('--ttl='));
const ttlRaw = ttlFlag ? ttlFlag.slice('--ttl='.length) : process.env.TUNNELS_TTL_MINUTES;
const ttlMinutes = ttlRaw === undefined || ttlRaw === '' ? 60 : Number(ttlRaw);

if (!Number.isFinite(ttlMinutes) || ttlMinutes < 0) {
  console.error(`Invalid auto-stop minutes: ${ttlRaw}. Use a non-negative number (0 disables it).`);
  process.exit(1);
}

const children = [];
const listeners = [];
let shuttingDown = false;
let keepAlive; // holds the event loop open until we're told to stop
let autoStop; // fires the auto-stop once the TTL elapses

/** Tags each line of a child's output so interleaved logs stay readable. */
const relayPrefixed = (label, stream, sink) => {
  let pending = '';

  stream.on('data', (chunk) => {
    pending += chunk.toString();
    const lines = pending.split('\n');
    pending = lines.pop() ?? '';
    for (const line of lines) sink.write(`[${label}] ${line}\n`);
  });
};

const startServer = (name) => {
  // `detached` puts the dev server in its own process group so shutdown can
  // signal the whole group — pnpm spawns Vite/Storybook as children that a
  // plain kill of pnpm would otherwise orphan (leaving the port held).
  const child = spawn('pnpm', TARGETS[name].args, {
    cwd: repoRoot,
    env: process.env,
    detached: true,
  });

  relayPrefixed(name, child.stdout, process.stdout);
  relayPrefixed(name, child.stderr, process.stderr);
  child.on('exit', (code) => {
    if (!shuttingDown) {
      console.error(`[${name}] exited (code ${code}) — shutting everything down.`);
      shutdown(1);
    }
  });

  children.push(child);
};

/** Quick probe: is something already accepting connections on this port? */
const isPortInUse = (port, timeoutMs = 1000) =>
  new Promise((resolve) => {
    const socket = createConnection({ host: '127.0.0.1', port });
    const settle = (inUse) => {
      socket.destroy();
      resolve(inUse);
    };

    socket.once('connect', () => settle(true));
    socket.once('error', () => settle(false));
    setTimeout(() => settle(false), timeoutMs);
  });

/** Resolves once something is accepting connections on the port (the dev server is up). */
const waitForPort = (port, { timeoutMs = 90_000, intervalMs = 400 } = {}) =>
  new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;

    const attempt = () => {
      const socket = createConnection({ host: '127.0.0.1', port });

      socket.once('connect', () => {
        socket.destroy();
        resolve();
      });
      socket.once('error', () => {
        socket.destroy();
        if (Date.now() > deadline) reject(new Error(`Timed out waiting for port ${port}.`));
        else setTimeout(attempt, intervalMs);
      });
    };

    attempt();
  });

const shutdown = (code = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log('\nStopping tunnels and dev servers…');
  clearInterval(keepAlive);
  clearTimeout(autoStop);
  try {
    rmSync(urlsFile, { force: true });
  } catch {
    /* nothing to clean up */
  }
  for (const listener of listeners) listener.close().catch(() => {});
  for (const child of children) {
    try {
      process.kill(-child.pid, 'SIGINT'); // negative pid → the whole process group
    } catch {
      /* already gone */
    }
  }

  setTimeout(() => process.exit(code), 500);
};

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

const main = async () => {
  for (const name of selected) {
    const { port } = TARGETS[name];

    // If the port is already serving, tunnel that rather than spawning a
    // duplicate — a fresh Vite/Storybook would silently drift to another port
    // and we'd end up tunnelling the wrong one.
    if (await isPortInUse(port)) {
      console.log(`${name}: reusing what's already serving on localhost:${port}.`);
    } else {
      console.log(`Starting ${name} on localhost:${port}…`);
      startServer(name);
    }
  }

  await Promise.all(selected.map((name) => waitForPort(TARGETS[name].port)));

  const urls = {};
  for (const name of selected) {
    const listener = await ngrok.forward({ addr: TARGETS[name].port, authtoken_from_env: true });

    listeners.push(listener);
    urls[name] = listener.url();
  }

  const stopsAt = ttlMinutes > 0 ? new Date(Date.now() + ttlMinutes * 60_000).toISOString() : null;

  // `pid` lets other processes (a `pnpm tunnels:stop`, a Claude session) both
  // signal this orchestrator and tell whether it's still alive — a leftover
  // `.tunnels.json` from an unclean exit otherwise reads as live URLs. `stopsAt`
  // records the scheduled auto-stop, if any.
  writeFileSync(
    urlsFile,
    `${JSON.stringify({ ...urls, pid: process.pid, startedAt: new Date().toISOString(), stopsAt }, null, 2)}\n`,
  );

  const pad = Math.max(...selected.map((name) => name.length));
  console.log(`\n${'─'.repeat(64)}`);
  console.log('  Public tunnels are live:');
  for (const name of selected) console.log(`    ${name.padEnd(pad)}  ${urls[name]}`);
  console.log(`  (also in .tunnels.json — run "pnpm tunnels:urls" anytime)`);
  console.log(
    ttlMinutes > 0
      ? `  Auto-stops in ${ttlMinutes} min; Ctrl-C or "pnpm tunnels:stop" to stop sooner.`
      : '  Press Ctrl-C to stop (or "pnpm tunnels:stop" from elsewhere).',
  );
  console.log(`${'─'.repeat(64)}\n`);

  // In the pure-reuse case there are no child servers to wait on, so keep the
  // process alive ourselves rather than relying on the tunnels' own handles.
  keepAlive = setInterval(() => {}, 1 << 30);

  if (ttlMinutes > 0) {
    autoStop = setTimeout(() => {
      console.log(`\nReached the ${ttlMinutes}-minute auto-stop limit.`);
      shutdown(0);
    }, ttlMinutes * 60_000);
  }
};

main().catch((error) => {
  console.error('Failed to start tunnels:', error?.message ?? error);
  shutdown(1);
});
