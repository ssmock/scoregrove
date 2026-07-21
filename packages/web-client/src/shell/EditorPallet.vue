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
import SidebarSection from '../ui/SidebarSection.vue';
import { sameToolConfig, type EraserMode, type ToolConfig } from '../store/editorStore';
import { useEditorStore } from '../store/useEditorStore';
import HotkeysDialog from './HotkeysDialog.vue';
import StaffDialog from './StaffDialog.vue';

/**
 * Note/rest pick, then a duration flyout, then the config is active (and
 * promoted into recents) — the two-step interaction TODO-UX describes. The
 * time signature tool is single-click instead: picking it immediately
 * selects common time as a sensible default, and its own flyout opens
 * alongside for keying in a different beats/unit. Recents and the eraser
 * modes live here too, since they're all "what will placing/clicking do
 * next" state.
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

const flyoutKind = ref<'note' | 'rest' | null>(null);
const staffDialogOpen = ref(false);
const hotkeysDialogOpen = ref(false);
const timeSigFlyoutOpen = ref(false);
const draftBeats = ref('4');
const draftUnit = ref<BeatUnit>(BeatUnit.Quarter);
const timeSigError = ref<string | undefined>(undefined);
const noteButton = ref<InstanceType<typeof AppButton> | null>(null);
const restButton = ref<InstanceType<typeof AppButton> | null>(null);
const timeSigButton = ref<InstanceType<typeof AppButton> | null>(null);

const flyoutAnchor = computed(() => {
  if (flyoutKind.value === 'note') return noteButton.value?.rootEl ?? null;
  if (flyoutKind.value === 'rest') return restButton.value?.rootEl ?? null;

  return null;
});

/**
 * The icon-only combined glyph for notes (`forNotehead` alone can't tell
 * quarter/eighth/sixteenth/etc. apart — they all share one notehead shape,
 * `noteheadBlack`; only the stem+flags distinguish them). Rests already have
 * a distinct glyph per duration, so `forRest` is fine as-is.
 */
const glyphFor = (kind: 'note' | 'rest', noteValue: NoteValue): GlyphName =>
  kind === 'note' ? Glyphs.forNoteIcon(noteValue) : Glyphs.forRest(noteValue);

function toggleFlyout(kind: 'note' | 'rest'): void {
  flyoutKind.value = flyoutKind.value === kind ? null : kind;
}

function pickDuration(noteValue: NoteValue): void {
  if (!flyoutKind.value) return;

  const config: ToolConfig = { kind: flyoutKind.value, duration: Duration.of(noteValue) };

  store.selectTool(config);
  flyoutKind.value = null;
}

function pickEraser(mode: EraserMode): void {
  store.setEraserMode(store.state.eraserMode === mode ? null : mode);
}

/**
 * Picks up the tool button's own click: closes the flyout if it's already
 * open, otherwise opens it, pre-filled from the current active tool if it's
 * already a time signature, or common time (the default) if not — selecting
 * common time immediately, exactly like clicking Tie or an eraser button
 * takes effect right away rather than waiting on a flyout choice.
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
  <SidebarSection heading="Pallet" class="pallet">
    <div class="pallet__row">
      <AppButton
        ref="noteButton"
        :pressed="flyoutKind === 'note'"
        aria-haspopup="true"
        :aria-expanded="flyoutKind === 'note'"
        @click="toggleFlyout('note')"
      >
        <template #icon><MusicIcon glyph="noteheadBlack" :size="18" /></template>
        Note
      </AppButton>
      <AppButton
        ref="restButton"
        :pressed="flyoutKind === 'rest'"
        aria-haspopup="true"
        :aria-expanded="flyoutKind === 'rest'"
        @click="toggleFlyout('rest')"
      >
        <template #icon><MusicIcon glyph="restQuarter" :size="18" /></template>
        Rest
      </AppButton>
      <AppButton :pressed="store.state.tieMode" @click="store.setTieMode(!store.state.tieMode)">
        Tie
      </AppButton>
      <AppButton
        ref="timeSigButton"
        :pressed="store.state.activeTool?.kind === 'timeSignature'"
        aria-haspopup="true"
        :aria-expanded="timeSigFlyoutOpen"
        @click="toggleTimeSigFlyout"
      >
        Time Sig
      </AppButton>
    </div>

    <AppFlyout :open="flyoutKind !== null" :anchor="flyoutAnchor" @close="flyoutKind = null">
      <div class="pallet__durations" role="menu">
        <button
          v-for="noteValue in noteValues"
          :key="noteValue"
          type="button"
          class="pallet__duration-option"
          role="menuitem"
          @click="pickDuration(noteValue)"
        >
          <MusicIcon :glyph="glyphFor(flyoutKind ?? 'note', noteValue)" :size="22" />
        </button>
      </div>
    </AppFlyout>

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
        <AppButton @click="applyTimeSignature">Use This Time Signature</AppButton>
      </div>
    </AppFlyout>

    <div v-if="store.state.activeTool" class="pallet__active">
      <template v-if="store.state.activeTool.kind === 'timeSignature'">
        <span class="pallet__time-sig-badge">{{
          TimeSignature.format(store.state.activeTool.time)
        }}</span>
      </template>
      <MusicIcon
        v-else
        :glyph="glyphFor(store.state.activeTool.kind, store.state.activeTool.duration.noteValue)"
        :size="18"
      />
      <span>ready to place</span>
    </div>

    <div v-if="store.state.tieMode" class="pallet__active">
      <span v-if="store.state.pendingTie">click the next note to close the tie</span>
      <span v-else>click a note to start a tie</span>
    </div>

    <div v-if="store.state.recents.length" class="pallet__recents">
      <button
        v-for="(recent, index) in store.state.recents"
        :key="index"
        type="button"
        class="pallet__recent"
        :class="{
          'pallet__recent--active':
            !!store.state.activeTool && sameToolConfig(recent, store.state.activeTool),
        }"
        :title="
          recent.kind === 'timeSignature'
            ? TimeSignature.format(recent.time)
            : `${recent.kind} · ${recent.duration.noteValue}`
        "
        @click="store.selectTool(recent)"
      >
        <span v-if="recent.kind === 'timeSignature'" class="pallet__time-sig-badge">{{
          TimeSignature.format(recent.time)
        }}</span>
        <MusicIcon v-else :glyph="glyphFor(recent.kind, recent.duration.noteValue)" :size="16" />
      </button>
    </div>

    <div class="pallet__row">
      <AppButton :pressed="store.state.eraserMode === 'element'" @click="pickEraser('element')">
        Eraser
      </AppButton>
      <AppButton :pressed="store.state.eraserMode === 'bar'" @click="pickEraser('bar')">
        Bar Eraser
      </AppButton>
    </div>

    <AppButton class="pallet__staff-button" @click="staffDialogOpen = true">
      Staff Setup
    </AppButton>

    <div class="pallet__row">
      <AppButton @click="store.addMeasure()">Add Measure</AppButton>
      <AppButton
        :disabled="store.state.score.measures.length <= 1"
        @click="store.removeLastMeasure()"
      >
        Remove Measure
      </AppButton>
    </div>

    <AppButton variant="link" class="pallet__hotkeys-link" @click="hotkeysDialogOpen = true">
      Keyboard shortcuts
    </AppButton>

    <StaffDialog :open="staffDialogOpen" @close="staffDialogOpen = false" />
    <HotkeysDialog :open="hotkeysDialogOpen" @close="hotkeysDialogOpen = false" />
  </SidebarSection>
</template>

<style scoped>
.pallet {
  gap: var(--space-3);
}

.pallet__row {
  display: flex;
  gap: var(--space-2);
}

.pallet__durations {
  display: flex;
  gap: var(--space-1);
}

.pallet__duration-option {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-2);
  color: var(--color-text);
  background: none;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.pallet__duration-option:hover {
  background: var(--color-surface);
  border-color: var(--color-border);
}

.pallet__active {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.pallet__recents {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}

.pallet__recent {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-1);
  color: var(--color-text);
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.pallet__recent--active {
  border-color: var(--color-accent);
}

.pallet__staff-button {
  align-self: flex-start;
}

.pallet__hotkeys-link {
  align-self: flex-start;
}

.pallet__time-sig-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  min-width: 12rem;
}

.pallet__time-sig-badge {
  font-size: var(--text-sm);
  font-weight: 600;
}
</style>
