<script setup lang="ts">
import { engravingDefaults } from '@scoregrove/engraving/Bravura';
import type { LaidOutHairpin } from '@scoregrove/engraving/LayoutTree';

/**
 * One hairpin wedge segment: two lines diverging (crescendo) or converging
 * (diminuendo) around the dynamic baseline.
 */
defineProps<{ hairpin: LaidOutHairpin }>();

const thickness = engravingDefaults.hairpinThickness;
</script>

<template>
  <g>
    <line
      :x1="hairpin.x1"
      :y1="hairpin.y - hairpin.leftGap / 2"
      :x2="hairpin.x2"
      :y2="hairpin.y - hairpin.rightGap / 2"
      stroke="currentColor"
      :stroke-width="thickness"
    />
    <line
      :x1="hairpin.x1"
      :y1="hairpin.y + hairpin.leftGap / 2"
      :x2="hairpin.x2"
      :y2="hairpin.y + hairpin.rightGap / 2"
      stroke="currentColor"
      :stroke-width="thickness"
    />
  </g>
</template>
