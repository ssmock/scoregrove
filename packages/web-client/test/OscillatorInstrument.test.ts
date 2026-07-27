import { describe, expect, it, vi, type Mock } from 'vitest';
import { createOscillatorInstrument } from '../src/playback/OscillatorInstrument';
import { defaultTimbre, Timbres } from '../src/playback/Timbres';

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
  const filters: Array<{ type: string; frequency: FakeParam }> = [];

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
    createBiquadFilter: vi.fn(() => {
      const node = {
        id: `filter${filters.length}`,
        type: 'lowpass',
        frequency: makeParam(),
        connect: (target: { id: string }) =>
          connections.push([`filter${filters.length - 1}`, target.id]),
        disconnect: vi.fn(),
      };
      filters.push(node);
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

  return { context, connections, oscillators, gains, filters };
};

describe('createOscillatorInstrument', () => {
  it('sends the master gain through a lowpass filter to the destination', () => {
    const fake = fakeContext();

    createOscillatorInstrument(fake.context as unknown as AudioContext);

    // The filter is what gives an instrument its colour, so it sits on the
    // whole player rather than on each tone: master → filter → destination.
    expect(fake.connections).toContainEqual(['gain0', 'filter0']);
    expect(fake.connections).toContainEqual(['filter0', 'destination']);
    expect(fake.gains[0].gain.value).toBeCloseTo(defaultTimbre.gain, 6);
    expect(fake.filters[0].frequency.value).toBeCloseTo(defaultTimbre.cutoffHz, 6);
  });

  it('takes its waveform and colour from the timbre it is given', () => {
    const fake = fakeContext();
    const cello = Timbres.forSound('strings.cello');
    const instrument = createOscillatorInstrument(fake.context as unknown as AudioContext, cello);

    instrument.schedule({
      frequency: 220,
      startTime: 0,
      durationSeconds: 1,
      velocity: 0.5,
      staff: 0,
    });

    expect(fake.oscillators[0].type).toBe(cello.wave);
    expect(fake.filters[0].frequency.value).toBeCloseTo(cello.cutoffHz, 6);
    // Darker than a violin, which is what makes the two tellable apart
    expect(cello.cutoffHz).toBeLessThan(Timbres.forSound('strings.violin').cutoffHz);
  });

  it('builds a tone through its own gain into the master', () => {
    const fake = fakeContext();
    const instrument = createOscillatorInstrument(fake.context as unknown as AudioContext);

    instrument.schedule({
      frequency: 440,
      startTime: 1,
      durationSeconds: 0.5,
      velocity: 0.8,
      staff: 0,
    });

    const osc = fake.oscillators[0];

    expect(osc.type).toBe(defaultTimbre.wave);
    expect(osc.frequency.setValueAtTime).toHaveBeenCalledWith(440, 1);
    expect(osc.start).toHaveBeenCalledWith(1);
    expect(osc.stop).toHaveBeenCalled();
    // osc → its own tone gain (gain1) → master gain (gain0)
    expect(fake.connections).toContainEqual(['osc0', 'gain1']);
    expect(fake.connections).toContainEqual(['gain1', 'gain0']);
  });

  it('shapes an attack/hold/release envelope on the tone gain', () => {
    const fake = fakeContext();
    const instrument = createOscillatorInstrument(fake.context as unknown as AudioContext);

    instrument.schedule({
      frequency: 440,
      startTime: 2,
      durationSeconds: 1,
      velocity: 0.6,
      staff: 0,
    });

    const toneGain = fake.gains[1].gain;

    // starts silent, ramps to the struck level, then ramps back to zero
    expect(toneGain.setValueAtTime).toHaveBeenCalledWith(0, 2);
    expect(toneGain.linearRampToValueAtTime).toHaveBeenCalledWith(0.6, expect.any(Number));
    const rampTargets = toneGain.linearRampToValueAtTime.mock.calls.map((c) => c[0]);
    expect(rampTargets).toContain(0);
  });

  it('stopAll silences active tones', () => {
    const fake = fakeContext();
    const instrument = createOscillatorInstrument(fake.context as unknown as AudioContext);

    instrument.schedule({
      frequency: 440,
      startTime: 0,
      durationSeconds: 1,
      velocity: 0.8,
      staff: 0,
    });
    instrument.stopAll();

    expect(fake.oscillators[0].stop).toHaveBeenCalledWith(0); // stopped at currentTime
    expect(fake.gains[1].gain.cancelScheduledValues).toHaveBeenCalled();
  });
});
