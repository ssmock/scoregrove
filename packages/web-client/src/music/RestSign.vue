<script setup lang="ts">
import { computed } from 'vue';
import type { NoteValue } from '@scoregrove/domain/Duration';
import { Glyphs } from '@scoregrove/engraving/Glyphs';
import { MeasureLayout } from '@scoregrove/engraving/MeasureLayout';
import GlyphView from './GlyphView.vue';

const props = withDefaults(defineProps<{ noteValue: NoteValue; x?: number }>(), { x: 0 });

const glyph = computed(() => Glyphs.forRest(props.noteValue));
const y = computed(() => MeasureLayout.restY(props.noteValue));
</script>

<template>
  <GlyphView :glyph="glyph" :x="props.x" :y="y" />
</template>
