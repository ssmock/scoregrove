<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { useDismissable } from './composables/useDismissable';

/**
 * An anchored, dismissable popover: below a trigger element (the duration
 * picker) when `anchor` is given, or at a raw point (the right-click
 * element editor) when `at` is given. Not focus-trapped — lighter-weight
 * than AppDialog, matching a menu rather than a modal; Escape and outside
 * click still dismiss it via the same composable AppDialog uses.
 */
const props = defineProps<{
  open: boolean;
  anchor?: HTMLElement | null;
  at?: { x: number; y: number } | null;
}>();

const emit = defineEmits<{ close: [] }>();

const flyoutRef = ref<HTMLElement | null>(null);
const position = ref({ top: '0px', left: '0px' });
const openRef = computed(() => props.open);

useDismissable(flyoutRef, { active: openRef, onDismiss: () => emit('close') });

/** Positions against the anchor or point, then clamps within the viewport */
function reposition(): void {
  const el = flyoutRef.value;

  if (!el) return;

  const margin = 8;
  const rect = el.getBoundingClientRect();
  let top: number;
  let left: number;

  if (props.anchor) {
    const anchorRect = props.anchor.getBoundingClientRect();

    left = anchorRect.left;
    top = anchorRect.bottom + margin;

    if (top + rect.height > window.innerHeight - margin) {
      top = anchorRect.top - rect.height - margin;
    }
  } else if (props.at) {
    left = props.at.x;
    top = props.at.y;
  } else {
    left = margin;
    top = margin;
  }

  left = Math.min(Math.max(left, margin), window.innerWidth - rect.width - margin);
  top = Math.min(Math.max(top, margin), window.innerHeight - rect.height - margin);

  position.value = { top: `${top}px`, left: `${left}px` };
  el.focus();
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) void nextTick(reposition);
  },
  { immediate: true },
);
</script>

<template>
  <Teleport to="body">
    <div v-if="open" ref="flyoutRef" class="app-flyout" role="menu" tabindex="-1" :style="position">
      <slot />
    </div>
  </Teleport>
</template>

<style scoped>
.app-flyout {
  position: fixed;
  min-width: 10rem;
  padding: var(--space-2);
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  z-index: var(--z-flyout);
}

.app-flyout:focus-visible {
  outline: none;
}
</style>
