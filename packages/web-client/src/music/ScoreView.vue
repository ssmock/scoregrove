<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { Score } from '@scoregrove/domain/Score';
import { InteractionGeometry, type StaffHit } from '@scoregrove/editing/InteractionGeometry';
import { ScoreLayout } from '@scoregrove/engraving/ScoreLayout';
import { StaffPosition } from '@scoregrove/engraving/StaffPosition';
import ScoreHeader from './ScoreHeader.vue';
import SystemView from './SystemView.vue';
import { canvasTextMeasurer } from './textMeasure';

/**
 * The whole piece: header plus line-broken systems stacked in HTML, per the
 * strategy's HTML/SVG split. Layout is a pure function of the score and the
 * available width; resizing re-runs it. Give `width` (in staff spaces) to
 * pin the layout — otherwise the component observes its own container.
 *
 * Pointer events from each system are resolved into a `StaffHit` here (this
 * is where `laidOut.systems` and `props.score.measures` — the two things
 * `InteractionGeometry.locate` needs — are both already in scope) and
 * re-emitted up; nothing renders differently because of this, so read-only
 * consumers (the performance view, Storybook) are unaffected by simply not
 * listening. The `overlay` scoped slot forwards through to each system's own
 * overlay, tagged with which system it belongs to, so an interactive caller
 * can draw a hover highlight or placement ghost in the right one.
 */
const props = withDefaults(defineProps<{ score: Score; scale?: number; width?: number }>(), {
  scale: 10,
  width: undefined,
});

/**
 * A hover point ready to render an overlay glyph without the caller needing
 * any layout details of its own: `x` is the raw system-space pointer
 * position (a ghost tracks the cursor horizontally), `y` is snapped to the
 * nearest staff line/space of whichever staff was hit (so a ghost note lines
 * up on a real pitch, not wherever the cursor happens to sit) — both already
 * in the same system-space coordinates the `overlay` slot renders in.
 */
export type HoverPoint = { systemIndex: number; hit: StaffHit | undefined; x: number; y: number };

const emit = defineEmits<{
  hover: [HoverPoint];
  leave: [];
  activate: [{ systemIndex: number; hit: StaffHit }];
  contextmenu: [{ systemIndex: number; hit: StaffHit; clientX: number; clientY: number }];
}>();

const root = ref<HTMLElement | null>(null);
const measuredWidth = ref(80);

let observer: ResizeObserver | undefined;

onMounted(() => {
  if (props.width !== undefined || !root.value) return;

  observer = new ResizeObserver((entries) => {
    const box = entries[0]?.contentRect;

    if (box && box.width > 0) measuredWidth.value = box.width / props.scale;
  });

  observer.observe(root.value);
});

onBeforeUnmount(() => observer?.disconnect());

const targetWidth = computed(() => props.width ?? measuredWidth.value);

const measureText = canvasTextMeasurer();

const laidOut = computed(() =>
  ScoreLayout.layout(props.score, { width: targetWidth.value, measureText }),
);

function resolve(systemIndex: number, point: { x: number; y: number }): StaffHit | undefined {
  const system = laidOut.value.systems[systemIndex];

  if (!system) return undefined;

  return InteractionGeometry.locate({ system, measures: props.score.measures, ...point });
}

function onHover(systemIndex: number, point: { x: number; y: number }): void {
  const hit = resolve(systemIndex, point);
  const system = laidOut.value.systems[systemIndex];
  const y =
    hit && system ? (system.staffYs[hit.staffIndex] ?? 0) + StaffPosition.y(hit.position) : point.y;

  emit('hover', { systemIndex, hit, x: point.x, y });
}

function onActivate(systemIndex: number, point: { x: number; y: number }): void {
  const hit = resolve(systemIndex, point);

  if (hit) emit('activate', { systemIndex, hit });
}

function onContextmenu(
  systemIndex: number,
  point: { x: number; y: number; clientX: number; clientY: number },
): void {
  const hit = resolve(systemIndex, point);

  if (hit)
    emit('contextmenu', { systemIndex, hit, clientX: point.clientX, clientY: point.clientY });
}
</script>

<template>
  <div ref="root" class="score-view">
    <ScoreHeader :title="laidOut.title" :composer="laidOut.composer" />
    <SystemView
      v-for="(system, index) in laidOut.systems"
      :key="index"
      :system="system"
      :scale="props.scale"
      :labels="index === 0 ? laidOut.staffLabels : []"
      @hover="(point) => onHover(index, point)"
      @leave="emit('leave')"
      @activate="(point) => onActivate(index, point)"
      @contextmenu="(point) => onContextmenu(index, point)"
    >
      <template #overlay>
        <slot name="overlay" :system-index="index" />
      </template>
    </SystemView>
  </div>
</template>

<style scoped>
.score-view {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}
</style>
