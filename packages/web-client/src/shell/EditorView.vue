<script setup lang="ts">
import { useEditorStore } from '../store/useEditorStore';
import ScoreDisplay from './ScoreDisplay.vue';
import EditorSidebar from './EditorSidebar.vue';

/**
 * Sidebar + the interactive staff: clicking/hovering the staff places or
 * erases per the pallet's active tool/eraser mode, right-click edits an
 * existing note, and the hover-scoped hotkeys are live here — the only
 * `ScoreDisplay` usage with `interactive` set. The score is a dark "screen"
 * readout on a blueprint-grid desk.
 */
const store = useEditorStore();
</script>

<template>
  <div class="editor-view">
    <EditorSidebar />
    <main class="editor-view__stage">
      <div class="editor-view__screen score-scope">
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
  background-color: var(--color-bg);
  background-image:
    linear-gradient(to right, rgb(120 160 200 / 4%) 1px, transparent 1px),
    linear-gradient(to bottom, rgb(120 160 200 / 4%) 1px, transparent 1px);
  background-size: 28px 28px;
}

.editor-view__screen {
  width: 100%;
  max-width: 8.5in;
  min-height: calc(100vh - 2 * var(--space-6));
  padding: var(--space-6);
  border: 1px solid rgb(51 230 210 / 22%);
  border-radius: var(--radius-md);
  box-shadow:
    0 22px 54px rgb(0 0 0 / 55%),
    inset 0 0 80px rgb(51 230 210 / 4%);
}
</style>
