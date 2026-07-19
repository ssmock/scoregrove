<script setup lang="ts">
import { computed } from 'vue';
import { engravingDefaults } from '@scoregrove/engraving/Bravura';
import type { LaidOutArc } from '@scoregrove/engraving/LayoutTree';

/**
 * One slur as a filled lens, like TieArc but with the slur's slightly
 * heavier midpoint swell.
 */
const props = defineProps<{ slur: LaidOutArc }>();

const path = computed(() => {
  const { x1, y1, cx1, cy1, cx2, cy2, x2, y2 } = props.slur;
  const swell = engravingDefaults.slurMidpointThickness - engravingDefaults.slurEndpointThickness;
  const inward = cy1 < Math.min(y1, y2) ? swell : -swell;

  return [
    `M ${x1} ${y1}`,
    `C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`,
    `C ${cx2} ${cy2 + inward}, ${cx1} ${cy1 + inward}, ${x1} ${y1}`,
    'Z',
  ].join(' ');
});
</script>

<template>
  <path
    :d="path"
    fill="currentColor"
    stroke="currentColor"
    :stroke-width="engravingDefaults.slurEndpointThickness"
  />
</template>
