<script setup lang="ts">
import { engravingDefaults } from '@scoregrove/engraving/Bravura';

defineProps<{ width: number }>();

const lineYs = [0, 1, 2, 3, 4];
const thickness = engravingDefaults.staffLineThickness;
</script>

<template>
  <g>
    <line
      v-for="y in lineYs"
      :key="y"
      :x1="0"
      :y1="y"
      :x2="width"
      :y2="y"
      stroke="currentColor"
      :stroke-width="thickness"
    />
  </g>
</template>
