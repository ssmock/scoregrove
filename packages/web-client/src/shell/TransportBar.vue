<script setup lang="ts">
import { computed } from 'vue';
import AppButton from '../ui/AppButton.vue';
import { useEditorStore } from '../store/useEditorStore';

/**
 * Playback controls: play/pause, stop, a seek scrubber with a time readout,
 * and a loop toggle. Reads the store's `playback` slice and dispatches
 * intents — it owns no audio itself. The scrubber is disabled until a score
 * has been played once (there's no duration to scrub before then).
 */
const store = useEditorStore();

const playback = computed(() => store.state.playback);
const isPlaying = computed(() => playback.value.status === 'playing');
const scrubbable = computed(() => playback.value.durationSeconds > 0);

/**
 * A compact readout of the looped bars (1-based). Bounds are barline indices:
 * a passage from barline `lo` to barline `hi` sounds bars `lo+1 … hi`.
 */
const loopLabel = computed(() => {
  const start = playback.value.loopStartMeasure;
  const end = playback.value.loopEndMeasure;

  if (start === null && end === null) return null;
  if (start !== null && end !== null) {
    const lo = Math.min(start, end);
    const hi = Math.max(start, end);

    return lo + 1 >= hi ? `${hi}` : `${lo + 1}–${hi}`;
  }

  return start !== null ? `from ${start + 1}` : `to ${end}`;
});

/** m:ss for the readout */
function clock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;

  return `${minutes}:${rest.toString().padStart(2, '0')}`;
}

function onScrub(event: Event): void {
  const value = Number((event.target as HTMLInputElement).value);

  store.seekPlayback(value);
}
</script>

<template>
  <div class="transport" role="group" aria-label="Playback">
    <div class="transport__controls">
      <AppButton :aria-label="isPlaying ? 'Pause' : 'Play'" @click="store.togglePlayback()">
        {{ isPlaying ? 'Pause' : 'Play' }}
      </AppButton>
      <AppButton
        variant="quiet"
        aria-label="Stop"
        :disabled="playback.status === 'stopped'"
        @click="store.stopPlayback()"
      >
        Stop
      </AppButton>

      <AppButton
        v-if="loopLabel"
        variant="quiet"
        :pressed="true"
        title="Clear loop passage"
        aria-label="Clear loop passage"
        @click="store.clearLoopRegion()"
      >
        ⟲ {{ loopLabel }} ✕
      </AppButton>
      <AppButton
        v-else
        variant="quiet"
        :pressed="playback.loop"
        aria-label="Loop"
        @click="store.setPlaybackLoop(!playback.loop)"
      >
        Loop
      </AppButton>
    </div>

    <div class="transport__position">
      <input
        class="transport__scrubber"
        type="range"
        min="0"
        :max="playback.durationSeconds || 0"
        step="0.01"
        :value="playback.positionSeconds"
        :disabled="!scrubbable"
        aria-label="Seek"
        @input="onScrub"
      />

      <span class="transport__time">
        {{ clock(playback.positionSeconds) }} / {{ clock(playback.durationSeconds) }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.transport {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

/* Controls on top; the seek scrubber + time readout on their own line below,
   so the whole group fits the narrow editor sidebar without crowding. */
.transport__controls {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.transport__position {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.transport__scrubber {
  flex: 1 1 auto;
  min-width: 4rem;
  accent-color: var(--color-accent);
}

.transport__time {
  font-variant-numeric: tabular-nums;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm, 0.85rem);
}
</style>
