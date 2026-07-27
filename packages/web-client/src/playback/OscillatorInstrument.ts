import type { Instrument, Tone } from './Instrument';
import { defaultTimbre, type Timbre } from './Timbres';

/**
 * The v1 sound source: one oscillator per tone through a short gain envelope,
 * into a lowpass filter and a master gain. Zero assets, deterministic, and easy
 * to swap for a sampled instrument later behind the `Instrument` seam.
 *
 * The filter is what makes several of these sound like different instruments
 * rather than the same one at different pitches: a sawtooth is rich enough to
 * shape, and the cutoff is the shaping. One filter for the whole instrument
 * rather than one per tone — the timbre is a property of the player, and a
 * node per note would be wasteful for no audible gain.
 */

const options = {
  /** Envelope shape, in seconds — a quick attack and a short release tail */
  attack: 0.006,
  release: 0.06,
};

type ActiveTone = { oscillator: OscillatorNode; gain: GainNode };

export const createOscillatorInstrument = (
  context: AudioContext,
  timbre: Timbre = defaultTimbre,
): Instrument => {
  const master = context.createGain();
  master.gain.value = timbre.gain;

  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = timbre.cutoffHz;

  master.connect(filter);
  filter.connect(context.destination);

  const active = new Set<ActiveTone>();

  return {
    schedule({ frequency, startTime, durationSeconds, velocity }: Tone): void {
      const oscillator = context.createOscillator();
      oscillator.type = timbre.wave;
      oscillator.frequency.setValueAtTime(frequency, startTime);

      const gain = context.createGain();
      const peak = Math.max(0, Math.min(1, velocity));
      const attackEnd = startTime + options.attack;
      const releaseStart = Math.max(attackEnd, startTime + durationSeconds);
      const end = releaseStart + options.release;

      // Attack up to the struck level, hold, then release to silence.
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(peak, attackEnd);
      gain.gain.setValueAtTime(peak, releaseStart);
      gain.gain.linearRampToValueAtTime(0, end);

      oscillator.connect(gain);
      gain.connect(master);

      oscillator.start(startTime);
      oscillator.stop(end);

      const tone: ActiveTone = { oscillator, gain };
      active.add(tone);

      oscillator.onended = (): void => {
        active.delete(tone);
        oscillator.disconnect();
        gain.disconnect();
      };
    },

    stopAll(): void {
      const now = context.currentTime;

      for (const { oscillator, gain } of active) {
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(0, now);
        oscillator.stop(now);
      }

      active.clear();
    },
  };
};
