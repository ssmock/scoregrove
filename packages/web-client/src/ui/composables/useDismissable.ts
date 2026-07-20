import { onBeforeUnmount, watch, type Ref } from 'vue';

export type DismissableOptions = {
  /** Listeners attach only while this is true */
  active: Ref<boolean>;
  onDismiss: () => void;
};

/**
 * Dismisses on an outside pointer press or Escape, shared by AppDialog and
 * AppFlyout so every overlay closes the same way. Listens on `document` in
 * the capture phase so an inner handler's stopPropagation can't swallow it.
 *
 * Attaching is deferred to a reactive watcher rather than the triggering
 * click itself: Vue flushes watchers on the next microtask, by which point
 * the click that opened the overlay has already finished dispatching, so
 * the same click can never immediately dismiss what it just opened.
 */
export function useDismissable(root: Ref<HTMLElement | null>, options: DismissableOptions): void {
  const handlePointerDown = (event: PointerEvent) => {
    const el = root.value;

    if (el && event.target instanceof Node && !el.contains(event.target)) {
      options.onDismiss();
    }
  };

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') options.onDismiss();
  };

  const detach = () => {
    document.removeEventListener('pointerdown', handlePointerDown, true);
    document.removeEventListener('keydown', handleKeydown, true);
  };

  const attach = () => {
    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeydown, true);
  };

  watch(
    options.active,
    (isActive) => {
      detach();
      if (isActive) attach();
    },
    { immediate: true },
  );

  onBeforeUnmount(detach);
}
