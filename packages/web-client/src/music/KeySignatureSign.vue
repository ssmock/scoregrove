<script setup lang="ts">
import { computed } from 'vue';
import type { Clef } from '@scoregrove/domain/Clef';
import type { KeySignature } from '@scoregrove/domain/KeySignature';
import { Signatures } from '@scoregrove/engraving/Signatures';
import GlyphView from './GlyphView.vue';

const props = withDefaults(defineProps<{ clef: Clef; keySignature: KeySignature; x?: number }>(), {
  x: 0,
});

const run = computed(() => Signatures.key(props.clef, props.keySignature));
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
