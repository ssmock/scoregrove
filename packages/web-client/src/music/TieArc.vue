<script setup lang="ts">
import { computed } from 'vue';
import { engravingDefaults } from '@scoregrove/engraving/Bravura';
import type { LaidOutArc } from '@scoregrove/engraving/LayoutTree';

/**
 * One tie as a filled lens: the laid-out bézier centerline out, and back
 * with the control points pulled toward the endpoints by the extra midpoint
 * thickness. Endpoints stay pointed, the middle swells — the engraved look.
 */
const props = defineProps<{ tie: LaidOutArc }>();

const path = computed(() => {
  const { x1, y1, cx1, cy1, cx2, cy2, x2, y2 } = props.tie;
  const swell = engravingDefaults.tieMidpointThickness - engravingDefaults.tieEndpointThickness;
  const inward = cy1 < y1 ? swell : -swell;

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
    :stroke-width="engravingDefaults.tieEndpointThickness"
  />
</template>
