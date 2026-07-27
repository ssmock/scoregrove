import { describe, expect, it, vi } from 'vitest';
import type { PartRouting } from '@scoregrove/playback/PartRouting';
import { createEnsemble } from '../src/playback/Ensemble';
import type { Instrument, Tone } from '../src/playback/Instrument';

/**
 * The seam's whole point: an ensemble is testable with recording fakes and no
 * `AudioContext` anywhere.
 */
const recorder = () => {
  const scheduled: Tone[] = [];
  const stopAll = vi.fn();

  return {
    scheduled,
    stopAll,
    instrument: { schedule: (tone: Tone) => void scheduled.push(tone), stopAll } as Instrument,
  };
};

const quartet: PartRouting = {
  partOfStaff: [0, 1, 2, 3],
  parts: [
    { name: 'Violin 1', sound: 'strings.violin' },
    { name: 'Violin 2', sound: 'strings.violin' },
    { name: 'Viola', sound: 'strings.viola' },
    { name: 'Violoncello', sound: 'strings.cello' },
  ],
};

const tone = (staff: number): Tone => ({
  frequency: 440,
  startTime: 0,
  durationSeconds: 1,
  velocity: 0.7,
  staff,
});

const setup = (routing: PartRouting = quartet) => {
  const made: { sound?: string; recorder: ReturnType<typeof recorder> }[] = [];

  const ensemble = createEnsemble({
    routing: () => routing,
    createInstrument: (part) => {
      const made_ = recorder();

      made.push({ ...(part.sound ? { sound: part.sound } : {}), recorder: made_ });

      return made_.instrument;
    },
  });

  return { ensemble, made };
};

describe('createEnsemble', () => {
  it('builds one player per distinct sound, sharing between the two violins', () => {
    const { ensemble, made } = setup();

    for (const staff of [0, 1, 2, 3]) ensemble.schedule(tone(staff));

    // Three players for four parts: the violins have the same timbre, and mute
    // is decided before routing, so sharing cannot leak a silenced part
    expect(made.map((entry) => entry.sound)).toEqual([
      'strings.violin',
      'strings.viola',
      'strings.cello',
    ]);
    expect(made[0].recorder.scheduled).toHaveLength(2);
  });

  it('routes each staff to its own part', () => {
    const { ensemble, made } = setup();

    ensemble.schedule(tone(3));

    expect(made).toHaveLength(1);
    expect(made[0].sound).toBe('strings.cello');
  });

  it('routes both staves of a two-staff part to one player', () => {
    const { ensemble, made } = setup({
      partOfStaff: [0, 0],
      parts: [{ name: 'Piano' }],
    });

    ensemble.schedule(tone(0));
    ensemble.schedule(tone(1));

    expect(made).toHaveLength(1);
    expect(made[0].recorder.scheduled).toHaveLength(2);
  });

  it('never schedules a muted part', () => {
    const { ensemble, made } = setup();

    ensemble.setMuted(2, true);
    ensemble.schedule(tone(2));
    ensemble.schedule(tone(3));

    // The viola never reached an instrument at all, rather than being cancelled
    // after starting — which is why mute lives here and not in the transport
    expect(made.map((entry) => entry.sound)).toEqual(['strings.cello']);
    expect(ensemble.sounds(2)).toBe(false);
  });

  it('lets solo override mute, as a mixer does', () => {
    const { ensemble } = setup();

    ensemble.setMuted(0, true);
    ensemble.setSoloed(0, true);

    expect(ensemble.sounds(0)).toBe(true);
    expect(ensemble.sounds(1)).toBe(false);

    // Clearing the solo restores the mute rather than forgetting it
    ensemble.setSoloed(0, false);

    expect(ensemble.sounds(0)).toBe(false);
    expect(ensemble.sounds(1)).toBe(true);
  });

  it('stops every player it has built', () => {
    const { ensemble, made } = setup();

    for (const staff of [0, 2, 3]) ensemble.schedule(tone(staff));
    ensemble.stopAll();

    expect(made.every((entry) => entry.recorder.stopAll.mock.calls.length === 1)).toBe(true);
  });

  it('reads the routing afresh, so editing the parts reaches playback', () => {
    let routing: PartRouting = { partOfStaff: [0], parts: [{ sound: 'strings.violin' }] };
    const made: (string | undefined)[] = [];

    const ensemble = createEnsemble({
      routing: () => routing,
      createInstrument: (part) => {
        made.push(part.sound);

        return recorder().instrument;
      },
    });

    ensemble.schedule(tone(0));
    routing = { partOfStaff: [0], parts: [{ sound: 'strings.cello' }] };
    ensemble.schedule(tone(0));

    expect(made).toEqual(['strings.violin', 'strings.cello']);
  });

  it('plays a staff the routing does not cover rather than dropping it', () => {
    const { ensemble, made } = setup({ partOfStaff: [], parts: [{ sound: 'strings.violin' }] });

    ensemble.schedule(tone(7));

    expect(made[0].recorder.scheduled).toHaveLength(1);
  });

  it('restores everything on reset', () => {
    const { ensemble } = setup();

    ensemble.setMuted(1, true);
    ensemble.setSoloed(2, true);
    ensemble.reset();

    expect(ensemble.mutedParts()).toEqual([]);
    expect(ensemble.soloedParts()).toEqual([]);
    expect(ensemble.sounds(1)).toBe(true);
  });
});
