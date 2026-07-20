<script setup lang="ts">
import { computed, ref } from 'vue';
import { Result } from '@scoregrove/domain/Result';
import AppButton from '../ui/AppButton.vue';
import AppTextField from '../ui/AppTextField.vue';
import SidebarSection from '../ui/SidebarSection.vue';
import { useEditorStore } from '../store/useEditorStore';

/**
 * The sidebar's bottom region: current project name, new/save-as, and a
 * list of saved projects to load or delete. Autosave (debounced, in the
 * store) means there's no explicit "save" button for the common case —
 * only "save as" to name or rename the session.
 */
const store = useEditorStore();

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

function confirmDelete(name: string): void {
  store.deleteProject(name);
  confirmingDelete.value = null;
}
</script>

<template>
  <SidebarSection heading="Project" class="project-manager">
    <p v-if="store.state.projectName" class="project-manager__current">
      {{ store.state.projectName }}
    </p>
    <p v-else class="project-manager__current project-manager__current--untitled">Untitled</p>

    <AppTextField
      label="Name"
      :model-value="draftName"
      placeholder="Project name"
      :error="error"
      @update:model-value="(value) => (draftName = value)"
    />

    <div class="project-manager__actions">
      <AppButton @click="startNew">New</AppButton>
      <AppButton @click="saveAs">Save As</AppButton>
    </div>

    <ul v-if="projects.length" class="project-manager__list">
      <li v-for="name in projects" :key="name" class="project-manager__item">
        <template v-if="confirmingDelete === name">
          <span class="project-manager__confirm-text">Delete "{{ name }}"?</span>
          <AppButton variant="quiet" @click="confirmingDelete = null">Cancel</AppButton>
          <AppButton variant="danger" @click="confirmDelete(name)">Delete</AppButton>
        </template>
        <template v-else>
          <button type="button" class="project-manager__name" @click="store.loadProject(name)">
            {{ name }}
          </button>
          <AppButton variant="quiet" @click="confirmingDelete = name">✕</AppButton>
        </template>
      </li>
    </ul>
  </SidebarSection>
</template>

<style scoped>
.project-manager__current {
  margin: 0;
  font-weight: 600;
}

.project-manager__current--untitled {
  color: var(--color-text-muted);
  font-style: italic;
  font-weight: 400;
}

.project-manager__actions {
  display: flex;
  gap: var(--space-2);
}

.project-manager__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  margin: 0;
  padding: 0;
  list-style: none;
}

.project-manager__item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.project-manager__name {
  flex: 1 1 auto;
  padding: var(--space-1) var(--space-2);
  text-align: left;
  color: var(--color-text);
  background: none;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.project-manager__name:hover {
  background: var(--color-surface);
}

.project-manager__confirm-text {
  flex: 1 1 auto;
  font-size: var(--text-sm);
}
</style>
