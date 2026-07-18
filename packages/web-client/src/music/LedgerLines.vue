<script setup lang="ts">
import { computed } from 'vue';
import { engravingDefaults } from '@scoregrove/engraving/Bravura';
import { Glyphs } from '@scoregrove/engraving/Glyphs';
import { StaffPosition } from '@scoregrove/engraving/StaffPosition';

const props = withDefaults(
  defineProps<{
    /** The left edge of the notehead the lines serve */
    x: number;
    positions: readonly StaffPosition[];
    /** The notehead's width; ledger lines extend a little past each side */
    headWidth?: number;
  }>(),
  { headWidth: () => Glyphs.width('noteheadBlack') },
);

const extension = engravingDefaults.legerLineExtension;
const thickness = engravingDefaults.legerLineThickness;

const lines = computed(() =>
  props.positions.map((position) => ({
    position,
    y: StaffPosition.y(position),
  })),
);
</script>

<template>
  <g>
    <line
      v-for="line in lines"
      :key="line.position"
      :x1="props.x - extension"
      :y1="line.y"
      :x2="props.x + props.headWidth + extension"
      :y2="line.y"
      stroke="currentColor"
      :stroke-width="thickness"
    />
  </g>
</template>
