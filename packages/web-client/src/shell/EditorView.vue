<script setup lang="ts">
import { useEditorStore } from '../store/useEditorStore';
import ScoreDisplay from './ScoreDisplay.vue';
import EditorSidebar from './EditorSidebar.vue';

/**
 * Sidebar + the interactive staff: clicking/hovering the staff places or
 * erases per the pallet's active tool/eraser mode, right-click edits an
 * existing note, and the hover-scoped hotkeys are live here — the only
 * `ScoreDisplay` usage with `interactive` set.
 */
const store = useEditorStore();
</script>

<template>
  <div class="editor-view">
    <EditorSidebar />
    <main class="editor-view__stage">
      <ScoreDisplay
        interactive
        :score="store.state.score"
        :flow="store.state.flow"
        :hidden-staves="store.state.hiddenStaves"
      />
    </main>
  </div>
</template>

<style scoped>
.editor-view {
  display: flex;
  height: 100vh;
}

.editor-view__stage {
  flex: 1 1 auto;
  min-width: 0;
  max-width: 1200px;
  padding: var(--space-5);
  overflow: auto;
}
</style>
