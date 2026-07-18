<script setup lang="ts">
import { computed } from 'vue';
import type { LaidOutSystem } from '@scoregrove/engraving/LayoutTree';
import MeasureView from './MeasureView.vue';
import StaffLines from './StaffLines.vue';

/**
 * One system as its own SVG, per the rendering strategy: staff lines across
 * the full width, then each measure at its x offset. The viewBox is in staff
 * spaces; `scale` turns one staff space into screen pixels.
 */
const props = withDefaults(defineProps<{ system: LaidOutSystem; scale?: number }>(), {
  scale: 10,
});

/** Room above and below the staff for stems, dynamics, and signs */
const marginTop = 6;
const marginBottom = 6;

const height = computed(() => 4 + marginTop + marginBottom);
const viewBox = computed(() => `0 ${-marginTop} ${props.system.width} ${height.value}`);
</script>

<template>
  <svg
    :viewBox="viewBox"
    :width="props.system.width * props.scale"
    :height="height * props.scale"
    role="img"
    aria-label="Music notation system"
  >
    <StaffLines :width="props.system.width" />
    <g
      v-for="(entry, index) in props.system.measures"
      :key="index"
      :transform="`translate(${entry.x}, 0)`"
    >
      <MeasureView :measure="entry.measure" />
    </g>
  </svg>
</template>
