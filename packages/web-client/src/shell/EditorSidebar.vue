<script setup lang="ts">
import { ref } from 'vue';
import AppButton from '../ui/AppButton.vue';
import SidebarSection from '../ui/SidebarSection.vue';
import { useEditorStore } from '../store/useEditorStore';
import EditorPallet from './EditorPallet.vue';
import HotkeysDialog from './HotkeysDialog.vue';
import ProjectManager from './ProjectManager.vue';
import TransportBar from './TransportBar.vue';

/**
 * The editor's left sidebar: project bar (top), view switch, the note-input
 * pallet, then playback and a shortcuts link anchored to the foot. Kept to a
 * tight vertical rhythm of tool groups rather than a stack of full-width
 * buttons.
 */
const store = useEditorStore();

const hotkeysOpen = ref(false);
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar__header">
      <ProjectManager />

      <AppButton variant="quiet" class="sidebar__perform" @click="store.setView('performance')">
        Performance view →
      </AppButton>
    </div>

    <EditorPallet />

    <div class="sidebar__foot">
      <SidebarSection heading="Playback">
        <TransportBar />
      </SidebarSection>

      <AppButton variant="link" class="sidebar__hotkeys" @click="hotkeysOpen = true">
        Keyboard shortcuts
      </AppButton>
    </div>

    <HotkeysDialog :open="hotkeysOpen" @close="hotkeysOpen = false" />
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

/* Top-level chrome grouped together: the project bar and the (de-emphasized)
   switch into the performance view, which just launches it rather than toggling. */
.sidebar__header {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.sidebar__perform {
  align-self: flex-start;
  padding-left: 0;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.sidebar__perform:hover:not(:disabled) {
  color: var(--color-accent);
  background: transparent;
}

/*
 * Playback + shortcuts as one accented panel anchored to the foot, flush to
 * the sidebar's edges: negative margins cancel the sidebar's padding on the
 * sides and bottom, while `margin-top: auto` keeps it pinned down with the
 * pallet's leftover space above. Its own horizontal padding realigns the
 * controls with the tools above.
 */
.sidebar__foot {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin: auto calc(-1 * var(--space-4)) calc(-1 * var(--space-4));
  padding: var(--space-3) var(--space-4);
  background: color-mix(in srgb, var(--color-accent) 8%, var(--color-surface-raised));
  border-top: 1px solid var(--color-accent);
}

.sidebar__foot :deep(.sidebar-section__heading) {
  color: var(--color-accent);
}

.sidebar__hotkeys {
  align-self: center;
  font-size: 0.625rem;
}
</style>
