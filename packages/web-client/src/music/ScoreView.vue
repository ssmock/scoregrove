<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { Score } from '@scoregrove/domain/Score';
import { ScoreLayout } from '@scoregrove/engraving/ScoreLayout';
import ScoreHeader from './ScoreHeader.vue';
import SystemView from './SystemView.vue';
import { canvasTextMeasurer } from './textMeasure';

/**
 * The whole piece: header plus line-broken systems stacked in HTML, per the
 * strategy's HTML/SVG split. Layout is a pure function of the score and the
 * available width; resizing re-runs it. Give `width` (in staff spaces) to
 * pin the layout — otherwise the component observes its own container.
 */
const props = withDefaults(defineProps<{ score: Score; scale?: number; width?: number }>(), {
  scale: 10,
  width: undefined,
});

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
    />
  </div>
</template>

<style scoped>
.score-view {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}
</style>
