<script setup lang="ts">
import { computed } from 'vue';
import { engravingDefaults } from '@scoregrove/engraving/Bravura';
import type { LaidOutVolta } from '@scoregrove/engraving/LayoutTree';

/**
 * One volta bracket segment: the horizontal line, down-hooks at closed ends,
 * and the passage label tucked inside the opening corner.
 */
const props = defineProps<{ volta: LaidOutVolta }>();

const thickness = engravingDefaults.repeatEndingLineThickness;
const hookDepth = 1.5;

const points = computed(() => {
  const { x1, x2, y, hookStart, hookEnd } = props.volta;
  const path: string[] = [];

  if (hookStart) path.push(`${x1},${y + hookDepth}`);
  path.push(`${x1},${y}`, `${x2},${y}`);
  if (hookEnd) path.push(`${x2},${y + hookDepth}`);

  return path.join(' ');
});
</script>

<template>
  <g>
    <polyline :points="points" fill="none" stroke="currentColor" :stroke-width="thickness" />
    <text
      v-if="props.volta.label"
      :x="props.volta.x1 + 0.6"
      :y="props.volta.y + 1.4"
      class="music-text"
      font-size="1.6"
    >
      {{ props.volta.label }}
    </text>
  </g>
</template>
