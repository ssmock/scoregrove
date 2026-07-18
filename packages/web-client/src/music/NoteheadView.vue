<script setup lang="ts">
import { computed } from 'vue';
import type { NoteValue } from '@scoregrove/domain/Duration';
import { Glyphs } from '@scoregrove/engraving/Glyphs';
import { StaffPosition } from '@scoregrove/engraving/StaffPosition';
import GlyphView from './GlyphView.vue';

const props = withDefaults(
  defineProps<{ noteValue: NoteValue; position?: StaffPosition; x?: number }>(),
  { position: 0, x: 0 },
);

const glyph = computed(() => Glyphs.forNotehead(props.noteValue));
const y = computed(() => StaffPosition.y(props.position));
</script>

<template>
  <GlyphView :glyph="glyph" :x="props.x" :y="y" />
</template>
