<script setup lang="ts">
import { computed } from 'vue';
import type { Articulation } from '@scoregrove/domain/Notations';
import { Glyphs } from '@scoregrove/engraving/Glyphs';
import GlyphView from './GlyphView.vue';

const props = withDefaults(
  defineProps<{
    articulation: Articulation;
    placement?: 'above' | 'below';
    x?: number;
    y?: number;
  }>(),
  { placement: 'above', x: 0, y: 0 },
);

const glyph = computed(() => Glyphs.forArticulation(props.articulation, props.placement));
</script>

<template>
  <GlyphView :glyph="glyph" :x="props.x" :y="props.y" />
</template>
