<script setup lang="ts">
import { computed, ref } from 'vue';
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
 *
 * Pointer events are opt-in: nobody listens in read-only usage (the
 * performance view, Storybook), and emitting `hover`/`leave`/`activate` in
 * system-space coordinates costs nothing when unused. This is the only
 * place that knows the viewBox/scale math, so it's also the natural place
 * to do the pixel-to-staff-space conversion — the interactive staff (in
 * web-client's shell) resolves the coordinates into a `StaffHit` and
 * decides what they mean; this component stays ignorant of scores and
 * editing entirely.
 */
const props = withDefaults(
  defineProps<{
    system: LaidOutSystem;
    scale?: number;
    labels?: readonly (string | undefined)[];
  }>(),
  { scale: 10, labels: () => [] },
);

const emit = defineEmits<{
  hover: [{ x: number; y: number }];
  leave: [];
  activate: [{ x: number; y: number }];
  contextmenu: [{ x: number; y: number; clientX: number; clientY: number }];
}>();

/** The left margin reserved when any staff prints a label */
const labelMargin = computed(() => (props.labels.some((label) => label) ? 8 : 0));

/** The vertical bounds come measured from the layout — no guessed margins */
const height = computed(() => props.system.bottom - props.system.top);
const viewBox = computed(
  () =>
    `${-labelMargin.value} ${props.system.top} ${props.system.width + labelMargin.value} ${height.value}`,
);

const svg = ref<SVGSVGElement | null>(null);

defineExpose({ rootEl: svg });

/**
 * Converts a pointer event's client coordinates into this system's own
 * staff-space (viewBox) coordinates, using the rendered/viewBox size ratio
 * rather than assuming `scale` matches 1:1 — robust to any CSS resizing.
 */
function toStaffSpace(event: { clientX: number; clientY: number }): { x: number; y: number } {
  const rect = svg.value!.getBoundingClientRect();
  const pxPerUnitX = rect.width / (props.system.width + labelMargin.value);
  const pxPerUnitY = rect.height / height.value;

  return {
    x: (event.clientX - rect.left) / pxPerUnitX - labelMargin.value,
    y: (event.clientY - rect.top) / pxPerUnitY + props.system.top,
  };
}

function onPointerMove(event: PointerEvent): void {
  emit('hover', toStaffSpace(event));
}

function onPointerLeave(): void {
  emit('leave');
}

function onClick(event: MouseEvent): void {
  emit('activate', toStaffSpace(event));
}

function onContextmenu(event: MouseEvent): void {
  event.preventDefault();
  emit('contextmenu', { ...toStaffSpace(event), clientX: event.clientX, clientY: event.clientY });
}
</script>

<template>
  <svg
    ref="svg"
    :viewBox="viewBox"
    :width="(props.system.width + labelMargin) * props.scale"
    :height="height * props.scale"
    role="img"
    aria-label="Music notation system"
    @pointermove="onPointerMove"
    @pointerleave="onPointerLeave"
    @click="onClick"
    @contextmenu="onContextmenu"
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
    <!--
      System-space overlay for interactive callers (hover highlight, ghost
      preview) — unused, and so invisible, when nobody provides it.
    -->
    <slot name="overlay" />
  </svg>
</template>
