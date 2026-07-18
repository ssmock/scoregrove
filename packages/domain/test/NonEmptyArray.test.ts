import { describe, expect, it } from 'vitest';
import { NonEmptyArray } from '../src/NonEmptyArray';
import { NonEmptyString } from '../src/NonEmptyString';
import { expectInvalid, expectOk } from './helpers';

describe('NonEmptyArray', () => {
  it('accepts arrays with at least one item', () => {
    expect(NonEmptyArray.is([1])).toBe(true);
    expect(NonEmptyArray.is(['a', 'b'])).toBe(true);
  });

  it('rejects empty arrays and non-arrays', () => {
    expect(NonEmptyArray.is([])).toBe(false);
    expect(NonEmptyArray.is(null)).toBe(false);
    expect(NonEmptyArray.is(undefined)).toBe(false);
  });

  it('creates from a valid candidate', () => {
    expect(expectOk(NonEmptyArray.create([1, 2]))).toEqual([1, 2]);
  });

  it('rejects an empty list using the default label', () => {
    const error = expectInvalid(NonEmptyArray.create([]));
    expect(error.messages).toEqual(['list must contain at least one item']);
  });

  it('rejects an empty list using the given field name', () => {
    const error = expectInvalid(NonEmptyArray.create([], NonEmptyString.of('Pitches')));
    expect(error.messages).toEqual(['Pitches must contain at least one item']);
  });

  it('rejects null', () => {
    expectInvalid(NonEmptyArray.create(null));
  });
});
