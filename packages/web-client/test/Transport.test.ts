import { describe, expect, it } from 'vitest';
import type { Performance } from '@scoregrove/playback/Compiler';
import type { NoteEvent } from '@scoregrove/playback/TimeMapping';
import type { Voice } from '../src/playback/Instrument';
import { createTransport, type Transport, type TransportDeps } from '../src/playback/Transport';

const event = (startSeconds: number, pitchNumber: number, durationSeconds = 0.5): NoteEvent => ({
  startSeconds,
  durationSeconds,
  pitchNumber,
  velocity: 0.8,
  address: { measure: 0, staff: 0, voice: 0, element: 0 },
});

const performanceOf = (events: NoteEvent[]): Performance => ({
  events,
  durationSeconds: events.reduce((max, e) => Math.max(max, e.startSeconds + e.durationSeconds), 0),
});

/** A test rig: a controllable clock, a recording instrument, and a manual timer. */
const rig = (overrides: Partial<TransportDeps> = {}) => {
  let clock = 0;
  const scheduled: Voice[] = [];
  let stopAllCount = 0;

  const deps: TransportDeps = {
    instrument: {
      schedule: (voice) => scheduled.push(voice),
      stopAll: () => {
        stopAllCount += 1;
      },
    },
    now: () => clock,
    resume: () => {},
    // A no-op timer: tests drive `tick()` themselves after advancing the clock.
    startTimer: () => () => {},
    frequencyOf: (pitchNumber) => pitchNumber, // identity, so we can assert on pitch
    lookaheadSeconds: 0.1,
    ...overrides,
  };

  const transport: Transport = createTransport(deps);

  return {
    transport,
    scheduled,
    stopAllCount: () => stopAllCount,
    advance: (seconds: number) => {
      clock += seconds;
    },
    setClock: (seconds: number) => {
      clock = seconds;
    },
  };
};

describe('Transport scheduling', () => {
  it('schedules only events within the look-ahead window, then more as time advances', () => {
    const r = rig();
    r.transport.load(performanceOf([event(0, 60), event(0.05, 62), event(1, 64)]));

    r.transport.play(); // at clock 0, window [0, 0.1): first two events
    expect(r.scheduled.map((v) => v.frequency)).toEqual([60, 62]);

    r.advance(0.95); // clock 0.95, window reaches [.., 1.05): the third event
    r.transport.tick();
    expect(r.scheduled.map((v) => v.frequency)).toEqual([60, 62, 64]);
  });

  it('schedules each event at its audio-clock start time', () => {
    const r = rig();
    r.setClock(10); // audio contexts start at an arbitrary time
    r.transport.load(performanceOf([event(0, 60), event(0.05, 62)]));

    r.transport.play();

    expect(r.scheduled.map((v) => v.startTime)).toEqual([10, 10.05]);
  });

  it('never schedules a note in the past (a late tick fires it now)', () => {
    const r = rig();
    r.transport.load(performanceOf([event(0, 60), event(0.05, 62)]));
    r.transport.play(); // schedules both from clock 0

    // A fresh performance whose first event is already overdue
    const r2 = rig();
    r2.transport.load(performanceOf([event(0, 60)]));
    r2.setClock(5);
    r2.transport.seek(0); // position 0 but clock is 5
    r2.transport.play();

    expect(r2.scheduled[0].startTime).toBe(5);
  });

  it('reports position from the audio clock while playing', () => {
    const r = rig();
    r.transport.load(performanceOf([event(0, 60, 2)]));
    r.transport.play();

    r.advance(0.75);
    expect(r.transport.positionSeconds()).toBeCloseTo(0.75, 9);
  });

  it('pauses at the current position and resumes from there', () => {
    const r = rig();
    r.transport.load(performanceOf([event(0, 60), event(1, 62, 1)]));
    r.transport.play();
    r.advance(0.4);
    r.transport.pause();

    expect(r.transport.status()).toBe('paused');
    expect(r.transport.positionSeconds()).toBeCloseTo(0.4, 9);
    expect(r.stopAllCount()).toBe(1);

    // resume from 0.4: advancing 0.7 more reaches the 1s event
    r.advance(5); // clock moves while paused; must not affect position
    expect(r.transport.positionSeconds()).toBeCloseTo(0.4, 9);
    r.transport.play();
    r.advance(0.7);
    r.transport.tick();
    expect(r.scheduled.some((v) => v.frequency === 62)).toBe(true);
  });

  it('seek repositions which events will fire', () => {
    const r = rig();
    r.transport.load(performanceOf([event(0, 60), event(1, 62), event(2, 64)]));
    r.transport.seek(1.5);
    r.transport.play();

    // from 1.5, only the event at 2 remains ahead
    r.advance(0.6);
    r.transport.tick();
    expect(r.scheduled.map((v) => v.frequency)).toEqual([64]);
  });

  it('stops back to the start and silences voices', () => {
    const r = rig();
    r.transport.load(performanceOf([event(0, 60, 2)]));
    r.transport.play();
    r.advance(0.5);
    r.transport.stop();

    expect(r.transport.status()).toBe('stopped');
    expect(r.transport.positionSeconds()).toBe(0);
    expect(r.stopAllCount()).toBe(1);
  });

  it('stops on its own at the end of the performance', () => {
    const r = rig();
    r.transport.load(performanceOf([event(0, 60, 1)]));
    r.transport.play();

    r.advance(1.2); // past the end
    r.transport.tick();

    expect(r.transport.status()).toBe('stopped');
  });

  it('loops back to the start when looping is on', () => {
    const r = rig();
    r.transport.load(performanceOf([event(0, 60, 1)]));
    r.transport.setLoop(true);
    r.transport.play();
    r.scheduled.length = 0;

    r.advance(1.2); // past the end → should restart
    r.transport.tick();

    expect(r.transport.status()).toBe('playing');
    expect(r.scheduled.map((v) => v.frequency)).toEqual([60]); // the first event again
  });
});
