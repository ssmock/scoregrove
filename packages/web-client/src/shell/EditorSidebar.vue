<script setup lang="ts">
import AppButton from '../ui/AppButton.vue';
import SidebarSection from '../ui/SidebarSection.vue';
import { useEditorStore } from '../store/useEditorStore';
import EditorPallet from './EditorPallet.vue';
import ProjectManager from './ProjectManager.vue';
import TransportBar from './TransportBar.vue';

/**
 * The editor's left sidebar: view switching (top), the pallet (middle),
 * project management (bottom) — TODO-UX's Editor view layout.
 */
const store = useEditorStore();
</script>

<template>
  <aside class="sidebar">
    <SidebarSection heading="View">
      <AppButton :pressed="true">Editor</AppButton>
      <AppButton variant="quiet" @click="store.setView('performance')">Performance</AppButton>
    </SidebarSection>

    <EditorPallet class="sidebar__pallet" />

    <SidebarSection heading="Playback">
      <TransportBar />
    </SidebarSection>

    <ProjectManager />
  </aside>
</template>

<style scoped>
.sidebar {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  width: 280px;
  max-width: 300px;
  padding: var(--space-4);
  overflow-y: auto;
  background: var(--color-surface);
  border-right: 1px solid var(--color-border);
}

.sidebar__pallet {
  flex: 1 1 auto;
}
</style>
