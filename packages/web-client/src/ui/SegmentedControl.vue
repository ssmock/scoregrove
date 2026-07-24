<script setup lang="ts">
import type { GlyphName } from '@scoregrove/engraving/Bravura';
import MusicIcon from './MusicIcon.vue';

/**
 * A connected row of mutually-exclusive options — the classic segmented
 * control. One option is active at a time (or none, when `modelValue` matches
 * nothing), filled with the accent. Used for the view switch and the pallet's
 * note/rest, stacking, and eraser choices, so they read as one compact control
 * rather than a scatter of separate buttons. An option may carry a music glyph,
 * a text label, or both.
 */
defineProps<{
  options: readonly { value: string; label?: string; glyph?: GlyphName; title?: string }[];
  modelValue: string | null;
  ariaLabel?: string;
  /** Stretch to fill the container, splitting the width evenly across options */
  stretch?: boolean;
  /** A quieter, smaller look for a secondary modifier — muted, no accent fill */
  quiet?: boolean;
  iconSize?: number;
}>();

defineEmits<{ 'update:modelValue': [string] }>();
</script>

<template>
  <div
    class="segmented"
    :class="{ 'segmented--stretch': stretch, 'segmented--quiet': quiet }"
    role="group"
    :aria-label="ariaLabel"
  >
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      class="segmented__option"
      :class="{ 'segmented__option--active': option.value === modelValue }"
      :aria-pressed="option.value === modelValue"
      :title="option.title"
      @click="$emit('update:modelValue', option.value)"
    >
      <MusicIcon v-if="option.glyph" :glyph="option.glyph" :size="iconSize ?? 16" />
      <span v-if="option.label">{{ option.label }}</span>
    </button>
  </div>
</template>

<style scoped>
.segmented {
  display: inline-flex;
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.segmented--stretch {
  display: flex;
  width: 100%;
}

.segmented__option {
  flex: 1 1 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  font: inherit;
  font-size: var(--text-sm);
  line-height: 1;
  color: var(--color-text);
  background: transparent;
  border: none;
  border-left: 1px solid var(--color-border);
  cursor: pointer;
  white-space: nowrap;
  transition: background var(--duration-fast) var(--easing-standard);
}

.segmented__option:first-child {
  border-left: none;
}

.segmented__option:hover:not(.segmented__option--active) {
  background: var(--color-surface);
}

.segmented__option--active {
  color: var(--color-accent-text);
  background: var(--color-accent);
}

.segmented__option:focus-visible {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: -2px;
}

/* Quiet: a secondary modifier that shouldn't compete with the primary tools —
   recessed, muted, and marking its active option softly rather than filling. */
.segmented--quiet {
  background: var(--color-surface);
  border-color: transparent;
  border-radius: var(--radius-sm);
}

.segmented--quiet .segmented__option {
  padding: var(--space-1) var(--space-2);
  color: var(--color-text-muted);
  border-left: none;
}

.segmented--quiet .segmented__option:hover:not(.segmented__option--active) {
  color: var(--color-text);
  background: transparent;
}

.segmented--quiet .segmented__option--active {
  color: var(--color-accent);
  background: var(--color-surface-raised);
  font-weight: 600;
}
</style>
