<script setup lang="ts">
import { engravingDefaults } from '@scoregrove/engraving/Bravura';
import type { LaidOutStem } from '@scoregrove/engraving/LayoutTree';

defineProps<{ stem: LaidOutStem }>();

const thickness = engravingDefaults.stemThickness;
</script>

<template>
  <line
    :x1="stem.x"
    :y1="stem.top"
    :x2="stem.x"
    :y2="stem.bottom"
    stroke="currentColor"
    :stroke-width="thickness"
  />
</template>
