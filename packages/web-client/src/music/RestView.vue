<script setup lang="ts">
import type { LaidOutRest } from '@scoregrove/engraving/LayoutTree';
import AugmentationDots from './AugmentationDots.vue';
import GlyphView from './GlyphView.vue';

/**
 * One laid-out rest with its optional augmentation dots and fermata.
 */
const props = defineProps<{ rest: LaidOutRest }>();
</script>

<template>
  <g
    :data-measure="props.rest.address.measure"
    :data-staff="props.rest.address.staff"
    :data-voice="props.rest.address.voice"
    :data-element="props.rest.address.element"
  >
    <GlyphView :glyph="props.rest.glyph" :x="props.rest.x" :y="props.rest.y" />
    <AugmentationDots v-if="props.rest.dots" :dots="props.rest.dots" />
    <GlyphView
      v-if="props.rest.fermata"
      :glyph="props.rest.fermata.glyph"
      :x="props.rest.fermata.x"
      :y="props.rest.fermata.y"
    />
  </g>
</template>
