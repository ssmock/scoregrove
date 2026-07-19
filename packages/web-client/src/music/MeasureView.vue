<script setup lang="ts">
import type { LaidOutMeasure } from '@scoregrove/engraving/LayoutTree';
import BarlineView from './BarlineView.vue';
import BeamGroupView from './BeamGroupView.vue';
import ChordView from './ChordView.vue';
import GlyphView from './GlyphView.vue';
import MusicText from './MusicText.vue';
import NoteView from './NoteView.vue';
import RestView from './RestView.vue';
import TupletBracket from './TupletBracket.vue';

/**
 * One staff's slice of one laid-out measure: printed signatures, the voice's
 * elements, and the closing (and any opening) barline. Staff lines are drawn
 * once per system, not per measure.
 */
const props = defineProps<{ measure: LaidOutMeasure }>();
</script>

<template>
  <g>
    <BarlineView v-if="props.measure.opening" :kind="props.measure.opening" :x="0" />
    <GlyphView
      v-for="(laid, index) in props.measure.signatures"
      :key="index"
      :glyph="laid.glyph"
      :x="laid.x"
      :y="laid.y"
    />
    <template v-for="(element, index) in props.measure.elements" :key="index">
      <NoteView v-if="element.kind === 'note'" :note="element" />
      <RestView v-else-if="element.kind === 'rest'" :rest="element" />
      <ChordView v-else-if="element.kind === 'chord'" :chord="element" />
      <GlyphView v-else :glyph="element.glyph" :x="element.x" :y="element.y" />
    </template>
    <BeamGroupView v-if="props.measure.beams.length" :beams="props.measure.beams" />
    <template v-for="(annotation, index) in props.measure.annotations" :key="`a-${index}`">
      <GlyphView
        v-if="annotation.kind === 'glyph'"
        :glyph="annotation.glyph"
        :x="annotation.x"
        :y="annotation.y"
      />
      <MusicText v-else :note="annotation" />
    </template>
    <MusicText
      v-for="(syllable, index) in props.measure.lyrics"
      :key="`lyric-${index}`"
      :note="syllable"
    />
    <TupletBracket
      v-for="(tuplet, index) in props.measure.tuplets"
      :key="`tuplet-${index}`"
      :tuplet="tuplet"
    />
    <BarlineView :kind="props.measure.closing" :x="props.measure.width" />
  </g>
</template>
