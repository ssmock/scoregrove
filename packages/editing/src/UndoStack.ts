/**
 * A generic snapshot-based undo/redo stack. Editing state is plain JSON
 * (a Score), so a snapshot is just a reference to a prior value — no diffing
 * or command-replay machinery needed.
 */
export type UndoStack<T> = {
  past: readonly T[];
  present: T;
  future: readonly T[];
};

/** Past entries kept before the oldest is dropped */
const defaultCap = 200;

export const UndoStack = {
  of<T>(initial: T): UndoStack<T> {
    return { past: [], present: initial, future: [] };
  },

  /**
   * Records a new present state. Clears redo history — the conventional
   * behavior: making a fresh edit after undoing abandons the undone branch
   * rather than trying to reconcile it. `cap` bounds how far back undo can
   * reach, so a long editing session doesn't grow the history unboundedly.
   */
  push<T>(stack: UndoStack<T>, next: T, cap: number = defaultCap): UndoStack<T> {
    return { past: [...stack.past, stack.present].slice(-cap), present: next, future: [] };
  },

  canUndo<T>(stack: UndoStack<T>): boolean {
    return stack.past.length > 0;
  },

  canRedo<T>(stack: UndoStack<T>): boolean {
    return stack.future.length > 0;
  },

  /** A no-op (not an error) when there's nothing to undo */
  undo<T>(stack: UndoStack<T>): UndoStack<T> {
    if (!UndoStack.canUndo(stack)) return stack;

    return {
      past: stack.past.slice(0, -1),
      present: stack.past[stack.past.length - 1],
      future: [stack.present, ...stack.future],
    };
  },

  /** A no-op (not an error) when there's nothing to redo */
  redo<T>(stack: UndoStack<T>): UndoStack<T> {
    if (!UndoStack.canRedo(stack)) return stack;

    return {
      past: [...stack.past, stack.present],
      present: stack.future[0],
      future: stack.future.slice(1),
    };
  },
};
