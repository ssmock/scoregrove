import { describe, expect, it } from 'vitest';
import { Fraction } from '../src/Fraction';
import { BeatUnit, Swing, TimeSignature, TimeSymbol } from '../src/TimeSignature';
import { expectInvalid, expectOk, expectVocabulary } from './helpers';

describe('BeatUnit', () => {
  it('covers the note values that can take the beat', () => {
    expectVocabulary(BeatUnit, ['Whole', 'Half', 'Quarter', 'Eighth', 'Sixteenth', 'ThirtySecond']);
  });

  it('maps each unit to its printed numeral', () => {
    expect(BeatUnit.numeral(BeatUnit.Whole)).toBe(1);
    expect(BeatUnit.numeral(BeatUnit.Half)).toBe(2);
    expect(BeatUnit.numeral(BeatUnit.Quarter)).toBe(4);
    expect(BeatUnit.numeral(BeatUnit.Eighth)).toBe(8);
    expect(BeatUnit.numeral(BeatUnit.Sixteenth)).toBe(16);
    expect(BeatUnit.numeral(BeatUnit.ThirtySecond)).toBe(32);
  });
});

describe('TimeSymbol', () => {
  it('covers common and cut common time', () => {
    expectVocabulary(TimeSymbol, ['Common', 'CutCommon']);
  });
});

describe('Swing', () => {
  it('covers the presets', () => {
    expectVocabulary(Swing, ['Straight', 'LightSwing', 'MediumSwing', 'HardSwing', 'Shuffle']);
  });
});

describe('TimeSignature', () => {
  it('creates a simple signature', () => {
    expect(expectOk(TimeSignature.create(3, BeatUnit.Quarter))).toEqual({
      beats: 3,
      beatUnit: 'Quarter',
    });
  });

  it('rejects non-positive and fractional beat counts', () => {
    const error = expectInvalid(TimeSignature.create(0, BeatUnit.Quarter));
    expect(error.messages).toEqual(['Time signature beat count must be a positive integer']);
    expectInvalid(TimeSignature.create(3.5, BeatUnit.Quarter));
  });

  it('accepts matching symbols', () => {
    expect(expectOk(TimeSignature.create(4, BeatUnit.Quarter, TimeSymbol.Common))).toEqual({
      beats: 4,
      beatUnit: 'Quarter',
      symbol: 'Common',
    });
    expectOk(TimeSignature.create(2, BeatUnit.Half, TimeSymbol.CutCommon));
  });

  it('rejects mismatched symbols', () => {
    const common = expectInvalid(TimeSignature.create(3, BeatUnit.Quarter, TimeSymbol.Common));
    expect(common.messages).toEqual([
      'Common time requires 4 beats with the Quarter note as the beat unit',
    ]);

    const cut = expectInvalid(TimeSignature.create(4, BeatUnit.Quarter, TimeSymbol.CutCommon));
    expect(cut.messages).toEqual([
      'Cut common time requires 2 beats with the Half note as the beat unit',
    ]);
  });

  it('provides the traditional signatures', () => {
    expect(TimeSignature.commonTime()).toEqual({ beats: 4, beatUnit: 'Quarter', symbol: 'Common' });
    expect(TimeSignature.cutCommonTime()).toEqual({
      beats: 2,
      beatUnit: 'Half',
      symbol: 'CutCommon',
    });
  });

  it('compares by beats and beat unit, ignoring the symbol', () => {
    const fourFour = expectOk(TimeSignature.create(4, BeatUnit.Quarter));

    expect(TimeSignature.equals(fourFour, TimeSignature.commonTime())).toBe(true);
    expect(
      TimeSignature.equals(fourFour, expectOk(TimeSignature.create(3, BeatUnit.Quarter))),
    ).toBe(false);
    expect(TimeSignature.equals(fourFour, expectOk(TimeSignature.create(4, BeatUnit.Half)))).toBe(
      false,
    );
  });

  it('measures capacity as a fraction of a whole note', () => {
    expect(TimeSignature.capacity(TimeSignature.commonTime())).toEqual(Fraction.of(1, 1));
    expect(TimeSignature.capacity(expectOk(TimeSignature.create(3, BeatUnit.Quarter)))).toEqual(
      Fraction.of(3, 4),
    );
    expect(TimeSignature.capacity(expectOk(TimeSignature.create(6, BeatUnit.Eighth)))).toEqual(
      Fraction.of(3, 4),
    );
  });

  it('formats numerically or as a symbol', () => {
    expect(TimeSignature.format(expectOk(TimeSignature.create(3, BeatUnit.Quarter)))).toBe('3/4');
    expect(TimeSignature.format(expectOk(TimeSignature.create(6, BeatUnit.Eighth)))).toBe('6/8');
    expect(TimeSignature.format(TimeSignature.commonTime())).toBe('𝄴');
    expect(TimeSignature.format(TimeSignature.cutCommonTime())).toBe('𝄵');
  });
});
