<script setup lang="ts">
import { computed } from 'vue';
import type { ClosingBarline, OpeningBarline } from '@scoregrove/domain/Barline';
import { engravingDefaults } from '@scoregrove/engraving/Bravura';

/**
 * Any barline the domain can ask for: an opening RepeatOpen or one of the
 * closing forms.
 */
type BarlineKind = OpeningBarline | ClosingBarline;

const props = withDefaults(
  defineProps<{
    kind: BarlineKind;
    /** For closing barlines, the right edge; for RepeatOpen, the left edge */
    x: number;
    top?: number;
    bottom?: number;
  }>(),
  { top: 0, bottom: 4 },
);

const thin = engravingDefaults.thinBarlineThickness;
const thick = engravingDefaults.thickBarlineThickness;
const gap = engravingDefaults.barlineSeparation;
const dotRadius = 0.2;
const dotYs = [1.5, 2.5];

type Line = { x: number; width: number };

/**
 * The vertical lines of each barline form, as offsets from the anchor edge.
 * Closing forms hang left of x, RepeatOpen hangs right.
 */
const lines = computed((): Line[] => {
  switch (props.kind) {
    case 'Regular':
      return [{ x: props.x - thin / 2, width: thin }];
    case 'Double':
      return [
        { x: props.x - thin - gap - thin / 2, width: thin },
        { x: props.x - thin / 2, width: thin },
      ];
    case 'Final':
      return [
        { x: props.x - thick - gap - thin / 2, width: thin },
        { x: props.x - thick / 2, width: thick },
      ];
    case 'RepeatClose':
      return [
        { x: props.x - thick - gap - thin / 2, width: thin },
        { x: props.x - thick / 2, width: thick },
      ];
    case 'RepeatOpen':
      return [
        { x: props.x + thick / 2, width: thick },
        { x: props.x + thick + gap + thin / 2, width: thin },
      ];
    default:
      return [{ x: props.x - thin / 2, width: thin }];
  }
});

const dotX = computed(() => {
  if (props.kind === 'RepeatClose') return props.x - thick - gap - thin - gap - dotRadius;
  if (props.kind === 'RepeatOpen') return props.x + thick + gap + thin + gap + dotRadius;

  return undefined;
});
</script>

<template>
  <g>
    <line
      v-for="line in lines"
      :key="line.x"
      :x1="line.x"
      :y1="props.top"
      :x2="line.x"
      :y2="props.bottom"
      stroke="currentColor"
      :stroke-width="line.width"
    />
    <template v-if="dotX !== undefined">
      <circle v-for="y in dotYs" :key="y" :cx="dotX" :cy="y" :r="dotRadius" fill="currentColor" />
    </template>
  </g>
</template>
