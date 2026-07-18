import { describe, it } from 'vitest';
import { NavigationJump, NavigationMark } from '../src/Navigation';
import { expectVocabulary } from './helpers';

describe('NavigationMark', () => {
  it('covers the landmarks', () => {
    expectVocabulary(NavigationMark, ['Segno', 'Coda', 'Fine']);
  });
});

describe('NavigationJump', () => {
  it('covers the jump instructions', () => {
    expectVocabulary(NavigationJump, [
      'DaCapo',
      'DaCapoAlFine',
      'DaCapoAlCoda',
      'DalSegno',
      'DalSegnoAlFine',
      'DalSegnoAlCoda',
      'ToCoda',
    ]);
  });
});
