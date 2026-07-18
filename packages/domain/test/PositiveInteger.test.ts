import { describe, expect, it } from 'vitest';
import { PositiveInteger } from '../src/PositiveInteger';
import { expectInvalid, expectOk } from './helpers';

describe('PositiveInteger', () => {
  it('accepts integers greater than zero', () => {
    expect(PositiveInteger.is(1)).toBe(true);
    expect(PositiveInteger.is(99)).toBe(true);
  });

  it('rejects zero, negatives, fractions, and non-numbers', () => {
    expect(PositiveInteger.is(0)).toBe(false);
    expect(PositiveInteger.is(-2)).toBe(false);
    expect(PositiveInteger.is(1.5)).toBe(false);
    expect(PositiveInteger.is('1')).toBe(false);
  });

  it('creates from a valid candidate', () => {
    expect(expectOk(PositiveInteger.create('Beats', 3))).toBe(3);
  });

  it('rejects an invalid candidate with the field name', () => {
    const error = expectInvalid(PositiveInteger.create('Beats', 0));
    expect(error.messages).toEqual(['Beats must be a positive integer']);
  });
});
