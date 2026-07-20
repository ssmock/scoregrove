import { provide } from 'vue';
import type { Decorator } from '@storybook/vue3-vite';
import type { Score } from '@scoregrove/domain/Score';
import { createEditorStore, type EditorStore } from './editorStore';
import { editorStoreKey } from './injectionKey';

/**
 * Provides a fresh editor store to a story's component tree, the same way
 * main.ts provides one to the real app — so any component that injects the
 * store (via useEditorStore) renders in Storybook without a real app
 * bootstrapping it. `configure` can reach into the store before render
 * (e.g. to place a few notes so a story isn't just a blank measure).
 */
export const withEditorStore = (
  args: { initial?: Score; configure?: (store: EditorStore) => void } = {},
): Decorator => {
  return (story) => ({
    components: { story },
    setup() {
      const store = createEditorStore(args.initial);

      args.configure?.(store);
      provide(editorStoreKey, store);
    },
    template: '<story />',
  });
};
