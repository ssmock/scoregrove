import { nextTick, onBeforeUnmount, watch, type Ref } from 'vue';

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const focusableElements = (root: HTMLElement): HTMLElement[] =>
  Array.from(root.querySelectorAll<HTMLElement>(focusableSelector)).filter(
    (el) => el.offsetParent !== null,
  );

/**
 * Traps Tab navigation inside `root` while `active`, moves focus in on
 * activation (first focusable element, or the root itself as a fallback),
 * and restores whatever had focus beforehand on deactivation — the
 * keyboard-accessibility floor for dialogs. Flyouts stay lighter-weight and
 * don't use this (see AppFlyout).
 */
export function useFocusTrap(root: Ref<HTMLElement | null>, active: Ref<boolean>): void {
  let previouslyFocused: HTMLElement | null = null;

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key !== 'Tab' || !root.value) return;

    const focusable = focusableElements(root.value);

    if (!focusable.length) {
      event.preventDefault();

      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const current = document.activeElement;

    if (event.shiftKey && current === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && current === last) {
      event.preventDefault();
      first.focus();
    }
  };

  watch(
    active,
    (isActive) => {
      if (isActive) {
        previouslyFocused = document.activeElement as HTMLElement | null;
        document.addEventListener('keydown', handleKeydown);

        void nextTick(() => {
          const target = root.value ? (focusableElements(root.value)[0] ?? root.value) : null;

          target?.focus();
        });
      } else {
        document.removeEventListener('keydown', handleKeydown);
        previouslyFocused?.focus();
        previouslyFocused = null;
      }
    },
    { immediate: true },
  );

  onBeforeUnmount(() => document.removeEventListener('keydown', handleKeydown));
}
