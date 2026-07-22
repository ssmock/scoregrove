import { describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import { Clef } from '@scoregrove/domain/Clef';
import { Duration, NoteValue } from '@scoregrove/domain/Duration';
import { Mode } from '@scoregrove/domain/KeySignature';
import { StaffContent, type Measure } from '@scoregrove/domain/Measure';
import { Note, type MeasureElement } from '@scoregrove/domain/MeasureElement';
import { NonEmptyArray } from '@scoregrove/domain/NonEmptyArray';
import { Octave, Pitch, PitchClass, PitchLetter } from '@scoregrove/domain/Pitch';
import { PositiveInteger } from '@scoregrove/domain/PositiveInteger';
import { Result } from '@scoregrove/domain/Result';
import { Score } from '@scoregrove/domain/Score';
import { Staff } from '@scoregrove/domain/Staff';
import { BeatUnit } from '@scoregrove/domain/TimeSignature';
import type { Performance } from '@scoregrove/playback/Compiler';
import { createEditorStore } from '../src/store/editorStore';
import type { Transport, TransportStatus } from '../src/playback/Transport';

const note = (letter: PitchLetter, duration: Duration): Note =>
  Note.of(Pitch.of(PitchClass.of(letter), Octave.of(4)), duration);

const whole = Duration.of(NoteValue.Whole);

const measureOf = (elements: MeasureElement[]): Measure => ({
  contents: NonEmptyArray.of([StaffContent.singleVoice(NonEmptyArray.of(elements))]),
});

const scoreOf = (measures: Measure[]): Score =>
  Score.of({
    staves: NonEmptyArray.of([Staff.of(Clef.Treble)]),
    key: { tonic: PitchClass.of(PitchLetter.C), mode: Mode.Major },
    time: { beats: PositiveInteger.of(4), beatUnit: BeatUnit.Quarter },
    measures: NonEmptyArray.of(measures),
  });

const validScore = (): Score => scoreOf([measureOf([note(PitchLetter.C, whole)])]);
const overfullScore = (): Score =>
  scoreOf([measureOf([note(PitchLetter.C, whole), note(PitchLetter.D, whole)])]);

/** A controllable stand-in for the real Web Audio transport. */
const fakeTransport = () => {
  let status: TransportStatus = 'stopped';
  let position = 0;
  let duration = 0;
  const calls: string[] = [];
  let onPosition: ((seconds: number) => void) | undefined;

  const transport: Transport = {
    load: (performance: Performance) => {
      calls.push('load');
      duration = performance.durationSeconds;
    },
    play: () => {
      calls.push('play');
      status = 'playing';
    },
    pause: () => {
      calls.push('pause');
      status = 'paused';
    },
    stop: () => {
      calls.push('stop');
      status = 'stopped';
      position = 0;
    },
    seek: (seconds: number) => {
      calls.push(`seek:${seconds}`);
      position = seconds;
    },
    setLoop: (loop: boolean) => calls.push(`loop:${loop}`),
    tick: () => {},
    status: () => status,
    positionSeconds: () => position,
    durationSeconds: () => duration,
    dispose: () => calls.push('dispose'),
  };

  return {
    calls,
    create: (handler: (seconds: number) => void): Transport => {
      onPosition = handler;
      return transport;
    },
    /** Simulate the transport reporting a new position (as a tick would) */
    emit: (seconds: number, nextStatus?: TransportStatus) => {
      position = seconds;
      if (nextStatus) status = nextStatus;
      onPosition?.(seconds);
    },
  };
};

const storeWith = (score = validScore()) => {
  const fake = fakeTransport();
  const store = createEditorStore(score, { createTransport: fake.create });

  return { store, fake };
};

describe('editor store playback', () => {
  it('compiles, loads, and plays from stopped; pauses and resumes on toggle', () => {
    const { store, fake } = storeWith();

    expect(Result.isOk(store.togglePlayback())).toBe(true);
    expect(store.state.playback.status).toBe('playing');
    expect(store.state.playback.durationSeconds).toBeGreaterThan(0);
    expect(fake.calls).toEqual(['load', 'play']);

    store.togglePlayback(); // pause
    expect(store.state.playback.status).toBe('paused');

    store.togglePlayback(); // resume — no recompile/reload
    expect(store.state.playback.status).toBe('playing');
    expect(fake.calls).toEqual(['load', 'play', 'pause', 'play']);

    store.dispose();
  });

  it('refuses to play an invalid score', () => {
    const { store, fake } = storeWith(overfullScore());

    const result = store.togglePlayback();

    expect(Result.isError(result)).toBe(true);
    expect(store.state.playback.status).toBe('stopped');
    expect(fake.calls).not.toContain('play');

    store.dispose();
  });

  it('reflects position and status reported by the transport', () => {
    const { store, fake } = storeWith();

    store.togglePlayback();
    fake.emit(1.25);
    expect(store.state.playback.positionSeconds).toBeCloseTo(1.25, 9);

    // a natural end reported by the transport flows back to the store
    fake.emit(0, 'stopped');
    expect(store.state.playback.status).toBe('stopped');

    store.dispose();
  });

  it('stop resets, seek repositions, and loop is applied to the transport', () => {
    const { store, fake } = storeWith();

    store.togglePlayback();
    store.seekPlayback(2);
    expect(fake.calls).toContain('seek:2');

    store.setPlaybackLoop(true);
    expect(store.state.playback.loop).toBe(true);
    expect(fake.calls).toContain('loop:true');

    store.stopPlayback();
    expect(store.state.playback.status).toBe('stopped');
    expect(store.state.playback.positionSeconds).toBe(0);

    store.dispose();
  });

  it('halts playback when the score is edited', async () => {
    const { store } = storeWith();

    store.togglePlayback();
    expect(store.state.playback.status).toBe('playing');

    store.addMeasure(); // any score edit
    await nextTick();

    expect(store.state.playback.status).toBe('stopped');

    store.dispose();
  });

  it('reports which addresses are sounding at the reported position', () => {
    // one whole-note C: it sounds from 0 to the end of the bar
    const { store, fake } = storeWith();

    store.togglePlayback();
    fake.emit(0.5);
    expect(store.state.playback.sounding).toEqual([{ measure: 0, staff: 0, voice: 0, element: 0 }]);

    fake.emit(100); // past the end — nothing sounding
    expect(store.state.playback.sounding).toEqual([]);

    store.dispose();
  });

  it('never builds a transport until playback is first requested', () => {
    const fake = fakeTransport();
    let created = 0;
    const store = createEditorStore(validScore(), {
      createTransport: (handler) => {
        created += 1;
        return fake.create(handler);
      },
    });

    expect(created).toBe(0); // constructing the store touches no audio

    store.togglePlayback();
    expect(created).toBe(1);

    store.dispose();
  });
});
