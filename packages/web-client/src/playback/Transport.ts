import type { Performance } from '@scoregrove/playback/Compiler';
import { PitchSounding } from '@scoregrove/playback/PitchSounding';
import type { NoteEvent } from '@scoregrove/playback/TimeMapping';
import { createOscillatorInstrument } from './OscillatorInstrument';
import type { Instrument } from './Instrument';

/**
 * Drives a compiled `Performance` to an instrument in real time, using the
 * classic look-ahead scheduler: on each tick it schedules every event starting
 * within the next lookahead window at a sample-accurate audio-clock time, so JS
 * timer jitter never reaches the audio. All timekeeping reads the injected
 * audio clock — never a wall clock — which keeps position honest and makes the
 * whole thing testable with a fake clock and a recording instrument, no real
 * `AudioContext` needed.
 */

export type TransportStatus = 'stopped' | 'playing' | 'paused';

export type TransportDeps = {
  instrument: Instrument;
  /** The audio clock, in seconds (e.g. `() => audioContext.currentTime`). */
  now: () => number;
  /** Resume/unlock the audio backend on a user gesture (e.g. `() => audioContext.resume()`). */
  resume: () => void;
  /** Start a periodic driver, returning a stop function. Real: a `setInterval` on `tick`. */
  startTimer: (tick: () => void) => () => void;
  /** MIDI number → hertz; defaults to the equal-tempered mapping. */
  frequencyOf?: (pitchNumber: number) => number;
  /** How far ahead to schedule, in seconds. */
  lookaheadSeconds?: number;
  /** Called each tick with the current position, for a UI playhead. */
  onPosition?: (seconds: number) => void;
};

export type Transport = {
  load(performance: Performance): void;
  play(): void;
  pause(): void;
  stop(): void;
  seek(seconds: number): void;
  setLoop(loop: boolean): void;
  /** The scheduling step; the timer calls it, and tests can call it directly. */
  tick(): void;
  status(): TransportStatus;
  positionSeconds(): number;
  durationSeconds(): number;
  dispose(): void;
};

/** First event index whose start is at or after `seconds` (events are sorted by start). */
const indexAtOrAfter = (events: readonly NoteEvent[], seconds: number): number => {
  let lo = 0;
  let hi = events.length;

  while (lo < hi) {
    const mid = (lo + hi) >> 1;

    if (events[mid].startSeconds < seconds) lo = mid + 1;
    else hi = mid;
  }

  return lo;
};

export const createTransport = (deps: TransportDeps): Transport => {
  const frequencyOf = deps.frequencyOf ?? PitchSounding.frequencyOfNumber;
  const lookahead = deps.lookaheadSeconds ?? 0.1;

  let performance: Performance | null = null;
  let status: TransportStatus = 'stopped';
  let loop = false;

  // `origin*` anchor the performance timeline to the audio clock: at audio time
  // `originAudioTime`, the performance is at `originPosition` seconds.
  let originAudioTime = 0;
  let originPosition = 0;
  let cursor = 0;
  let stopTimer: (() => void) | null = null;

  const events = (): readonly NoteEvent[] => performance?.events ?? [];
  const duration = (): number => performance?.durationSeconds ?? 0;

  const rawPosition = (): number =>
    status === 'playing' ? deps.now() - originAudioTime + originPosition : originPosition;

  const position = (): number => Math.min(Math.max(rawPosition(), 0), duration());

  const clearTimer = (): void => {
    stopTimer?.();
    stopTimer = null;
  };

  const beginFrom = (seconds: number): void => {
    originPosition = seconds;
    originAudioTime = deps.now();
    cursor = indexAtOrAfter(events(), seconds);
  };

  const transport: Transport = {
    load(next: Performance): void {
      clearTimer();
      if (status !== 'stopped') deps.instrument.stopAll();
      status = 'stopped';
      originPosition = 0;
      cursor = 0;
      performance = next;
    },

    play(): void {
      if (!performance || status === 'playing') return;

      deps.resume();
      status = 'playing';
      beginFrom(originPosition);
      stopTimer = deps.startTimer(transport.tick);
      transport.tick();
    },

    pause(): void {
      if (status !== 'playing') return;

      const at = position();
      clearTimer();
      deps.instrument.stopAll();
      status = 'paused';
      originPosition = at;
    },

    stop(): void {
      clearTimer();
      deps.instrument.stopAll();
      status = 'stopped';
      originPosition = 0;
      cursor = 0;
    },

    seek(seconds: number): void {
      const target = Math.min(Math.max(seconds, 0), duration());

      if (status === 'playing') {
        deps.instrument.stopAll();
        beginFrom(target);
        transport.tick();
      } else {
        originPosition = target;
        cursor = indexAtOrAfter(events(), target);
      }
    },

    setLoop(next: boolean): void {
      loop = next;
    },

    tick(): void {
      if (status !== 'playing' || !performance) return;

      const all = performance.events;
      const windowEnd = rawPosition() + lookahead;

      while (cursor < all.length && all[cursor].startSeconds < windowEnd) {
        const event = all[cursor];
        const audioStart = originAudioTime + (event.startSeconds - originPosition);

        deps.instrument.schedule({
          frequency: frequencyOf(event.pitchNumber),
          // Never schedule in the past — a late tick fires the note immediately.
          startTime: Math.max(audioStart, deps.now()),
          durationSeconds: event.durationSeconds,
          velocity: event.velocity,
        });

        cursor += 1;
      }

      if (rawPosition() >= performance.durationSeconds && cursor >= all.length) {
        if (loop) {
          transport.seek(0); // seeks, reschedules, and reports position itself
          return;
        }

        // Natural end: stop advancing, but let the final notes ring out.
        clearTimer();
        status = 'stopped';
        originPosition = 0;
        cursor = 0;
      }

      // Reported once per tick, after any end/stop transition, so a listener
      // sees the final status and position together.
      deps.onPosition?.(position());
    },

    status(): TransportStatus {
      return status;
    },

    positionSeconds(): number {
      return position();
    },

    durationSeconds(): number {
      return duration();
    },

    dispose(): void {
      transport.stop();
    },
  };

  return transport;
};

/**
 * The browser wiring: a transport backed by a real `AudioContext` and an
 * oscillator synth, ticking on a 25 ms interval. The caller owns the context's
 * lifetime (and should `close()` it when done). Resume happens on `play`, which
 * a user gesture must trigger, per the autoplay policy.
 */
export const createBrowserTransport = (
  context: AudioContext,
  extras: Pick<TransportDeps, 'onPosition'> = {},
): Transport =>
  createTransport({
    instrument: createOscillatorInstrument(context),
    now: () => context.currentTime,
    resume: () => void context.resume(),
    startTimer: (tick) => {
      const handle = setInterval(tick, 25);

      return () => clearInterval(handle);
    },
    ...extras,
  });
