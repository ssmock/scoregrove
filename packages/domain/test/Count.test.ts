import { describe, expect, it } from 'vitest';
import { Count } from '../src/Count';
import { expectInvalid, expectOk } from './helpers';

describe('Count', () => {
  it('accepts zero and positive integers', () => {
    expect(Count.is(0)).toBe(true);
    expect(Count.is(12)).toBe(true);
  });

  it('rejects negatives, fractions, and non-numbers', () => {
    expect(Count.is(-1)).toBe(false);
    expect(Count.is(2.5)).toBe(false);
    expect(Count.is('2')).toBe(false);
  });

  it('creates from a valid candidate', () => {
    expect(expectOk(Count.create('Total', 0))).toBe(0);
  });

  it('rejects an invalid candidate with the field name', () => {
    const error = expectInvalid(Count.create('Total', -1));
    expect(error.messages).toEqual(['Total must be a non-negative integer']);
  });
});
