<script setup lang="ts">
import { ref } from 'vue';

/**
 * Every clickable action in the editor. `pressed` covers radio-style pallet
 * tools (the parent owns which tool is active and sets it per button); when
 * omitted, no aria-pressed attribute is rendered at all. Click and other
 * native listeners fall through to the root <button> automatically — this
 * component declares no emits of its own.
 */
withDefaults(
  defineProps<{
    variant?: 'default' | 'quiet' | 'danger';
    pressed?: boolean;
    disabled?: boolean;
    type?: 'button' | 'submit';
  }>(),
  { variant: 'default', disabled: false, type: 'button' },
);

/** Exposed so a parent can anchor an AppFlyout to this button via template ref */
const rootEl = ref<HTMLButtonElement | null>(null);

defineExpose({ rootEl });
</script>

<template>
  <button
    ref="rootEl"
    :type="type"
    class="app-button"
    :class="[`app-button--${variant}`, { 'app-button--pressed': pressed }]"
    :aria-pressed="pressed"
    :disabled="disabled"
  >
    <span v-if="$slots.icon" class="app-button__icon"><slot name="icon" /></span>
    <slot />
  </button>
</template>

<style scoped>
.app-button {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  font: inherit;
  font-size: var(--text-base);
  line-height: 1;
  color: var(--color-text);
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition:
    background var(--duration-fast) var(--easing-standard),
    border-color var(--duration-fast) var(--easing-standard);
}

.app-button:hover:not(:disabled) {
  background: var(--color-surface);
}

.app-button:focus-visible {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: 1px;
}

.app-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.app-button--quiet {
  background: transparent;
  border-color: transparent;
}

.app-button--quiet:hover:not(:disabled) {
  background: var(--color-surface);
}

.app-button--danger {
  color: var(--color-danger-text);
  background: var(--color-danger);
  border-color: var(--color-danger);
}

.app-button--danger:hover:not(:disabled) {
  filter: brightness(1.08);
}

.app-button--pressed {
  color: var(--color-accent-text);
  background: var(--color-accent);
  border-color: var(--color-accent);
}

.app-button__icon {
  display: inline-flex;
  align-items: center;
}
</style>
