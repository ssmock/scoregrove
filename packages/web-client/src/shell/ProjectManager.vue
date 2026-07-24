<script setup lang="ts">
import { computed, ref } from 'vue';
import { Result } from '@scoregrove/domain/Result';
import AppButton from '../ui/AppButton.vue';
import AppDialog from '../ui/AppDialog.vue';
import AppTextField from '../ui/AppTextField.vue';
import { useEditorStore } from '../store/useEditorStore';

/**
 * A compact project bar at the top of the sidebar: just the current project's
 * name and a button that opens the projects dialog. New/Save As/rename and the
 * saved-project list all live in that dialog rather than crowding the sidebar —
 * autosave (debounced, in the store) already keeps the working session, so this
 * chrome is only reached occasionally.
 */
const store = useEditorStore();

const dialogOpen = ref(false);
const draftName = ref('');
const error = ref<string | undefined>(undefined);
const confirmingDelete = ref<string | null>(null);

const projects = computed(() => store.listProjects());

function saveAs(): void {
  const trimmed = draftName.value.trim();

  if (!trimmed) {
    error.value = 'Enter a name first';

    return;
  }

  store.saveProjectAs(trimmed);
  draftName.value = '';
  error.value = undefined;
}

function startNew(): void {
  const trimmed = draftName.value.trim();

  if (!trimmed) {
    error.value = 'Enter a name first';

    return;
  }

  const result = store.newProject(trimmed);

  if (Result.isError(result)) {
    error.value = result.error.messages.join('; ');

    return;
  }

  draftName.value = '';
  error.value = undefined;
}

function loadProject(name: string): void {
  store.loadProject(name);
  dialogOpen.value = false;
}

function confirmDelete(name: string): void {
  store.deleteProject(name);
  confirmingDelete.value = null;
}
</script>

<template>
  <div class="project-bar">
    <span
      class="project-bar__name"
      :class="{ 'project-bar__name--untitled': !store.state.projectName }"
      :title="store.state.projectName ?? 'Untitled'"
    >
      {{ store.state.projectName ?? 'Untitled' }}
    </span>
    <AppButton variant="quiet" class="project-bar__open" @click="dialogOpen = true">
      Projects
    </AppButton>
  </div>

  <AppDialog :open="dialogOpen" title="Projects" @close="dialogOpen = false">
    <div class="project-dialog">
      <AppTextField
        label="Name"
        :model-value="draftName"
        placeholder="Project name"
        :error="error"
        @update:model-value="(value) => (draftName = value)"
      />

      <div class="project-dialog__actions">
        <AppButton @click="startNew">New</AppButton>
        <AppButton @click="saveAs">Save as</AppButton>
      </div>

      <template v-if="projects.length">
        <h3 class="project-dialog__heading">Saved</h3>
        <ul class="project-dialog__list">
          <li v-for="name in projects" :key="name" class="project-dialog__item">
            <template v-if="confirmingDelete === name">
              <span class="project-dialog__confirm-text">Delete "{{ name }}"?</span>
              <AppButton variant="quiet" @click="confirmingDelete = null">Cancel</AppButton>
              <AppButton variant="danger" @click="confirmDelete(name)">Delete</AppButton>
            </template>
            <template v-else>
              <button type="button" class="project-dialog__name" @click="loadProject(name)">
                {{ name }}
              </button>
              <AppButton variant="quiet" aria-label="Delete" @click="confirmingDelete = name">
                ✕
              </AppButton>
            </template>
          </li>
        </ul>
      </template>
    </div>
  </AppDialog>
</template>

<style scoped>
.project-bar {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  font-size: var(--text-sm);
}

.project-bar__name {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
}

.project-bar__name--untitled {
  color: var(--color-text-muted);
  font-style: italic;
  font-weight: 400;
}

.project-bar__open {
  flex: none;
  font-size: var(--text-sm);
}

.project-dialog {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  min-width: 18rem;
}

.project-dialog__actions {
  display: flex;
  gap: var(--space-2);
}

.project-dialog__heading {
  margin: var(--space-2) 0 0;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.project-dialog__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  margin: 0;
  padding: 0;
  list-style: none;
}

.project-dialog__item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.project-dialog__name {
  flex: 1 1 auto;
  padding: var(--space-2);
  text-align: left;
  color: var(--color-text);
  background: none;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.project-dialog__name:hover {
  background: var(--color-surface);
}

.project-dialog__confirm-text {
  flex: 1 1 auto;
  font-size: var(--text-sm);
}
</style>
