<script setup lang="ts">
import { computed } from 'vue';
import type { Fraction } from '@scoregrove/domain/Fraction';
import { Articulation } from '@scoregrove/domain/Notations';
import AppButton from '../ui/AppButton.vue';
import AppFlyout from '../ui/AppFlyout.vue';
import { useEditorStore } from '../store/useEditorStore';

/**
 * The right-click flyout for a placed note: dots, articulations, and
 * removal (TODO-UX's "articulations, dots, accidentals, removal" — an
 * accidental override isn't wired up yet, see TO-VERIFY.md). Identifies the
 * note by `location` + `onset` rather than a fixed address: dot/articulation
 * edits can shift the note's element index (the surrounding rests
 * re-decompose), so every read and dispatch here re-resolves through
 * `store.resolveAddress`, which stays correct across repeated actions in one
 * flyout session without needing to track that shift itself.
 */
const props = defineProps<{
  open: boolean;
  at: { x: number; y: number } | null;
  location: { measure: number; staff: number; voice: number } | null;
  onset: Fraction | null;
}>();

const emit = defineEmits<{ close: [] }>();

const store = useEditorStore();

const articulationChoices: readonly Articulation[] = [
  Articulation.Staccato,
  Articulation.Staccatissimo,
  Articulation.Tenuto,
  Articulation.Accent,
  Articulation.Marcato,
];

const address = computed(() =>
  props.location && props.onset ? store.resolveAddress(props.location, props.onset) : undefined,
);

const note = computed(() => {
  const addr = address.value;

  if (!addr) return undefined;

  const element =
    store.state.score.measures[addr.measure]?.contents[addr.staff]?.voices[addr.voice]?.elements[
      addr.element
    ];

  return element?.kind === 'note' ? element : undefined;
});

function cycleDots(): void {
  if (address.value) store.cycleDots(address.value);
}

function toggleArticulation(articulation: Articulation): void {
  if (address.value) store.toggleArticulation(address.value, articulation);
}

/** Engages tie mode with this note as the pending start — the same state a pallet-tool click into it would set */
function startTie(): void {
  if (address.value) store.startTie(address.value);
  emit('close');
}

function removeTie(): void {
  if (address.value) store.removeTie(address.value);
  emit('close');
}

function remove(): void {
  if (address.value) store.erase(address.value);
  emit('close');
}
</script>

<template>
  <AppFlyout :open="open && !!note" :at="at" @close="emit('close')">
    <div v-if="note" class="element-editor" role="menu">
      <AppButton variant="quiet" @click="cycleDots">
        Dots: {{ note.duration.dots ?? 0 }}
      </AppButton>
      <div class="element-editor__articulations">
        <AppButton
          v-for="articulation in articulationChoices"
          :key="articulation"
          variant="quiet"
          :pressed="!!note.articulations?.includes(articulation)"
          :title="articulation"
          @click="toggleArticulation(articulation)"
        >
          {{ articulation.slice(0, 4) }}
        </AppButton>
      </div>
      <AppButton v-if="!note.tie" variant="quiet" @click="startTie">Start Tie</AppButton>
      <AppButton v-else variant="quiet" @click="removeTie">Remove Tie</AppButton>
      <AppButton variant="danger" @click="remove">Remove</AppButton>
    </div>
  </AppFlyout>
</template>

<style scoped>
.element-editor {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.element-editor__articulations {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}
</style>
