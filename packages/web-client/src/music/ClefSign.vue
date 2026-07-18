<script setup lang="ts">
import { computed } from 'vue';
import type { Clef } from '@scoregrove/domain/Clef';
import { Signatures } from '@scoregrove/engraving/Signatures';
import GlyphView from './GlyphView.vue';

const props = withDefaults(defineProps<{ clef: Clef; x?: number }>(), { x: 0 });

const run = computed(() => Signatures.clef(props.clef));
</script>

<template>
  <g>
    <GlyphView
      v-for="laid in run.glyphs"
      :key="laid.glyph"
      :glyph="laid.glyph"
      :x="props.x + laid.x"
      :y="laid.y"
    />
  </g>
</template>
