<script setup lang="ts">
import { computed } from 'vue';
import type { GlyphName } from '@scoregrove/engraving/Bravura';
import { Glyphs } from '@scoregrove/engraving/Glyphs';

const props = withDefaults(defineProps<{ glyph: GlyphName; x?: number; y?: number }>(), {
  x: 0,
  y: 0,
});

const char = computed(() => Glyphs.char(props.glyph));
</script>

<template>
  <text :x="props.x" :y="props.y" class="smufl">{{ char }}</text>
</template>
