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
    /** Show a clickable playback handle at each bar's opening barline */
    barHandles?: boolean;
    /** The system holding the piece's final barline — it gets the extra end-of-piece handle */
    isLastSystem?: boolean;
    /**
     * Barline indices bounding the loop passage: index i is the barline before
     * measure i (so the passage runs from `loopStart` up to, not through,
     * `loopEnd`). The final barline is index `measureCount`.
     */
    loopStart?: number | null;
    loopEnd?: number | null;
  }>(),
  {
    scale: 10,
    labels: () => [],
    barHandles: false,
    isLastSystem: false,
    loopStart: null,
    loopEnd: null,
  },
);

const emit = defineEmits<{
  hover: [{ x: number; y: number }];
  leave: [];
  activate: [{ x: number; y: number }];
  contextmenu: [{ x: number; y: number; clientX: number; clientY: number }];
  barclick: [{ measureIndex: number; clientX: number; clientY: number }];
  barcontextmenu: [{ measureIndex: number; clientX: number; clientY: number }];
}>();

// A tiny tick resting on top of the top staff line at each barline (the top
// line is at y = 0, so the tick's bottom sits there). ~3px wide at the default
// scale; small on purpose.
const handleWidth = 0.3;
const handleHeight = 1.2;
const handleY = -handleHeight;

// The loop passage rides a thin strip just above the staff, clear of the notes.
const bandY = -1.9;
const bandHeight = 0.7;

/** The end-of-piece barline handle, on the last system only (index = one past the last measure) */
const finalHandle = computed(() => {
  const last = props.system.measures.at(-1);

  return last ? { index: last.index + 1, x: props.system.width } : null;
});

/**
 * The loop passage as one continuous band, from the start barline to the end
 * barline — i.e. over the measures the passage actually contains, *excluding*
 * the measure after the end barline. Only when both bounds are set and part of
 * the passage falls in this system.
 */
const loopBand = computed(() => {
  if (props.loopStart === null || props.loopEnd === null) return null;

  const lo = Math.min(props.loopStart, props.loopEnd);
  const hi = Math.max(props.loopStart, props.loopEnd);
  const inRange = props.system.measures.filter((entry) => entry.index >= lo && entry.index < hi);

  if (!inRange.length) return null;

  const first = inRange[0];
  const last = inRange[inRange.length - 1];

  return { x: first.x, width: last.x + (last.staves[0]?.width ?? 0) - first.x };
});

function onBarClick(measureIndex: number, event: MouseEvent): void {
  emit('barclick', { measureIndex, clientX: event.clientX, clientY: event.clientY });
}

function onBarContextmenu(measureIndex: number, event: MouseEvent): void {
  emit('barcontextmenu', { measureIndex, clientX: event.clientX, clientY: event.clientY });
}

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
    class="system-view"
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
      Playback bar handles: a small clickable tab above each measure's opening
      edge, with the loop passage drawn as one continuous band over the bars
      between its bounds. Left-click seeks; right-click opens the loop/seek
      flyout. Stops propagation so a handle never doubles as a note click.
    -->
    <g v-if="props.barHandles" class="bar-handles">
      <rect
        v-if="loopBand"
        class="loop-band"
        :x="loopBand.x"
        :y="bandY"
        :width="loopBand.width"
        :height="bandHeight"
        rx="0.2"
      />
      <rect
        v-for="entry in props.system.measures"
        :key="`bar-${entry.index}`"
        class="bar-handle"
        :class="{
          'bar-handle--loop': entry.index === props.loopStart || entry.index === props.loopEnd,
        }"
        :x="entry.x - handleWidth / 2"
        :y="handleY"
        :width="handleWidth"
        :height="handleHeight"
        @click.stop="onBarClick(entry.index, $event)"
        @contextmenu.stop.prevent="onBarContextmenu(entry.index, $event)"
      />
      <rect
        v-if="props.isLastSystem && finalHandle"
        class="bar-handle"
        :class="{
          'bar-handle--loop':
            finalHandle.index === props.loopStart || finalHandle.index === props.loopEnd,
        }"
        :x="finalHandle.x - handleWidth / 2"
        :y="handleY"
        :width="handleWidth"
        :height="handleHeight"
        @click.stop="onBarClick(finalHandle.index, $event)"
        @contextmenu.stop.prevent="onBarContextmenu(finalHandle.index, $event)"
      />
    </g>

    <!--
      System-space overlay for interactive callers (hover highlight, ghost
      preview) — unused, and so invisible, when nobody provides it.
    -->
    <slot name="overlay" />
  </svg>
</template>

<style scoped>
/*
 * `width`/`height` above are set from the last on-screen measurement
 * (`ScoreView`'s ResizeObserver), which doesn't reliably re-fire for the
 * print rendering pass — a printed page can end up narrower than that
 * frozen pixel width, clipping the right edge of every system. `max-width`
 * (never `width`, which would also stretch a shorter, intentionally-ragged
 * last system to fill its container) lets each system shrink to fit
 * whatever it's actually rendered into, on screen or on paper, without
 * ever growing past its laid-out size; `height: auto` keeps the aspect
 * ratio the `viewBox` already implies.
 *
 * `overflow: visible` overrides the root `<svg>`'s default clip-to-viewBox:
 * a justified system's closing barline is anchored at exactly `x =
 * measure.width`, i.e. exactly the viewBox's own right edge (`MeasureView`'s
 * `<BarlineView :x="props.measure.width" />`), with zero margin to spare —
 * print's higher-precision rasterization was clipping that barline (and
 * whatever lands at the very edge) rather than just anti-aliasing it, since
 * a stroke centered/ending exactly on a clip boundary is one rounding error
 * away from falling on the wrong side of it.
 */
svg {
  display: block;
  max-width: 100%;
  height: auto;
  overflow: visible;
}

.bar-handle {
  fill: var(--color-accent);
  opacity: 0.07; /* very faint until hovered */
  cursor: pointer;
  transition: opacity var(--duration-fast, 120ms) var(--easing-standard, ease);
}

.bar-handle:hover {
  opacity: 0.7;
}

/* A bar set as a loop bound stays visible */
.bar-handle--loop {
  opacity: 0.7;
}

/* The continuous loop passage spanning the bars between the bounds */
.loop-band {
  fill: var(--color-accent);
  opacity: 0.16;
  pointer-events: none;
}
</style>
