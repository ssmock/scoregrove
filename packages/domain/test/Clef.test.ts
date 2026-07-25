import { describe, expect, it } from 'vitest';
import { Clef } from '../src/Clef';
import { expectVocabulary } from './helpers';

describe('Clef', () => {
  it('covers the four supported clefs', () => {
    expectVocabulary(Clef, ['Treble', 'Bass', 'Alto', 'Tenor']);
  });

  it('exposes members', () => {
    expect(Clef.Treble).toBe('Treble');
    expect(Clef.Bass).toBe('Bass');
    expect(Clef.Alto).toBe('Alto');
    expect(Clef.Tenor).toBe('Tenor');
  });
});
