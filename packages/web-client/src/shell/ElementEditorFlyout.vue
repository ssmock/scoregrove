<script setup lang="ts">
import { computed } from 'vue';
import type { Fraction } from '@scoregrove/domain/Fraction';
import { Articulation } from '@scoregrove/domain/Notations';
import { Pitch } from '@scoregrove/domain/Pitch';
import AppButton from '../ui/AppButton.vue';
import AppFlyout from '../ui/AppFlyout.vue';
import { useEditorStore } from '../store/useEditorStore';

/**
 * The right-click flyout for a placed note or a chord. Dots and
 * articulations are always chord-wide fields, so they apply the same way
 * whether `target` is a note or a chord (TODO-UX's "articulations, dots,
 * accidentals, removal" — an accidental override isn't wired up yet, see
 * TO-VERIFY.md). Tie and removal are per-tone for a chord: `pitch` (the
 * right-click's derived staff position) picks out *which* tone, the same
 * way the eraser already does; for a plain note it's always null and both
 * actions apply to the note as a whole. Identifies the element by
 * `location` + `onset` rather than a fixed address: dot/articulation edits
 * can shift a note's element index (the surrounding rests re-decompose), so
 * every read and dispatch here re-resolves through `store.resolveAddress`,
 * which stays correct across repeated actions in one flyout session without
 * needing to track that shift itself.
 */
const props = defineProps<{
  open: boolean;
  at: { x: number; y: number } | null;
  location: { measure: number; staff: number; voice: number } | null;
  onset: Fraction | null;
  pitch: Pitch | null;
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

const target = computed(() => {
  const addr = address.value;

  if (!addr) return undefined;

  const element =
    store.state.score.measures[addr.measure]?.contents[addr.staff]?.voices[addr.voice]?.elements[
      addr.element
    ];

  return element?.kind === 'note' || element?.kind === 'chord' ? element : undefined;
});

const chord = computed(() => (target.value?.kind === 'chord' ? target.value : undefined));

/** The tie role of whichever tone this flyout targets — the note itself, or the chord tone at `pitch` */
const currentTie = computed(() => {
  const t = target.value;

  if (!t) return undefined;
  if (t.kind === 'note') return t.tie;

  return props.pitch
    ? t.tones.find((tone) => Pitch.equals(tone.pitch, props.pitch!))?.tie
    : undefined;
});

/** `pitch` only matters (and is only ever set) when the target is a chord */
const tonePitch = computed(() => (chord.value ? (props.pitch ?? undefined) : undefined));

function cycleDots(): void {
  if (address.value) store.cycleDots(address.value);
}

function toggleArticulation(articulation: Articulation): void {
  if (address.value) store.toggleArticulation(address.value, articulation);
}

/** Engages tie mode with this note or chord tone as the pending start — the same state a pallet-tool click into it would set */
function startTie(): void {
  if (address.value) store.startTie(address.value, tonePitch.value);
  emit('close');
}

function removeTie(): void {
  if (address.value) store.removeTie(address.value, tonePitch.value);
  emit('close');
}

/** Removes the whole note, or just the tone this flyout was opened on if it's a chord */
function remove(): void {
  if (address.value) store.erase(address.value, tonePitch.value);
  emit('close');
}
</script>

<template>
  <AppFlyout :open="open && !!target" :at="at" @close="emit('close')">
    <div v-if="target" class="element-editor" role="menu">
      <AppButton variant="quiet" @click="cycleDots">
        Dots: {{ target.duration.dots ?? 0 }}
      </AppButton>
      <div class="element-editor__articulations">
        <AppButton
          v-for="articulation in articulationChoices"
          :key="articulation"
          variant="quiet"
          :pressed="!!target.articulations?.includes(articulation)"
          :title="articulation"
          @click="toggleArticulation(articulation)"
        >
          {{ articulation.slice(0, 4) }}
        </AppButton>
      </div>
      <AppButton v-if="!currentTie" variant="quiet" @click="startTie">Start Tie</AppButton>
      <AppButton v-else variant="quiet" @click="removeTie">Remove Tie</AppButton>
      <AppButton v-if="chord" variant="danger" @click="remove">
        Remove {{ pitch ? Pitch.format(pitch) : 'Note' }}
      </AppButton>
      <AppButton v-else variant="danger" @click="remove">Remove</AppButton>
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
