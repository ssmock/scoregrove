<script setup lang="ts">
import { computed } from 'vue';
import type { LaidOutNote } from '@scoregrove/engraving/LayoutTree';
import { StaffPosition } from '@scoregrove/engraving/StaffPosition';
import AugmentationDots from './AugmentationDots.vue';
import GlyphView from './GlyphView.vue';
import LedgerLines from './LedgerLines.vue';
import StemView from './StemView.vue';

/**
 * One laid-out note: notehead, and whichever of accidental, dots, stem, flag,
 * and ledger lines the layout gave it. Dumb by design — every coordinate
 * comes from the engraving pipeline.
 */
const props = defineProps<{ note: LaidOutNote }>();

const y = computed(() => StaffPosition.y(props.note.position));
</script>

<template>
  <g
    :data-measure="props.note.address.measure"
    :data-staff="props.note.address.staff"
    :data-voice="props.note.address.voice"
    :data-element="props.note.address.element"
  >
    <LedgerLines
      v-if="props.note.ledgers.length"
      :x="props.note.x"
      :positions="props.note.ledgers"
    />
    <GlyphView
      v-if="props.note.accidental"
      :glyph="props.note.accidental.glyph"
      :x="props.note.accidental.x"
      :y="props.note.accidental.y"
    />
    <GlyphView :glyph="props.note.notehead" :x="props.note.x" :y="y" />
    <AugmentationDots v-if="props.note.dots" :dots="props.note.dots" />
    <StemView v-if="props.note.stem" :stem="props.note.stem" />
    <GlyphView
      v-if="props.note.flag"
      :glyph="props.note.flag.glyph"
      :x="props.note.flag.x"
      :y="props.note.flag.y"
    />
  </g>
</template>
