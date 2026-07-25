<script setup lang="ts">
import { useEditorStore } from '../store/useEditorStore';
import ScoreDisplay from './ScoreDisplay.vue';
import EditorSidebar from './EditorSidebar.vue';

/**
 * Sidebar + the interactive staff: clicking/hovering the staff places or
 * erases per the pallet's active tool/eraser mode, right-click edits an
 * existing note, and the hover-scoped hotkeys are live here — the only
 * `ScoreDisplay` usage with `interactive` set. The score sits on a lit paper
 * sheet floating over the dark desk.
 */
const store = useEditorStore();
</script>

<template>
  <div class="editor-view">
    <EditorSidebar />
    <main class="editor-view__stage">
      <div class="editor-view__sheet score-paper">
        <ScoreDisplay
          interactive
          :score="store.state.score"
          :flow="store.state.flow"
          :hidden-staves="store.state.hiddenStaves"
        />
      </div>
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
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: var(--space-6);
  overflow: auto;
  background:
    radial-gradient(140% 90% at 50% -20%, rgb(255 255 255 / 4%), transparent 55%), var(--color-bg);
}

.editor-view__sheet {
  width: 100%;
  max-width: 8.5in;
  min-height: calc(100vh - 2 * var(--space-6));
  padding: var(--space-6) var(--space-5);
  border-radius: var(--radius-sm);
}
</style>
