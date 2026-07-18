<script setup lang="ts">
import { computed } from 'vue';
import type { Accidental } from '@scoregrove/domain/Pitch';
import { Glyphs } from '@scoregrove/engraving/Glyphs';
import { StaffPosition } from '@scoregrove/engraving/StaffPosition';
import GlyphView from './GlyphView.vue';

const props = withDefaults(
  defineProps<{ accidental: Accidental; position?: StaffPosition; x?: number }>(),
  { position: 0, x: 0 },
);

const glyph = computed(() => Glyphs.forAccidental(props.accidental));
const y = computed(() => StaffPosition.y(props.position));
</script>

<template>
  <GlyphView :glyph="glyph" :x="props.x" :y="y" />
</template>
