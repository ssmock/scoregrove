<script setup lang="ts">
import { computed } from 'vue';
import { NavigationJump, NavigationMark } from '@scoregrove/domain/Navigation';
import { Glyphs } from '@scoregrove/engraving/Glyphs';
import GlyphView from './GlyphView.vue';

/**
 * A navigation landmark or instruction: segno and coda print as signs, Fine
 * and the jumps as text.
 */
const props = withDefaults(
  defineProps<{ mark?: NavigationMark; jump?: NavigationJump; x?: number; y?: number }>(),
  { mark: undefined, jump: undefined, x: 0, y: 0 },
);

const jumpTexts: Record<NavigationJump, string> = {
  DaCapo: 'D.C.',
  DaCapoAlFine: 'D.C. al Fine',
  DaCapoAlCoda: 'D.C. al Coda',
  DalSegno: 'D.S.',
  DalSegnoAlFine: 'D.S. al Fine',
  DalSegnoAlCoda: 'D.S. al Coda',
  ToCoda: 'To Coda',
};

const glyph = computed(() => (props.mark ? Glyphs.forNavigationMark(props.mark) : undefined));

const text = computed(() => {
  if (props.jump) return jumpTexts[props.jump];
  if (props.mark === NavigationMark.Fine) return 'Fine';

  return undefined;
});
</script>

<template>
  <g>
    <GlyphView v-if="glyph" :glyph="glyph" :x="props.x" :y="props.y" />
    <text v-if="text" :x="props.x" :y="props.y" class="music-text" font-size="1.8">
      {{ text }}
    </text>
  </g>
</template>
