<script setup lang="ts">
import { ref } from 'vue';
import { Clef } from '@scoregrove/domain/Clef';
import { NonEmptyString } from '@scoregrove/domain/NonEmptyString';
import AppButton from '../ui/AppButton.vue';
import AppCheckbox from '../ui/AppCheckbox.vue';
import AppDialog from '../ui/AppDialog.vue';
import AppSelect from '../ui/AppSelect.vue';
import AppTextField from '../ui/AppTextField.vue';
import { useEditorStore } from '../store/useEditorStore';

/**
 * The staff list editor and flow picker from TODO-UX's Step 1. Removal
 * confirms inline (a row swaps to "Remove this staff? [Cancel] [Remove]")
 * rather than as a nested dialog: AppDialog's outside-click dismiss checks
 * whether a click landed outside *its own* teleported root, so a second
 * teleported dialog stacked on top would read as "outside" the first and
 * could close it unexpectedly. Inline avoids that entirely.
 */
defineProps<{ open: boolean }>();

const emit = defineEmits<{ close: [] }>();

const store = useEditorStore();

const clefOptions = [
  { value: Clef.Treble, label: 'Treble' },
  { value: Clef.Bass, label: 'Bass' },
  { value: Clef.Alto, label: 'Alto' },
];

const flowOptions = [
  { value: 'vertical', label: 'Vertical (wrap)' },
  { value: 'horizontal', label: 'Horizontal (scroll)' },
];

const confirmingRemoval = ref<number | null>(null);

function updateClef(index: number, clef: string): void {
  const staff = store.state.score.staves[index];

  store.updateStaff(index, clef as Clef, staff.label);
}

function updateLabel(index: number, label: string): void {
  const staff = store.state.score.staves[index];
  const trimmed = label.trim();

  store.updateStaff(index, staff.clef, trimmed ? NonEmptyString.of(trimmed) : undefined);
}

function confirmRemoval(index: number): void {
  store.removeStaff(index);
  confirmingRemoval.value = null;
}
</script>

<template>
  <AppDialog :open="open" title="Staff Setup" @close="emit('close')">
    <div class="staff-dialog__rows">
      <div
        v-for="(staff, index) in store.state.score.staves"
        :key="index"
        class="staff-dialog__row"
      >
        <template v-if="confirmingRemoval === index">
          <span class="staff-dialog__confirm-text">Remove this staff?</span>
          <AppButton variant="quiet" @click="confirmingRemoval = null">Cancel</AppButton>
          <AppButton variant="danger" @click="confirmRemoval(index)">Remove</AppButton>
        </template>
        <template v-else>
          <AppSelect
            label="Clef"
            :model-value="staff.clef"
            :options="clefOptions"
            @update:model-value="(value) => updateClef(index, value)"
          />
          <AppTextField
            label="Label"
            :model-value="staff.label ?? ''"
            placeholder="(none)"
            @update:model-value="(value) => updateLabel(index, value)"
          />
          <AppCheckbox
            label="Visible"
            :model-value="!store.state.hiddenStaves.has(index)"
            @update:model-value="() => store.toggleStaffVisibility(index)"
          />
          <AppButton
            variant="danger"
            :disabled="store.state.score.staves.length <= 1"
            @click="confirmingRemoval = index"
          >
            Remove
          </AppButton>
        </template>
      </div>
    </div>

    <AppButton @click="store.addStaff(Clef.Treble)">Add staff</AppButton>

    <AppSelect
      class="staff-dialog__flow"
      label="Flow"
      :model-value="store.state.flow"
      :options="flowOptions"
      @update:model-value="(value) => store.setFlow(value as 'vertical' | 'horizontal')"
    />
  </AppDialog>
</template>

<style scoped>
.staff-dialog__rows {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.staff-dialog__row {
  display: flex;
  align-items: flex-end;
  gap: var(--space-3);
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--color-border);
}

.staff-dialog__confirm-text {
  flex: 1 1 auto;
  color: var(--color-text);
}

.staff-dialog__flow {
  margin-top: var(--space-4);
}
</style>
