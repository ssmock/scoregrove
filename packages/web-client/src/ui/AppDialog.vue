<script setup lang="ts">
import { computed, ref } from 'vue';
import { useDismissable } from './composables/useDismissable';
import { useFocusTrap } from './composables/useFocusTrap';
import AppButton from './AppButton.vue';

/**
 * A modal dialog: teleported over the whole page, focus-trapped while open,
 * dismissed by Escape or a click on the overlay (unless `dismissable` is
 * false — e.g. a dialog that demands an explicit choice). Composed by
 * ConfirmDialog; used directly for the staff-setup dialog.
 */
const props = withDefaults(
  defineProps<{ open: boolean; title?: string; dismissable?: boolean }>(),
  { title: undefined, dismissable: true },
);

const emit = defineEmits<{ close: [] }>();

const dialogRef = ref<HTMLElement | null>(null);
const openRef = computed(() => props.open);
const dismissActive = computed(() => props.open && props.dismissable);

useFocusTrap(dialogRef, openRef);
useDismissable(dialogRef, { active: dismissActive, onDismiss: () => emit('close') });
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="app-dialog-overlay">
      <div
        ref="dialogRef"
        class="app-dialog"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
        tabindex="-1"
      >
        <header v-if="title || dismissable" class="app-dialog__header">
          <h2 v-if="title" class="app-dialog__title">{{ title }}</h2>
          <AppButton
            v-if="dismissable"
            variant="quiet"
            aria-label="Close"
            class="app-dialog__close"
            @click="emit('close')"
          >
            &times;
          </AppButton>
        </header>
        <div class="app-dialog__body">
          <slot />
        </div>
        <footer v-if="$slots.footer" class="app-dialog__footer">
          <slot name="footer" />
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.app-dialog-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  background: var(--color-overlay);
  z-index: var(--z-overlay);
}

.app-dialog {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 32rem;
  max-height: calc(100vh - var(--space-6));
  overflow: hidden;
  background: var(--color-surface-raised);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  z-index: var(--z-dialog);
}

.app-dialog:focus-visible {
  outline: none;
}

.app-dialog__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4);
  border-bottom: 1px solid var(--color-border);
}

.app-dialog__title {
  margin: 0;
  font-size: var(--text-lg);
  font-weight: 600;
}

.app-dialog__close {
  margin-left: auto;
  padding: var(--space-1) var(--space-2);
  font-size: var(--text-lg);
  line-height: 1;
}

.app-dialog__body {
  padding: var(--space-4);
  overflow-y: auto;
}

.app-dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  padding: var(--space-4);
  border-top: 1px solid var(--color-border);
}
</style>
