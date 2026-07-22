<script setup lang="ts">
import { ref } from 'vue';
import AppButton from '../ui/AppButton.vue';
import { useEditorStore } from '../store/useEditorStore';
import ScoreDisplay from './ScoreDisplay.vue';
import StaffDialog from './StaffDialog.vue';
import TransportBar from './TransportBar.vue';

/**
 * Full-bleed, read-only score. Always vertical flow regardless of the
 * stored preference — a display-time override for this view only, not a
 * change to the preference itself (TODO-UX: "revert to vertical flow").
 * The corner menu fades in on hover/focus rather than needing a click to
 * reveal, per TODO-UX's "hovering over the lower left shows a menu."
 */
const store = useEditorStore();
const staffDialogOpen = ref(false);

function print(): void {
  window.print();
}
</script>

<template>
  <div class="performance-view">
    <div class="performance-view__stage">
      <ScoreDisplay
        :score="store.state.score"
        flow="vertical"
        :hidden-staves="store.state.hiddenStaves"
      />
    </div>

    <div class="performance-view__corner">
      <div class="performance-view__menu">
        <AppButton @click="print">Print</AppButton>
        <AppButton @click="staffDialogOpen = true">Staff</AppButton>
        <AppButton @click="store.setView('editor')">Edit</AppButton>
      </div>
    </div>

    <div class="performance-view__transport">
      <TransportBar />
    </div>

    <StaffDialog :open="staffDialogOpen" @close="staffDialogOpen = false" />
  </div>
</template>

<style scoped>
.performance-view {
  position: relative;
  height: 100vh;
  overflow: auto;
}

/* An auto-height wrapper (not the height:100% ScoreDisplay root) so the score
   flows at content height and the extra bottom padding becomes real scroll
   room — letting the last system clear the fixed transport bar. */
.performance-view__stage {
  /* No page-size preference is stored yet, so this guesses US Letter (8.5in
     wide) as the on-screen stand-in for "a page" — printing itself isn't
     bound by this, see print.css. */
  max-width: 8.5in;
  margin: 0 auto;
  padding: var(--space-5) var(--space-5) 6rem;
}

.performance-view__corner {
  position: fixed;
  bottom: 0;
  left: 0;
  padding: var(--space-4);
}

/* A persistent transport pinned bottom-center, clear of the corner menu */
.performance-view__transport {
  position: fixed;
  bottom: var(--space-4);
  left: 50%;
  transform: translateX(-50%);
  width: min(32rem, calc(100% - 12rem));
  padding: var(--space-2) var(--space-3);
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md, 8px);
  box-shadow: var(--shadow-md);
}

.performance-view__menu {
  display: flex;
  flex-direction: column-reverse;
  gap: var(--space-2);
  pointer-events: none;
  opacity: 0;
  transform: translateY(8px);
  transition:
    opacity var(--duration-base) var(--easing-standard),
    transform var(--duration-base) var(--easing-standard);
}

.performance-view__corner:hover .performance-view__menu,
.performance-view__corner:focus-within .performance-view__menu {
  pointer-events: auto;
  opacity: 1;
  transform: translateY(0);
}
</style>
