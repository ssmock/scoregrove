import type { Instrument, Voice } from './Instrument';

/**
 * The v1 sound source: a plain sine oscillator per voice through a short ADSR
 * gain envelope into a shared master gain. Zero assets, deterministic, and
 * easy to swap for a sampled instrument later behind the `Instrument` seam. A
 * sine keeps the timbre clean and midrange rather than buzzy; the master gain
 * leaves headroom so stacked chord tones don't clip.
 */

const options = {
  /** Master level, well below unity so several simultaneous voices don't clip */
  masterGain: 0.25,
  /** Envelope shape, in seconds — a quick attack and a short release tail */
  attack: 0.006,
  release: 0.06,
};

type ActiveVoice = { oscillator: OscillatorNode; gain: GainNode };

export const createOscillatorInstrument = (context: AudioContext): Instrument => {
  const master = context.createGain();
  master.gain.value = options.masterGain;
  master.connect(context.destination);

  const active = new Set<ActiveVoice>();

  return {
    schedule({ frequency, startTime, durationSeconds, velocity }: Voice): void {
      const oscillator = context.createOscillator();
      oscillator.type = 'sine';
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

      const voice: ActiveVoice = { oscillator, gain };
      active.add(voice);

      oscillator.onended = (): void => {
        active.delete(voice);
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
