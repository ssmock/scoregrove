<script setup lang="ts">
import type { LaidOutGlyph } from '@scoregrove/engraving/LayoutTree';
import GlyphView from './GlyphView.vue';

defineProps<{ dots: readonly LaidOutGlyph[] }>();
</script>

<template>
  <g>
    <GlyphView v-for="(dot, index) in dots" :key="index" :glyph="dot.glyph" :x="dot.x" :y="dot.y" />
  </g>
</template>
