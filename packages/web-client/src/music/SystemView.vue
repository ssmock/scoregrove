<script setup lang="ts">
import { computed } from 'vue';
import type { LaidOutSystem } from '@scoregrove/engraving/LayoutTree';
import HairpinView from './HairpinView.vue';
import MeasureView from './MeasureView.vue';
import SlurArc from './SlurArc.vue';
import StaffLabel from './StaffLabel.vue';
import StaffLines from './StaffLines.vue';
import TieArc from './TieArc.vue';
import VoltaBracket from './VoltaBracket.vue';

/**
 * One system as its own SVG, per the rendering strategy: a row of staff
 * lines for every staff, each measure's per-staff slices at their shared x
 * offsets, and the system's spanners inside their staff rows. `labels`
 * prints staff names in a left margin — the first system of a score passes
 * them. The viewBox is in staff spaces; `scale` turns one staff space into
 * screen pixels.
 */
const props = withDefaults(
  defineProps<{
    system: LaidOutSystem;
    scale?: number;
    labels?: readonly (string | undefined)[];
  }>(),
  { scale: 10, labels: () => [] },
);

/** The left margin reserved when any staff prints a label */
const labelMargin = computed(() => (props.labels.some((label) => label) ? 8 : 0));

/** The vertical bounds come measured from the layout — no guessed margins */
const height = computed(() => props.system.bottom - props.system.top);
const viewBox = computed(
  () =>
    `${-labelMargin.value} ${props.system.top} ${props.system.width + labelMargin.value} ${height.value}`,
);
</script>

<template>
  <svg
    :viewBox="viewBox"
    :width="(props.system.width + labelMargin) * props.scale"
    :height="height * props.scale"
    role="img"
    aria-label="Music notation system"
  >
    <g
      v-for="(staffY, staffIndex) in props.system.staffYs"
      :key="staffIndex"
      :transform="`translate(0, ${staffY})`"
    >
      <StaffLines :width="props.system.width" />
      <StaffLabel v-if="props.labels[staffIndex]" :label="props.labels[staffIndex]!" />
      <g
        v-for="(entry, measureIndex) in props.system.measures"
        :key="measureIndex"
        :transform="`translate(${entry.x}, 0)`"
      >
        <MeasureView v-if="entry.staves[staffIndex]" :measure="entry.staves[staffIndex]" />
      </g>
      <template v-for="(tie, tieIndex) in props.system.ties">
        <TieArc v-if="tie.staff === staffIndex" :key="`tie-${tieIndex}`" :tie="tie" />
      </template>
      <template v-for="(slur, slurIndex) in props.system.slurs">
        <SlurArc v-if="slur.staff === staffIndex" :key="`slur-${slurIndex}`" :slur="slur" />
      </template>
      <template v-for="(hairpin, hairpinIndex) in props.system.hairpins">
        <HairpinView
          v-if="hairpin.staff === staffIndex"
          :key="`hairpin-${hairpinIndex}`"
          :hairpin="hairpin"
        />
      </template>
      <template v-if="staffIndex === 0">
        <VoltaBracket
          v-for="(volta, voltaIndex) in props.system.voltas"
          :key="`volta-${voltaIndex}`"
          :volta="volta"
        />
      </template>
    </g>
  </svg>
</template>
