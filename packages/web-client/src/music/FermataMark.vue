<script setup lang="ts">
import { computed } from 'vue';
import { Glyphs } from '@scoregrove/engraving/Glyphs';
import GlyphView from './GlyphView.vue';

const props = withDefaults(
  defineProps<{ placement?: 'above' | 'below'; x?: number; y?: number }>(),
  { placement: 'above', x: 0, y: 0 },
);

const glyph = computed(() => Glyphs.forFermata(props.placement));
</script>

<template>
  <GlyphView :glyph="glyph" :x="props.x" :y="props.y" />
</template>
