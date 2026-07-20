<script setup lang="ts">
import { computed } from 'vue';
import type { GlyphName } from '@scoregrove/engraving/Bravura';
import { Glyphs } from '@scoregrove/engraving/Glyphs';

/**
 * A single SMuFL glyph sized to fit a size×size box — the same Bravura font
 * and metadata the score renderer uses, just centered on its bounding box
 * instead of staff-positioned. Used for pallet tools, recent selections, and
 * the dot/accidental/articulation pickers.
 */
const props = withDefaults(defineProps<{ glyph: GlyphName; size?: number }>(), { size: 24 });

const char = computed(() => Glyphs.char(props.glyph));

/**
 * Bravura metadata is in staff spaces with y increasing upward (SMuFL
 * convention); SVG y increases downward, so the vertical center flips sign.
 * A viewBox centered on the glyph's own bounding box, with a little padding,
 * frames it regardless of how far off-baseline the glyph's box sits.
 */
const viewBox = computed(() => {
  const data = Glyphs.data(props.glyph);
  const width = data.bBoxNE[0] - data.bBoxSW[0];
  const height = data.bBoxNE[1] - data.bBoxSW[1];
  const cx = (data.bBoxNE[0] + data.bBoxSW[0]) / 2;
  const cy = (data.bBoxNE[1] + data.bBoxSW[1]) / 2;
  const span = Math.max(width, height) * 1.15;

  return `${cx - span / 2} ${-cy - span / 2} ${span} ${span}`;
});
</script>

<template>
  <svg :width="size" :height="size" :viewBox="viewBox" class="music-icon" aria-hidden="true">
    <text x="0" y="0" class="smufl">{{ char }}</text>
  </svg>
</template>

<style scoped>
.music-icon {
  display: inline-block;
  overflow: visible;
  color: var(--color-text);
}
</style>
