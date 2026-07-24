<script setup lang="ts">
import { computed, ref } from 'vue';
import { Duration, NoteValue } from '@scoregrove/domain/Duration';
import { Result } from '@scoregrove/domain/Result';
import { BeatUnit, TimeSignature } from '@scoregrove/domain/TimeSignature';
import type { GlyphName } from '@scoregrove/engraving/Bravura';
import { Glyphs } from '@scoregrove/engraving/Glyphs';
import AppButton from '../ui/AppButton.vue';
import AppFlyout from '../ui/AppFlyout.vue';
import AppSelect from '../ui/AppSelect.vue';
import AppTextField from '../ui/AppTextField.vue';
import MusicIcon from '../ui/MusicIcon.vue';
import SegmentedControl from '../ui/SegmentedControl.vue';
import SidebarSection from '../ui/SidebarSection.vue';
import { type EraserMode } from '../store/editorStore';
import { useEditorStore } from '../store/useEditorStore';
import StaffDialog from './StaffDialog.vue';

/**
 * The note-input pallet, laid out as a compact tool toolbar (after MuseScore's
 * and Flat's note-input toolbars): what to place (note/rest) and its duration
 * are always visible rather than hidden behind a flyout, so the active tool is
 * legible at a glance; mutually-exclusive choices are segmented controls. The
 * time signature still opens a small form (it needs numbers keyed in).
 */
const store = useEditorStore();

const noteValues: readonly NoteValue[] = [
  NoteValue.Whole,
  NoteValue.Half,
  NoteValue.Quarter,
  NoteValue.Eighth,
  NoteValue.Sixteenth,
  NoteValue.ThirtySecond,
  NoteValue.SixtyFourth,
];

const beatUnitOptions = [
  { value: BeatUnit.Whole, label: 'Whole (1)' },
  { value: BeatUnit.Half, label: 'Half (2)' },
  { value: BeatUnit.Quarter, label: 'Quarter (4)' },
  { value: BeatUnit.Eighth, label: 'Eighth (8)' },
  { value: BeatUnit.Sixteenth, label: 'Sixteenth (16)' },
  { value: BeatUnit.ThirtySecond, label: 'Thirty-second (32)' },
];

const durationNames: Record<string, string> = {
  Whole: 'Whole',
  Half: 'Half',
  Quarter: 'Quarter',
  Eighth: 'Eighth',
  Sixteenth: '16th',
  ThirtySecond: '32nd',
  SixtyFourth: '64th',
};

const staffDialogOpen = ref(false);
const timeSigFlyoutOpen = ref(false);
const draftBeats = ref('4');
const draftUnit = ref<BeatUnit>(BeatUnit.Quarter);
const timeSigError = ref<string | undefined>(undefined);
const timeSigButton = ref<InstanceType<typeof AppButton> | null>(null);

/** The active note/rest tool's kind and duration, or null when the active tool is neither (a time signature, or nothing) */
const activeKind = computed<'note' | 'rest' | null>(() => {
  const tool = store.state.activeTool;

  return tool && (tool.kind === 'note' || tool.kind === 'rest') ? tool.kind : null;
});

const activeDuration = computed<NoteValue | null>(() => {
  const tool = store.state.activeTool;

  return tool && (tool.kind === 'note' || tool.kind === 'rest') ? tool.duration.noteValue : null;
});

const timeSigLabel = computed(() =>
  store.state.activeTool?.kind === 'timeSignature'
    ? TimeSignature.format(store.state.activeTool.time)
    : 'Time',
);

/**
 * A one-line description of what clicking the staff does right now, for the
 * persistent help line under the tools. Always returns something (the line's
 * space is reserved either way, so it never shifts the layout).
 */
const helpText = computed<string>(() => {
  const state = store.state;

  if (state.tieMode) {
    return state.pendingTie
      ? 'Click the next note to close the tie.'
      : 'Click a note to start a tie.';
  }

  if (state.eraserMode === 'element') return 'Click a note or rest to erase it.';
  if (state.eraserMode === 'bar') return 'Click any bar to clear it to rests.';

  const tool = state.activeTool;

  if (!tool) return 'Pick a note or rest above, then click the staff to place it.';
  if (tool.kind === 'timeSignature') return 'Click a bar to set its time signature.';

  const duration = durationNames[tool.duration.noteValue] ?? tool.duration.noteValue;

  if (tool.kind === 'rest') return `${duration} rest — click the staff to place it.`;

  const stacking =
    state.placementMode === 'voice'
      ? 'a note on a taken beat starts a new voice'
      : 'a note on a taken beat joins it as a chord';

  return `${duration} note — click the staff to place it; ${stacking}.`;
});

/**
 * The icon-only combined glyph for notes (`forNotehead` alone can't tell
 * quarter/eighth/sixteenth/etc. apart — they all share one notehead shape,
 * `noteheadBlack`; only the stem+flags distinguish them). Rests already have
 * a distinct glyph per duration, so `forRest` is fine as-is.
 */
const glyphFor = (kind: 'note' | 'rest', noteValue: NoteValue): GlyphName =>
  kind === 'note' ? Glyphs.forNoteIcon(noteValue) : Glyphs.forRest(noteValue);

/** Picks the tool's kind, keeping the current duration (or a quarter to start) */
function pickKind(kind: string): void {
  store.selectTool({
    kind: kind as 'note' | 'rest',
    duration: Duration.of(activeDuration.value ?? NoteValue.Quarter),
  });
}

/** Picks the tool's duration, keeping the current kind (or a note to start) */
function pickDuration(noteValue: NoteValue): void {
  store.selectTool({ kind: activeKind.value ?? 'note', duration: Duration.of(noteValue) });
}

function toggleEraser(mode: string): void {
  const next = mode as EraserMode;

  store.setEraserMode(store.state.eraserMode === next ? null : next);
}

/**
 * Opens the time signature form, pre-filled from the active tool if it's
 * already a time signature, or common time (the default) otherwise — selecting
 * common time immediately, the same way clicking a note tool takes effect at
 * once rather than waiting on the form.
 */
function toggleTimeSigFlyout(): void {
  if (timeSigFlyoutOpen.value) {
    timeSigFlyoutOpen.value = false;

    return;
  }

  const current = store.state.activeTool;

  if (current?.kind === 'timeSignature') {
    draftBeats.value = String(current.time.beats);
    draftUnit.value = current.time.beatUnit;
  } else {
    draftBeats.value = '4';
    draftUnit.value = BeatUnit.Quarter;
    store.selectTool({ kind: 'timeSignature', time: TimeSignature.commonTime() });
  }

  timeSigError.value = undefined;
  timeSigFlyoutOpen.value = true;
}

function applyTimeSignature(): void {
  const beats = Number(draftBeats.value);
  const result = TimeSignature.create(beats, draftUnit.value);

  if (!Result.isOk(result)) {
    timeSigError.value = result.error.messages.join('; ');

    return;
  }

  timeSigError.value = undefined;
  store.selectTool({ kind: 'timeSignature', time: result.value });
  timeSigFlyoutOpen.value = false;
}
</script>

<template>
  <div class="pallet">
    <SidebarSection heading="Notes">
      <SegmentedControl
        stretch
        aria-label="Place a note or a rest"
        :options="[
          { value: 'note', label: 'Note', glyph: 'noteheadBlack' },
          { value: 'rest', label: 'Rest', glyph: 'restQuarter' },
        ]"
        :model-value="activeKind"
        @update:model-value="pickKind"
      />

      <div class="pallet__durations" role="group" aria-label="Duration">
        <button
          v-for="noteValue in noteValues"
          :key="noteValue"
          type="button"
          class="pallet__duration"
          :class="{ 'pallet__duration--active': activeDuration === noteValue }"
          :aria-pressed="activeDuration === noteValue"
          :title="`${durationNames[noteValue] ?? noteValue} ${activeKind ?? 'note'}`"
          @click="pickDuration(noteValue)"
        >
          <MusicIcon :glyph="glyphFor(activeKind ?? 'note', noteValue)" :size="20" />
        </button>
      </div>

      <div class="pallet__inline">
        <SegmentedControl
          quiet
          class="pallet__grow"
          aria-label="What a note on an occupied beat does"
          :options="[
            { value: 'chord', label: 'Chord', title: 'Stack a same-duration note as a chord' },
            {
              value: 'voice',
              label: 'Voice',
              title: 'Add the note as an independent voice (allows a different rhythm)',
            },
          ]"
          :model-value="store.state.placementMode"
          @update:model-value="(mode) => store.setPlacementMode(mode as 'chord' | 'voice')"
        />
        <AppButton
          :pressed="store.state.tieMode"
          title="Tie two notes of the same pitch"
          @click="store.setTieMode(!store.state.tieMode)"
        >
          Tie
        </AppButton>
      </div>
    </SidebarSection>

    <SidebarSection heading="Bars &amp; staves">
      <div class="pallet__inline">
        <AppButton class="pallet__half" @click="staffDialogOpen = true">Staff setup</AppButton>
        <AppButton
          ref="timeSigButton"
          class="pallet__half"
          :pressed="store.state.activeTool?.kind === 'timeSignature'"
          aria-haspopup="true"
          :aria-expanded="timeSigFlyoutOpen"
          @click="toggleTimeSigFlyout"
        >
          {{ timeSigLabel === 'Time' ? 'Time sig' : timeSigLabel }}
        </AppButton>
      </div>

      <SegmentedControl
        stretch
        aria-label="Eraser"
        :options="[
          { value: 'element', label: 'Erase note' },
          { value: 'bar', label: 'Erase bar' },
        ]"
        :model-value="store.state.eraserMode"
        @update:model-value="toggleEraser"
      />

      <div class="pallet__inline">
        <AppButton
          class="pallet__half"
          :disabled="store.state.score.measures.length <= 1"
          @click="store.removeLastMeasure()"
        >
          Remove bar
        </AppButton>
        <AppButton class="pallet__half" @click="store.addMeasure()">Add bar</AppButton>
      </div>
    </SidebarSection>

    <p class="pallet__help">{{ helpText }}</p>

    <AppFlyout
      :open="timeSigFlyoutOpen"
      :anchor="timeSigButton?.rootEl ?? null"
      @close="timeSigFlyoutOpen = false"
    >
      <div class="pallet__time-sig-form">
        <AppTextField
          label="Beats"
          :model-value="draftBeats"
          :error="timeSigError"
          @update:model-value="(value) => (draftBeats = value)"
        />
        <AppSelect
          label="Beat unit"
          :model-value="draftUnit"
          :options="beatUnitOptions"
          @update:model-value="(value) => (draftUnit = value as BeatUnit)"
        />
        <AppButton @click="applyTimeSignature">Use this time signature</AppButton>
      </div>
    </AppFlyout>

    <StaffDialog :open="staffDialogOpen" @close="staffDialogOpen = false" />
  </div>
</template>

<style scoped>
.pallet {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.pallet__durations {
  display: flex;
  gap: var(--space-1);
}

.pallet__duration {
  flex: 1 1 0;
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 1;
  padding: 0;
  color: var(--color-text);
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition:
    background var(--duration-fast) var(--easing-standard),
    border-color var(--duration-fast) var(--easing-standard);
}

.pallet__duration:hover:not(.pallet__duration--active) {
  background: var(--color-surface);
}

.pallet__duration--active {
  color: var(--color-accent-text);
  background: var(--color-accent);
  border-color: var(--color-accent);
}

.pallet__duration:focus-visible {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: 1px;
}

.pallet__inline {
  display: flex;
  align-items: stretch;
  gap: var(--space-2);
}

.pallet__grow {
  flex: 1 1 auto;
}

.pallet__half {
  flex: 1 1 0;
  justify-content: center;
}

/* A persistent help line: its space is always reserved (two lines' worth at
   the sidebar's width), so updating it never nudges the tools above it. */
.pallet__help {
  min-height: 2.6rem;
  margin: 0;
  font-size: var(--text-sm);
  line-height: 1.35;
  color: var(--color-text-muted);
}

.pallet__time-sig-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  min-width: 12rem;
}
</style>
