<script setup lang="ts">
import { computed, inject, ref } from 'vue';
import { Glyphs } from '@scoregrove/engraving/Glyphs';
import type { LaidOutChord } from '@scoregrove/engraving/LayoutTree';
import { StaffPosition } from '@scoregrove/engraving/StaffPosition';
import AugmentationDots from './AugmentationDots.vue';
import GlyphView from './GlyphView.vue';
import GraceNoteView from './GraceNoteView.vue';
import LedgerLines from './LedgerLines.vue';
import { addressKey, playingAddressesKey } from './playbackHighlight';
import StemView from './StemView.vue';

/**
 * One laid-out chord: every tone's notehead at its own x (seconds sit across
 * the stem), per-tone accidentals and dots, one stem, an optional flag, and
 * ledger lines wide enough for the whole cluster.
 */
const props = defineProps<{ chord: LaidOutChord }>();

const headWidth = computed(() => Glyphs.width(props.chord.notehead));

const clusterLeft = computed(() => Math.min(...props.chord.tones.map((tone) => tone.x)));
const clusterWidth = computed(
  () => Math.max(...props.chord.tones.map((tone) => tone.x)) + headWidth.value - clusterLeft.value,
);

const playing = inject(playingAddressesKey, ref<ReadonlySet<string>>(new Set()));
const isPlaying = computed(() => playing.value.has(addressKey(props.chord.address)));
</script>

<template>
  <g
    :class="{ 'is-playing': isPlaying }"
    :data-measure="props.chord.address.measure"
    :data-staff="props.chord.address.staff"
    :data-voice="props.chord.address.voice"
    :data-element="props.chord.address.element"
  >
    <GraceNoteView
      v-for="(grace, index) in props.chord.graces ?? []"
      :key="`grace-${index}`"
      :grace="grace"
    />
    <LedgerLines
      v-if="props.chord.ledgers.length"
      :x="clusterLeft"
      :positions="props.chord.ledgers"
      :head-width="clusterWidth"
    />
    <template v-for="tone in props.chord.tones" :key="tone.tone">
      <GlyphView
        v-if="tone.accidental"
        :glyph="tone.accidental.glyph"
        :x="tone.accidental.x"
        :y="tone.accidental.y"
      />
      <GlyphView :glyph="props.chord.notehead" :x="tone.x" :y="StaffPosition.y(tone.position)" />
      <AugmentationDots v-if="tone.dots" :dots="tone.dots" />
    </template>
    <StemView v-if="props.chord.stem" :stem="props.chord.stem" />
    <GlyphView
      v-if="props.chord.flag"
      :glyph="props.chord.flag.glyph"
      :x="props.chord.flag.x"
      :y="props.chord.flag.y"
    />
    <GlyphView
      v-for="(mark, index) in props.chord.articulations ?? []"
      :key="`artic-${index}`"
      :glyph="mark.glyph"
      :x="mark.x"
      :y="mark.y"
    />
    <GlyphView
      v-if="props.chord.fermata"
      :glyph="props.chord.fermata.glyph"
      :x="props.chord.fermata.x"
      :y="props.chord.fermata.y"
    />
  </g>
</template>

<style scoped>
/* The sounding chord during playback: tint its glyphs (they use currentColor). */
.is-playing {
  color: var(--color-accent);
}
</style>
