<script setup lang="ts">
import { computed } from 'vue';
import type { DynamicMark } from '@scoregrove/domain/Dynamic';
import { Glyphs } from '@scoregrove/engraving/Glyphs';
import GlyphView from './GlyphView.vue';

const props = withDefaults(defineProps<{ dynamic: DynamicMark; x?: number; y?: number }>(), {
  x: 0,
  y: 0,
});

const glyph = computed(() => Glyphs.forDynamicMark(props.dynamic));
</script>

<template>
  <GlyphView :glyph="glyph" :x="props.x" :y="props.y" />
</template>
