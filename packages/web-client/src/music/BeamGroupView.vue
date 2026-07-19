<script setup lang="ts">
import { computed } from 'vue';
import type { LaidOutBeam } from '@scoregrove/engraving/LayoutTree';
import { StemDirection } from '@scoregrove/engraving/Stems';

/**
 * The beam quads of one measure. Each beam is the line of its outer edge;
 * thickness extends toward the noteheads, which side depending on the stem
 * direction.
 */
const props = defineProps<{ beams: readonly LaidOutBeam[] }>();

const quads = computed(() =>
  props.beams.map((beam) => {
    const depth = beam.direction === StemDirection.Up ? beam.thickness : -beam.thickness;

    return {
      points: [
        `${beam.x1},${beam.y1}`,
        `${beam.x2},${beam.y2}`,
        `${beam.x2},${beam.y2 + depth}`,
        `${beam.x1},${beam.y1 + depth}`,
      ].join(' '),
    };
  }),
);
</script>

<template>
  <g>
    <polygon
      v-for="(quad, index) in quads"
      :key="index"
      :points="quad.points"
      fill="currentColor"
    />
  </g>
</template>
