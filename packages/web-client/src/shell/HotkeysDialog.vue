<script setup lang="ts">
import AppDialog from '../ui/AppDialog.vue';

/**
 * A static reference for the interactive staff's hotkeys (see
 * `ScoreDisplay.vue`'s `useHotkeys` call, the single source of truth these
 * mirror) — this list doesn't read from anywhere live, so keep it in sync by
 * hand if that map changes.
 */
defineProps<{ open: boolean }>();

const emit = defineEmits<{ close: [] }>();

const shortcuts: readonly { keys: string; does: string }[] = [
  { keys: 'p', does: 'Pick up the hovered note or rest (eyedropper) and select it for placing' },
  { keys: '-', does: 'Shorten the active tool’s duration' },
  { keys: '=', does: 'Lengthen the active tool’s duration' },
  { keys: 'Backspace / Delete', does: 'Erase the hovered note, rest, or chord tone' },
  { keys: '↑ / ↓', does: 'Transpose the hovered note up or down a semitone' },
  { keys: 'a', does: 'Add a measure at the end of the score' },
  { keys: 's', does: 'Remove the last measure' },
  { keys: 'Ctrl/⌘ + Z', does: 'Undo' },
  { keys: 'Ctrl/⌘ + Shift + Z', does: 'Redo' },
];
</script>

<template>
  <AppDialog :open="open" title="Keyboard Shortcuts" @close="emit('close')">
    <p class="hotkeys-dialog__intro">
      Live in the editor view. "Pick up," erase, and transpose act on whatever the pointer is
      currently over; the rest work regardless of where you're hovering.
    </p>
    <dl class="hotkeys-dialog__list">
      <template v-for="shortcut in shortcuts" :key="shortcut.keys">
        <dt class="hotkeys-dialog__keys">{{ shortcut.keys }}</dt>
        <dd class="hotkeys-dialog__does">{{ shortcut.does }}</dd>
      </template>
    </dl>
  </AppDialog>
</template>

<style scoped>
.hotkeys-dialog__intro {
  margin-top: 0;
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

.hotkeys-dialog__list {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--space-2) var(--space-4);
  margin: 0;
}

.hotkeys-dialog__keys {
  padding: var(--space-1) var(--space-2);
  color: var(--color-text);
  font-family: monospace;
  white-space: nowrap;
  background: var(--color-surface);
  border-radius: var(--radius-sm);
}

.hotkeys-dialog__does {
  margin: 0;
  align-self: center;
}
</style>
