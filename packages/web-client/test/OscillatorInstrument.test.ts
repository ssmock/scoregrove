import { describe, expect, it, vi, type Mock } from 'vitest';
import { createOscillatorInstrument } from '../src/playback/OscillatorInstrument';

/** A minimal fake Web Audio graph that records what the instrument builds. */
const fakeContext = () => {
  const connections: Array<[string, string]> = [];

  const makeParam = () => ({
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
    value: 0,
  });

  const destination = { id: 'destination' };

  type FakeParam = ReturnType<typeof makeParam>;
  const oscillators: Array<{ type: string; frequency: FakeParam; start: Mock; stop: Mock }> = [];
  const gains: Array<{ gain: FakeParam }> = [];

  const context = {
    currentTime: 0,
    destination,
    createOscillator: vi.fn(() => {
      const node = {
        id: `osc${oscillators.length}`,
        type: 'sawtooth',
        frequency: makeParam(),
        connect: (target: { id: string }) =>
          connections.push([`osc${oscillators.length - 1}`, target.id]),
        start: vi.fn(),
        stop: vi.fn(),
        disconnect: vi.fn(),
        onended: null as null | (() => void),
      };
      oscillators.push(node);
      return node;
    }),
    createGain: vi.fn(() => {
      const node = {
        id: `gain${gains.length}`,
        gain: makeParam(),
        connect: (target: { id: string }) =>
          connections.push([`gain${gains.length - 1}`, target.id]),
        disconnect: vi.fn(),
      };
      gains.push(node);
      return node;
    }),
  };

  return { context, connections, oscillators, gains };
};

describe('createOscillatorInstrument', () => {
  it('connects a master gain to the destination once', () => {
    const fake = fakeContext();

    createOscillatorInstrument(fake.context as unknown as AudioContext);

    // the first gain is the master, wired to the destination
    expect(fake.connections).toContainEqual(['gain0', 'destination']);
    expect(fake.gains[0].gain.value).toBeCloseTo(0.25, 6);
  });

  it('builds a sine voice through its own gain into the master', () => {
    const fake = fakeContext();
    const instrument = createOscillatorInstrument(fake.context as unknown as AudioContext);

    instrument.schedule({ frequency: 440, startTime: 1, durationSeconds: 0.5, velocity: 0.8 });

    const osc = fake.oscillators[0];

    expect(osc.type).toBe('sine');
    expect(osc.frequency.setValueAtTime).toHaveBeenCalledWith(440, 1);
    expect(osc.start).toHaveBeenCalledWith(1);
    expect(osc.stop).toHaveBeenCalled();
    // osc → its voice gain (gain1) → master gain (gain0)
    expect(fake.connections).toContainEqual(['osc0', 'gain1']);
    expect(fake.connections).toContainEqual(['gain1', 'gain0']);
  });

  it('shapes an attack/hold/release envelope on the voice gain', () => {
    const fake = fakeContext();
    const instrument = createOscillatorInstrument(fake.context as unknown as AudioContext);

    instrument.schedule({ frequency: 440, startTime: 2, durationSeconds: 1, velocity: 0.6 });

    const voiceGain = fake.gains[1].gain;

    // starts silent, ramps to the struck level, then ramps back to zero
    expect(voiceGain.setValueAtTime).toHaveBeenCalledWith(0, 2);
    expect(voiceGain.linearRampToValueAtTime).toHaveBeenCalledWith(0.6, expect.any(Number));
    const rampTargets = voiceGain.linearRampToValueAtTime.mock.calls.map((c) => c[0]);
    expect(rampTargets).toContain(0);
  });

  it('stopAll silences active voices', () => {
    const fake = fakeContext();
    const instrument = createOscillatorInstrument(fake.context as unknown as AudioContext);

    instrument.schedule({ frequency: 440, startTime: 0, durationSeconds: 1, velocity: 0.8 });
    instrument.stopAll();

    expect(fake.oscillators[0].stop).toHaveBeenCalledWith(0); // stopped at currentTime
    expect(fake.gains[1].gain.cancelScheduledValues).toHaveBeenCalled();
  });
});
