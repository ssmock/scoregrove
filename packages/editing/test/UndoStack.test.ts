import { describe, expect, it } from 'vitest';
import { UndoStack } from '../src/UndoStack';

describe('UndoStack', () => {
  it('starts with only a present value', () => {
    const stack = UndoStack.of('a');

    expect(stack).toEqual({ past: [], present: 'a', future: [] });
    expect(UndoStack.canUndo(stack)).toBe(false);
    expect(UndoStack.canRedo(stack)).toBe(false);
  });

  it('pushes onto past and becomes the new present', () => {
    const stack = UndoStack.push(UndoStack.of('a'), 'b');

    expect(stack).toEqual({ past: ['a'], present: 'b', future: [] });
    expect(UndoStack.canUndo(stack)).toBe(true);
  });

  it('undoes back through pushed history', () => {
    let stack = UndoStack.of('a');

    stack = UndoStack.push(stack, 'b');
    stack = UndoStack.push(stack, 'c');
    stack = UndoStack.undo(stack);

    expect(stack).toEqual({ past: ['a'], present: 'b', future: ['c'] });

    stack = UndoStack.undo(stack);
    expect(stack).toEqual({ past: [], present: 'a', future: ['b', 'c'] });
  });

  it('is a no-op to undo with nothing in the past', () => {
    const stack = UndoStack.of('a');

    expect(UndoStack.undo(stack)).toBe(stack);
  });

  it('redoes forward through undone history', () => {
    let stack = UndoStack.of('a');

    stack = UndoStack.push(stack, 'b');
    stack = UndoStack.undo(stack);
    stack = UndoStack.redo(stack);

    expect(stack).toEqual({ past: ['a'], present: 'b', future: [] });
  });

  it('is a no-op to redo with nothing in the future', () => {
    const stack = UndoStack.push(UndoStack.of('a'), 'b');

    expect(UndoStack.redo(stack)).toBe(stack);
  });

  it('abandons redo history on a fresh push', () => {
    let stack = UndoStack.of('a');

    stack = UndoStack.push(stack, 'b');
    stack = UndoStack.undo(stack);
    expect(UndoStack.canRedo(stack)).toBe(true);

    stack = UndoStack.push(stack, 'c');
    expect(stack).toEqual({ past: ['a'], present: 'c', future: [] });
    expect(UndoStack.canRedo(stack)).toBe(false);
  });

  it('caps past history, dropping the oldest entries', () => {
    let stack = UndoStack.of(0);

    for (let i = 1; i <= 5; i += 1) {
      stack = UndoStack.push(stack, i, 3);
    }

    // Only the most recent 3 prior values survive
    expect(stack.past).toEqual([2, 3, 4]);
    expect(stack.present).toBe(5);
  });
});
