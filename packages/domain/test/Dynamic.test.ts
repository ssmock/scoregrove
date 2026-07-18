import { describe, expect, it } from 'vitest';
import { Dynamic, DynamicChange, DynamicMark } from '../src/Dynamic';
import { expectVocabulary } from './helpers';

describe('DynamicMark', () => {
  it('covers the marks, softest to loudest, plus accent dynamics', () => {
    expectVocabulary(DynamicMark, [
      'Pianississimo',
      'Pianissimo',
      'Piano',
      'MezzoPiano',
      'MezzoForte',
      'Forte',
      'Fortissimo',
      'Fortississimo',
      'Sforzando',
      'Fortepiano',
    ]);
  });

  it('abbreviates to the printed mark', () => {
    expect(DynamicMark.abbreviate(DynamicMark.Pianississimo)).toBe('ppp');
    expect(DynamicMark.abbreviate(DynamicMark.Pianissimo)).toBe('pp');
    expect(DynamicMark.abbreviate(DynamicMark.Piano)).toBe('p');
    expect(DynamicMark.abbreviate(DynamicMark.MezzoPiano)).toBe('mp');
    expect(DynamicMark.abbreviate(DynamicMark.MezzoForte)).toBe('mf');
    expect(DynamicMark.abbreviate(DynamicMark.Forte)).toBe('f');
    expect(DynamicMark.abbreviate(DynamicMark.Fortissimo)).toBe('ff');
    expect(DynamicMark.abbreviate(DynamicMark.Fortississimo)).toBe('fff');
    expect(DynamicMark.abbreviate(DynamicMark.Sforzando)).toBe('sfz');
    expect(DynamicMark.abbreviate(DynamicMark.Fortepiano)).toBe('fp');
  });
});

describe('DynamicChange', () => {
  it('covers the gradual transitions', () => {
    expectVocabulary(DynamicChange, ['Crescendo', 'Diminuendo']);
  });
});

describe('Dynamic', () => {
  it('unions marks and changes', () => {
    expect(Dynamic.values).toHaveLength(12);
    expect(Dynamic.is(DynamicMark.Forte)).toBe(true);
    expect(Dynamic.is(DynamicChange.Crescendo)).toBe(true);
    expect(Dynamic.is('Loud')).toBe(false);
  });
});
