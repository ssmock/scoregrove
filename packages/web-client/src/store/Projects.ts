import type { Score } from '@scoregrove/domain/Score';

/**
 * localStorage-backed project persistence. The key prefix doubles as the
 * index — listing projects means scanning for matching keys rather than
 * maintaining a separate list that could drift out of sync with them.
 *
 * No schema validation on load: a score parses however it parses, trusting
 * that only this module ever wrote it. A localStorage entry corrupted by
 * hand, or left over from an incompatible earlier version of the domain
 * model, would surface as a runtime error downstream (in Score.check or the
 * rendering pipeline) rather than a clean "invalid project" message — a
 * known gap, not something v1 guards against.
 */
const keyPrefix = 'scoregrove:project:';

export const Projects = {
  list(): string[] {
    const names: string[] = [];

    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);

      if (key?.startsWith(keyPrefix)) names.push(key.slice(keyPrefix.length));
    }

    return names.sort();
  },

  exists(name: string): boolean {
    return localStorage.getItem(keyPrefix + name) !== null;
  },

  save(name: string, score: Score): void {
    localStorage.setItem(keyPrefix + name, JSON.stringify(score));
  },

  load(name: string): Score | undefined {
    const raw = localStorage.getItem(keyPrefix + name);

    return raw ? (JSON.parse(raw) as Score) : undefined;
  },

  delete(name: string): void {
    localStorage.removeItem(keyPrefix + name);
  },
};
