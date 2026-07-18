import { describe, expect, it } from 'vitest';
import { Tempo, TempoChange, TempoMarking } from '../src/Tempo';
import { expectVocabulary } from './helpers';

describe('TempoMarking', () => {
  it('covers the traditional markings, slowest to fastest', () => {
    expectVocabulary(TempoMarking, [
      'Larghissimo',
      'Grave',
      'Largo',
      'Larghetto',
      'Adagio',
      'Adagietto',
      'Andante',
      'Andantino',
      'Moderato',
      'Allegretto',
      'Allegro',
      'Vivace',
      'Vivacissimo',
      'Presto',
      'Prestissimo',
    ]);
  });
});

describe('TempoChange', () => {
  it('covers the change instructions', () => {
    expectVocabulary(TempoChange, [
      'Accelerando',
      'Ritardando',
      'Rallentando',
      'Ritenuto',
      'ATempo',
    ]);
  });
});

describe('Tempo', () => {
  it('unions markings and changes', () => {
    expect(Tempo.values).toHaveLength(20);
    expect(Tempo.is(TempoMarking.Allegro)).toBe(true);
    expect(Tempo.is(TempoChange.Ritardando)).toBe(true);
    expect(Tempo.is('Fast')).toBe(false);
  });
});
