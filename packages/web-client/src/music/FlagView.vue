<script setup lang="ts">
import { computed } from 'vue';
import type { NoteValue } from '@scoregrove/domain/Duration';
import { Glyphs } from '@scoregrove/engraving/Glyphs';
import type { StemDirection } from '@scoregrove/engraving/Stems';
import GlyphView from './GlyphView.vue';

const props = withDefaults(
  defineProps<{ noteValue: NoteValue; direction: StemDirection; x?: number; y?: number }>(),
  { x: 0, y: 0 },
);

const glyph = computed(() => Glyphs.forFlag(props.noteValue, props.direction));
</script>

<template>
  <GlyphView v-if="glyph" :glyph="glyph" :x="props.x" :y="props.y" />
</template>
