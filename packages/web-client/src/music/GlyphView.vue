<script setup lang="ts">
import { computed } from 'vue';
import type { GlyphName } from '@scoregrove/engraving/Bravura';
import { Glyphs } from '@scoregrove/engraving/Glyphs';

/**
 * `scale` shrinks the glyph (grace notes render at 0.6): inline style, since
 * it must win over the .smufl class's font-size.
 */
const props = withDefaults(
  defineProps<{ glyph: GlyphName; x?: number; y?: number; scale?: number }>(),
  { x: 0, y: 0, scale: 1 },
);

const char = computed(() => Glyphs.char(props.glyph));
const style = computed(() =>
  props.scale === 1 ? undefined : { fontSize: `${4 * props.scale}px` },
);
</script>

<template>
  <text :x="props.x" :y="props.y" class="smufl" :style="style">{{ char }}</text>
</template>
