import { describe, it } from 'vitest';
import { ClosingBarline, OpeningBarline } from '../src/Barline';
import { expectVocabulary } from './helpers';

describe('OpeningBarline', () => {
  it('covers the repeat opening', () => {
    expectVocabulary(OpeningBarline, ['RepeatOpen']);
  });
});

describe('ClosingBarline', () => {
  it('covers the closing styles', () => {
    expectVocabulary(ClosingBarline, ['Regular', 'Double', 'Final', 'RepeatClose']);
  });
});
