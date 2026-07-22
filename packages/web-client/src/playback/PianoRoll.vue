<script setup lang="ts">
import { computed } from 'vue';
import type { Performance } from '@scoregrove/playback/Compiler';

/**
 * A silent visualisation of a compiled `Performance`: every note event as a
 * bar on a time (x, seconds) × pitch (y, semitones) grid, opacity tracking
 * velocity. Not a player — a way to *see* the pure compiler output, and the
 * visual regression surface for the whole pipeline (unfolded order, tempo,
 * ties, dynamics all show up here).
 */
const props = defineProps<{ performance: Performance }>();

const pxPerSecond = 80;
const rowHeight = 12;
const pad = { top: 8, left: 40, right: 12, bottom: 20 };

const pitchNumbers = computed(() => props.performance.events.map((event) => event.pitchNumber));
const minPitch = computed(() => (pitchNumbers.value.length ? Math.min(...pitchNumbers.value) : 60));
const maxPitch = computed(() => (pitchNumbers.value.length ? Math.max(...pitchNumbers.value) : 72));
const rows = computed(() => maxPitch.value - minPitch.value + 1);

const width = computed(
  () => pad.left + props.performance.durationSeconds * pxPerSecond + pad.right,
);
const height = computed(() => pad.top + rows.value * rowHeight + pad.bottom);
const gridBottom = computed(() => height.value - pad.bottom);

const rowY = (pitch: number): number => pad.top + (maxPitch.value - pitch) * rowHeight;
const timeX = (seconds: number): number => pad.left + seconds * pxPerSecond;

const noteNames = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const label = (midi: number): string => `${noteNames[midi % 12]}${Math.floor(midi / 12) - 1}`;

/** Whole-second gridlines and labels across the piece */
const seconds = computed(() =>
  Array.from({ length: Math.ceil(props.performance.durationSeconds) + 1 }, (_unused, i) => i),
);

/** Rows to label and rule: every C, plus the extremes */
const guideRows = computed(() => {
  const result: number[] = [];

  for (let pitch = minPitch.value; pitch <= maxPitch.value; pitch += 1) {
    if (pitch % 12 === 0 || pitch === minPitch.value || pitch === maxPitch.value) {
      result.push(pitch);
    }
  }

  return result;
});
</script>

<template>
  <svg
    :viewBox="`0 0 ${width} ${height}`"
    :width="width"
    :height="height"
    class="piano-roll"
    role="img"
    aria-label="Performance piano roll"
  >
    <g v-for="pitch in guideRows" :key="`row-${pitch}`">
      <line
        :x1="pad.left"
        :y1="rowY(pitch)"
        :x2="width - pad.right"
        :y2="rowY(pitch)"
        class="grid"
      />
      <text :x="pad.left - 4" :y="rowY(pitch) + rowHeight - 3" class="axis" text-anchor="end">
        {{ label(pitch) }}
      </text>
    </g>

    <g v-for="second in seconds" :key="`sec-${second}`">
      <line :x1="timeX(second)" :y1="pad.top" :x2="timeX(second)" :y2="gridBottom" class="grid" />
      <text :x="timeX(second)" :y="height - 6" class="axis" text-anchor="middle">
        {{ second }}s
      </text>
    </g>

    <rect
      v-for="(event, index) in performance.events"
      :key="index"
      :x="timeX(event.startSeconds)"
      :y="rowY(event.pitchNumber) + 1"
      :width="Math.max(1.5, event.durationSeconds * pxPerSecond - 1)"
      :height="rowHeight - 2"
      :fill-opacity="0.35 + 0.6 * event.velocity"
      rx="2"
      class="note"
    />
  </svg>
</template>

<style scoped>
.piano-roll {
  display: block;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md, 6px);
}

.grid {
  stroke: var(--color-border);
  stroke-width: 0.5;
}

.axis {
  fill: var(--color-text-muted);
  font-size: 9px;
  font-family: var(--font-ui);
}

.note {
  fill: var(--color-accent);
}
</style>
