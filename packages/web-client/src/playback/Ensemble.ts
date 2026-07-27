import type { PartRouting, RoutedPart } from '@scoregrove/playback/PartRouting';
import type { Instrument, Tone } from './Instrument';

/**
 * Several instruments behind one `Instrument`.
 *
 * The transport holds a single instrument and calls `stopAll` on it from five
 * places — stop, pause, seek, loop and the natural end. Handing it an array
 * would turn every one of those into a fan-out and give the scheduler a concern
 * it does not need; satisfying the same seam instead leaves it untouched. That
 * seam was documented for swapping in a sampled instrument, and it takes a
 * whole quartet just as well.
 *
 * ## Routing is read per tone, not captured
 *
 * `routing` is a function because the transport outlives any one score: adding
 * a staff or editing the parts must reach the ensemble without rebuilding it
 * and losing the playback position. Reading it per scheduled tone costs an
 * array index.
 *
 * ## Players are built lazily and shared by sound
 *
 * Two violins have the same `instrument-sound` and therefore the same timbre,
 * so they share one audio graph rather than building two identical ones. That
 * is safe because mute and solo are decided **before** routing — a silenced
 * part never reaches an instrument at all, so sharing one cannot leak sound
 * from a muted part into an audible one.
 *
 * ## Mute and solo belong here
 *
 * Not in the transport, and not in the UI. A muted part is a note that is never
 * scheduled, which is the only place that decision can be made without either
 * teaching the scheduler about parts or cancelling notes after they have begun.
 * Solo overrides mute, as on any mixer: with anything soloed only the soloed
 * parts sound, and the mutes are ignored until solo clears.
 */

export type EnsembleDeps = {
  /** The current score's routing, read afresh for each tone */
  routing: () => PartRouting;
  /** Builds the player for a part; called once per distinct instrument sound */
  createInstrument: (part: RoutedPart) => Instrument;
};

export type Ensemble = Instrument & {
  /** Silences a part until unmuted; ignored while anything is soloed */
  setMuted(part: number, muted: boolean): void;
  /** Restricts sound to the soloed parts; clearing them all restores the mutes */
  setSoloed(part: number, soloed: boolean): void;
  /** Whether a part would sound right now, taking mute and solo together */
  sounds(part: number): boolean;
  mutedParts(): readonly number[];
  soloedParts(): readonly number[];
  /** Drops every mute and solo */
  reset(): void;
};

export const createEnsemble = (deps: EnsembleDeps): Ensemble => {
  const muted = new Set<number>();
  const soloed = new Set<number>();
  const players = new Map<string, Instrument>();

  const sounds = (part: number): boolean => (soloed.size ? soloed.has(part) : !muted.has(part));

  const playerFor = (part: RoutedPart): Instrument => {
    const key = part.sound ?? '';
    const existing = players.get(key);

    if (existing) return existing;

    const created = deps.createInstrument(part);

    players.set(key, created);

    return created;
  };

  return {
    schedule(tone: Tone): void {
      const routing = deps.routing();
      const part = routing.partOfStaff[tone.staff] ?? 0;

      if (!sounds(part)) return;

      // A staff the routing does not cover is a gap to play through, not a
      // reason for silence — it falls to the first part's player.
      playerFor(routing.parts[part] ?? routing.parts[0] ?? {}).schedule(tone);
    },

    stopAll(): void {
      for (const player of players.values()) player.stopAll();
    },

    setMuted(part: number, value: boolean): void {
      if (value) muted.add(part);
      else muted.delete(part);
    },

    setSoloed(part: number, value: boolean): void {
      if (value) soloed.add(part);
      else soloed.delete(part);
    },

    sounds,

    mutedParts: () => [...muted].sort((a, b) => a - b),
    soloedParts: () => [...soloed].sort((a, b) => a - b),

    reset(): void {
      muted.clear();
      soloed.clear();
    },
  };
};
