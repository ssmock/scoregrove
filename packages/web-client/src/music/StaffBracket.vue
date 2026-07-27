<script setup lang="ts">
import { computed } from 'vue';
import type { StaffGroupSymbol } from '@scoregrove/domain/Part';
import { engravingDefaults } from '@scoregrove/engraving/Bravura';

/**
 * The sign joining a run of staves at the left edge of a system: a bracket over
 * a section of like instruments (a string quartet), a brace over one player's
 * two staves (a piano), or a plain line.
 *
 * Drawn rather than set from SMuFL. Bravura's `bracketTop`/`bracketBottom` are
 * fixed-size glyphs, but a bracket has to span whatever distance the vertical
 * layout put between the staves — which varies system to system once staff
 * spacing adapts to content. A path scales; a glyph pair would not.
 *
 * `y1` and `y2` are the top line of the first staff and the bottom line of the
 * last, in system coordinates.
 */
const props = defineProps<{ symbol: StaffGroupSymbol; y1: number; y2: number }>();

/** Clear of the systemic barline at x = 0 */
const bracketX = -0.6;
const braceX = -0.4;

/** How far a bracket's wings reach past the staves it encloses */
const wingHeight = 0.5;
const wingWidth = 0.7;

const thickness = computed(() => engravingDefaults.bracketThickness ?? 0.5);

/**
 * A bracket: a thick vertical spine with a wing curling out at each end. The
 * wings are what distinguish it from the plain line at a glance, so they are
 * drawn even though they are small.
 */
const bracketPath = computed(() => {
  const x = bracketX;
  const top = props.y1 - wingHeight;
  const bottom = props.y2 + wingHeight;

  return (
    `M ${x} ${top} C ${x - wingWidth} ${top - wingHeight * 0.6} ${x - wingWidth} ${top} ` +
    `${x - wingWidth} ${top + wingHeight} ` +
    `M ${x} ${bottom} C ${x - wingWidth} ${bottom + wingHeight * 0.6} ${x - wingWidth} ${bottom} ` +
    `${x - wingWidth} ${bottom - wingHeight}`
  );
});

/**
 * A brace, as the pair of tapered curves engraving uses: widest at the middle,
 * meeting at points top and bottom.
 */
const bracePath = computed(() => {
  const x = braceX;
  const { y1, y2 } = props;
  const middle = (y1 + y2) / 2;
  const reach = 0.9;
  const waist = 0.22;

  return (
    `M ${x} ${y1} ` +
    `C ${x - reach} ${y1 + (middle - y1) * 0.35} ${x - waist} ${middle - (middle - y1) * 0.35} ${x - waist * 1.4} ${middle} ` +
    `C ${x - waist} ${middle + (y2 - middle) * 0.35} ${x - reach} ${y2 - (y2 - middle) * 0.35} ${x} ${y2} ` +
    `C ${x - reach * 0.7} ${y2 - (y2 - middle) * 0.4} ${x - waist * 2.4} ${middle + (y2 - middle) * 0.3} ${x - waist * 2.4} ${middle} ` +
    `C ${x - waist * 2.4} ${middle - (middle - y1) * 0.3} ${x - reach * 0.7} ${y1 + (middle - y1) * 0.4} ${x} ${y1} Z`
  );
});
</script>

<template>
  <g class="staff-bracket">
    <template v-if="props.symbol === 'Brace'">
      <path :d="bracePath" fill="currentColor" />
    </template>
    <template v-else>
      <line
        :x1="props.symbol === 'Bracket' ? bracketX : braceX"
        :y1="props.symbol === 'Bracket' ? props.y1 - wingHeight : props.y1"
        :x2="props.symbol === 'Bracket' ? bracketX : braceX"
        :y2="props.symbol === 'Bracket' ? props.y2 + wingHeight : props.y2"
        stroke="currentColor"
        :stroke-width="
          props.symbol === 'Bracket' ? thickness : engravingDefaults.thinBarlineThickness
        "
      />
      <path
        v-if="props.symbol === 'Bracket'"
        :d="bracketPath"
        fill="none"
        stroke="currentColor"
        :stroke-width="thickness * 0.7"
        stroke-linecap="round"
      />
    </template>
  </g>
</template>
