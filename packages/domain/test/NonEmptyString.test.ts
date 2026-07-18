import { describe, expect, it } from 'vitest';
import { NonEmptyString } from '../src/NonEmptyString';
import { expectInvalid, expectOk } from './helpers';

describe('NonEmptyString', () => {
  it('accepts strings with non-whitespace content', () => {
    expect(NonEmptyString.is('a')).toBe(true);
    expect(NonEmptyString.is(' padded ')).toBe(true);
  });

  it('rejects empty and whitespace-only strings, and non-strings', () => {
    expect(NonEmptyString.is('')).toBe(false);
    expect(NonEmptyString.is('   ')).toBe(false);
    expect(NonEmptyString.is(3)).toBe(false);
    expect(NonEmptyString.is(null)).toBe(false);
  });

  it('creates from a valid candidate', () => {
    expect(expectOk(NonEmptyString.create('Title', 'Prelude'))).toBe('Prelude');
  });

  it('rejects an invalid candidate with the field name', () => {
    const error = expectInvalid(NonEmptyString.create('Title', ''));
    expect(error.messages).toEqual(['Title is required']);
  });
});
