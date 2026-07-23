<script setup lang="ts">
import { computed } from 'vue';
import AppButton from '../ui/AppButton.vue';
import AppFlyout from '../ui/AppFlyout.vue';
import { useEditorStore } from '../store/useEditorStore';

/**
 * The right-click menu on a bar's playback handle: seek to the bar (the same
 * as a left-click), and set or remove this bar as the loop passage's start or
 * end. The loop items toggle — their label flips to "Remove" when this bar is
 * already that bound.
 */
const props = defineProps<{
  open: boolean;
  at: { x: number; y: number } | null;
  measure: number | null;
}>();

const emit = defineEmits<{ close: [] }>();

const store = useEditorStore();

const isLoopStart = computed(() => store.state.playback.loopStartMeasure === props.measure);
const isLoopEnd = computed(() => store.state.playback.loopEndMeasure === props.measure);

function seek(): void {
  if (props.measure !== null) store.seekToMeasure(props.measure);
  emit('close');
}

function toggleStart(): void {
  if (props.measure !== null) store.toggleLoopStart(props.measure);
  emit('close');
}

function toggleEnd(): void {
  if (props.measure !== null) store.toggleLoopEnd(props.measure);
  emit('close');
}
</script>

<template>
  <AppFlyout :open="open && measure !== null" :at="at" @close="emit('close')">
    <div class="bar-menu" role="menu">
      <AppButton variant="quiet" @click="seek">Seek here</AppButton>
      <AppButton variant="quiet" @click="toggleStart">
        {{ isLoopStart ? 'Remove loop start' : 'Set loop start' }}
      </AppButton>
      <AppButton variant="quiet" @click="toggleEnd">
        {{ isLoopEnd ? 'Remove loop end' : 'Set loop end' }}
      </AppButton>
    </div>
  </AppFlyout>
</template>

<style scoped>
.bar-menu {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
</style>
