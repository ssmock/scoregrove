import { describe, expect, it } from 'vitest';
import { createCounter, decrement, increment } from '../src/Counter';

describe('Counter', () => {
  it('creates with a default of zero', () => {
    expect(createCounter()).toEqual({ value: 0 });
  });

  it('creates with an initial value', () => {
    expect(createCounter(5)).toEqual({ value: 5 });
  });

  it('increments by one by default', () => {
    expect(increment({ value: 2 })).toEqual({ value: 3 });
  });

  it('increments by a given amount', () => {
    expect(increment({ value: 2 }, 10)).toEqual({ value: 12 });
  });

  it('decrements by one by default', () => {
    expect(decrement({ value: 2 })).toEqual({ value: 1 });
  });

  it('decrements by a given amount', () => {
    expect(decrement({ value: 2 }, 5)).toEqual({ value: -3 });
  });
});
