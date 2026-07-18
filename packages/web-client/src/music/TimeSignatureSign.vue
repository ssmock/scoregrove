<script setup lang="ts">
import { computed } from 'vue';
import type { TimeSignature } from '@scoregrove/domain/TimeSignature';
import { Signatures } from '@scoregrove/engraving/Signatures';
import GlyphView from './GlyphView.vue';

const props = withDefaults(defineProps<{ time: TimeSignature; x?: number }>(), { x: 0 });

const run = computed(() => Signatures.time(props.time));
</script>

<template>
  <g>
    <GlyphView
      v-for="(laid, index) in run.glyphs"
      :key="index"
      :glyph="laid.glyph"
      :x="props.x + laid.x"
      :y="laid.y"
    />
  </g>
</template>
