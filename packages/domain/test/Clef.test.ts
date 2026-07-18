import { describe, expect, it } from 'vitest';
import { Clef } from '../src/Clef';
import { expectVocabulary } from './helpers';

describe('Clef', () => {
  it('covers the three supported clefs', () => {
    expectVocabulary(Clef, ['Treble', 'Bass', 'Alto']);
  });

  it('exposes members', () => {
    expect(Clef.Treble).toBe('Treble');
    expect(Clef.Bass).toBe('Bass');
    expect(Clef.Alto).toBe('Alto');
  });
});
