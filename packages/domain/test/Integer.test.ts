import { describe, expect, it } from 'vitest';
import { Integer } from '../src/Integer';
import { expectInvalid, expectOk } from './helpers';

describe('Integer', () => {
  it('accepts whole numbers, including negatives', () => {
    expect(Integer.is(3)).toBe(true);
    expect(Integer.is(0)).toBe(true);
    expect(Integer.is(-7)).toBe(true);
  });

  it('rejects fractions and non-numbers', () => {
    expect(Integer.is(3.5)).toBe(false);
    expect(Integer.is('3')).toBe(false);
    expect(Integer.is(null)).toBe(false);
    expect(Integer.is(NaN)).toBe(false);
  });

  it('brands via of', () => {
    expect(Integer.of(4)).toBe(4);
  });

  it('creates from a valid candidate', () => {
    expect(expectOk(Integer.create('Count', 4))).toBe(4);
  });

  it('rejects an invalid candidate with the field name', () => {
    const error = expectInvalid(Integer.create('Count', 4.5));
    expect(error.messages).toEqual(['Count must be an integer']);
  });

  it('rejects null and undefined', () => {
    expectInvalid(Integer.create('Count', null));
    expectInvalid(Integer.create('Count', undefined));
  });
});
