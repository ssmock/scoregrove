import { describe, expect, it } from 'vitest';
import { vocabulary } from '../src/Vocabulary';
import { expectInvalid, expectOk } from './helpers';

describe('vocabulary', () => {
  const colors = vocabulary<'Red' | 'Blue'>({ Red: 'Red', Blue: 'Blue' });

  it('lists values in member order', () => {
    expect(colors.values).toEqual(['Red', 'Blue']);
  });

  it('recognizes members', () => {
    expect(colors.is('Red')).toBe(true);
    expect(colors.is('Blue')).toBe(true);
  });

  it('rejects non-members and non-strings', () => {
    expect(colors.is('Green')).toBe(false);
    expect(colors.is(1)).toBe(false);
    expect(colors.is(null)).toBe(false);
  });

  it('creates from a member', () => {
    expect(expectOk(colors.create('Color', 'Red'))).toBe('Red');
  });

  it('rejects a non-member with a prose list of the options', () => {
    const error = expectInvalid(colors.create('Color', 'Green'));
    expect(error.messages).toEqual(['Color must be one of Red or Blue']);
  });

  it('rejects null and undefined candidates', () => {
    expectInvalid(colors.create('Color', null));
    expectInvalid(colors.create('Color', undefined));
  });
});
