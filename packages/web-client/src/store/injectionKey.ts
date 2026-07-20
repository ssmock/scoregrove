import type { InjectionKey } from 'vue';
import type { EditorStore } from './editorStore';

/**
 * Provided once at the app root (main.ts), injected wherever a component
 * needs it — no prop-drilling through every layer of the shell.
 */
export const editorStoreKey: InjectionKey<EditorStore> = Symbol('editorStore');
