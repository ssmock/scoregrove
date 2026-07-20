import { inject } from 'vue';
import type { EditorStore } from './editorStore';
import { editorStoreKey } from './injectionKey';

/**
 * Injects the store provided at the app root. Throws if called outside
 * that tree — every component that uses this is always a descendant of
 * `App.vue`, so a missing provide means the app was bootstrapped wrong,
 * not a normal runtime case.
 */
export function useEditorStore(): EditorStore {
  const store = inject(editorStoreKey);

  if (!store) throw new Error('useEditorStore() called with no editorStore provided');

  return store;
}
