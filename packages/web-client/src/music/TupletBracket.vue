<script setup lang="ts">
import { computed } from 'vue';
import { engravingDefaults } from '@scoregrove/engraving/Bravura';
import type { LaidOutTuplet } from '@scoregrove/engraving/LayoutTree';

/**
 * One tuplet marking: the count, centered in a gap in the hooked bracket —
 * or the bare count when the run hangs from a single beam.
 */
const props = defineProps<{ tuplet: LaidOutTuplet }>();

const thickness = engravingDefaults.tupletBracketThickness;
const hookDepth = 0.8;
const labelGap = 1.2;

const center = computed(() => (props.tuplet.x1 + props.tuplet.x2) / 2);

const leftPoints = computed(() => {
  const { x1, y } = props.tuplet;

  return `${x1},${y + hookDepth} ${x1},${y} ${center.value - labelGap},${y}`;
});

const rightPoints = computed(() => {
  const { x2, y } = props.tuplet;

  return `${center.value + labelGap},${y} ${x2},${y} ${x2},${y + hookDepth}`;
});
</script>

<template>
  <g>
    <template v-if="props.tuplet.bracket">
      <polyline :points="leftPoints" fill="none" stroke="currentColor" :stroke-width="thickness" />
      <polyline :points="rightPoints" fill="none" stroke="currentColor" :stroke-width="thickness" />
    </template>
    <text
      :x="center"
      :y="props.tuplet.y + 0.55"
      class="music-text"
      font-size="1.6"
      font-style="italic"
      text-anchor="middle"
    >
      {{ props.tuplet.label }}
    </text>
  </g>
</template>
