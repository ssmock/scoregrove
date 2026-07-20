import { ref, watch, onBeforeUnmount, type Ref } from 'vue';

export type HotkeyMap = Record<string, (event: KeyboardEvent) => void>;

const editableTags = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

const isEditableTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement && (editableTags.has(target.tagName) || target.isContentEditable);

/**
 * Declarative `event.key` → handler bindings, active only while `active` is
 * true (default always) and only when focus isn't in an editable field, so
 * typing a project name never triggers a shortcut. The interactive staff's
 * hover-scoped editing hotkeys ("p", "-"/"=", arrows) layer their own
 * hover-target `active` ref on top of this same primitive.
 */
export function useHotkeys(map: HotkeyMap, active?: Ref<boolean>): void {
  const isActive = active ?? ref(true);

  const handleKeydown = (event: KeyboardEvent) => {
    if (isEditableTarget(event.target)) return;

    const handler = map[event.key];

    if (handler) handler(event);
  };

  watch(
    isActive,
    (nowActive) => {
      document.removeEventListener('keydown', handleKeydown);
      if (nowActive) document.addEventListener('keydown', handleKeydown);
    },
    { immediate: true },
  );

  onBeforeUnmount(() => document.removeEventListener('keydown', handleKeydown));
}
