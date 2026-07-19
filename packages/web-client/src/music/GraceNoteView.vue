<script setup lang="ts">
import { computed } from 'vue';
import { engravingDefaults } from '@scoregrove/engraving/Bravura';
import { Glyphs } from '@scoregrove/engraving/Glyphs';
import type { LaidOutGrace } from '@scoregrove/engraving/LayoutTree';
import { StaffPosition } from '@scoregrove/engraving/StaffPosition';
import GlyphView from './GlyphView.vue';
import LedgerLines from './LedgerLines.vue';

/**
 * One miniature grace note: scaled notehead and flag, a short stem, ledger
 * lines sized to the small head, and the acciaccatura's slash.
 */
const props = defineProps<{ grace: LaidOutGrace }>();

const y = computed(() => StaffPosition.y(props.grace.position));
const headWidth = computed(() => Glyphs.width(props.grace.notehead) * props.grace.scale);
</script>

<template>
  <g>
    <LedgerLines
      v-if="props.grace.ledgers.length"
      :x="props.grace.x"
      :positions="props.grace.ledgers"
      :head-width="headWidth"
    />
    <GlyphView :glyph="props.grace.notehead" :x="props.grace.x" :y="y" :scale="props.grace.scale" />
    <line
      :x1="props.grace.stem.x"
      :y1="props.grace.stem.top"
      :x2="props.grace.stem.x"
      :y2="props.grace.stem.bottom"
      stroke="currentColor"
      :stroke-width="engravingDefaults.stemThickness * props.grace.scale"
    />
    <GlyphView
      v-if="props.grace.flag"
      :glyph="props.grace.flag.glyph"
      :x="props.grace.flag.x"
      :y="props.grace.flag.y"
      :scale="props.grace.scale"
    />
    <line
      v-if="props.grace.slash"
      :x1="props.grace.slash.x1"
      :y1="props.grace.slash.y1"
      :x2="props.grace.slash.x2"
      :y2="props.grace.slash.y2"
      stroke="currentColor"
      :stroke-width="engravingDefaults.stemThickness"
    />
  </g>
</template>
