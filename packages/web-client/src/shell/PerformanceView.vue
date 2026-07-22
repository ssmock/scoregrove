<script setup lang="ts">
import { ref } from 'vue';
import AppButton from '../ui/AppButton.vue';
import { useEditorStore } from '../store/useEditorStore';
import ScoreDisplay from './ScoreDisplay.vue';
import StaffDialog from './StaffDialog.vue';

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
    <ScoreDisplay
      class="performance-view__stage"
      :score="store.state.score"
      flow="vertical"
      :hidden-staves="store.state.hiddenStaves"
    />

    <div class="performance-view__corner">
      <div class="performance-view__menu">
        <AppButton @click="print">Print</AppButton>
        <AppButton @click="staffDialogOpen = true">Staff</AppButton>
        <AppButton @click="store.setView('editor')">Edit</AppButton>
      </div>
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

.performance-view__stage {
  /* No page-size preference is stored yet, so this guesses US Letter (8.5in
     wide) as the on-screen stand-in for "a page" — printing itself isn't
     bound by this, see print.css. */
  max-width: 8.5in;
  margin: 0 auto;
  padding: var(--space-5);
}

.performance-view__corner {
  position: fixed;
  bottom: 0;
  left: 0;
  padding: var(--space-4);
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
