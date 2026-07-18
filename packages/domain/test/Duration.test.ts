import { describe, expect, it } from 'vitest';
import { DotCount, Duration, NoteValue, Tuplet } from '../src/Duration';
import { Fraction } from '../src/Fraction';
import { PositiveInteger } from '../src/PositiveInteger';
import { expectInvalid, expectOk, expectVocabulary } from './helpers';

describe('NoteValue', () => {
  it('covers the written values, longest to shortest', () => {
    expectVocabulary(NoteValue, [
      'Breve',
      'Whole',
      'Half',
      'Quarter',
      'Eighth',
      'Sixteenth',
      'ThirtySecond',
      'SixtyFourth',
    ]);
  });
});

describe('DotCount', () => {
  it('allows one or two dots', () => {
    expect(DotCount.values).toEqual([1, 2]);
    expect(DotCount.is(1)).toBe(true);
    expect(DotCount.is(2)).toBe(true);
  });

  it('rejects other values', () => {
    expect(DotCount.is(0)).toBe(false);
    expect(DotCount.is(3)).toBe(false);
    expect(DotCount.is('1')).toBe(false);
  });

  it('creates from a valid candidate', () => {
    expect(expectOk(DotCount.create('Dots', 2))).toBe(2);
  });

  it('rejects an invalid candidate', () => {
    const error = expectInvalid(DotCount.create('Dots', 3));
    expect(error.messages).toEqual(['Dots must be 1 (dotted) or 2 (double-dotted)']);
  });
});

describe('Tuplet', () => {
  it('builds a triplet', () => {
    expect(Tuplet.triplet()).toEqual({ count: 3, inSpaceOf: 2 });
  });

  it('creates irregular divisions', () => {
    expect(expectOk(Tuplet.create(3, 2))).toEqual({ count: 3, inSpaceOf: 2 });
    expect(expectOk(Tuplet.create(5, 4))).toEqual({ count: 5, inSpaceOf: 4 });
    expect(expectOk(Tuplet.create(2, 3))).toEqual({ count: 2, inSpaceOf: 3 });
  });

  it('rejects an equal ratio as not irregular', () => {
    const error = expectInvalid(Tuplet.create(4, 4));
    expect(error.messages).toEqual([
      'A tuplet must divide time irregularly; count and inSpaceOf are equal',
    ]);
  });

  it('rejects counts below two', () => {
    expectInvalid(Tuplet.create(1, 2));
    expectInvalid(Tuplet.create(0, 2));
  });

  it('rejects fractional and non-positive parts', () => {
    expectInvalid(Tuplet.create(2.5, 2));
    expectInvalid(Tuplet.create(3, 0));
  });

  it('compares by ratio', () => {
    expect(
      Tuplet.equals(Tuplet.triplet(), Tuplet.of(PositiveInteger.of(3), PositiveInteger.of(2))),
    ).toBe(true);
    expect(
      Tuplet.equals(Tuplet.triplet(), Tuplet.of(PositiveInteger.of(5), PositiveInteger.of(4))),
    ).toBe(false);
  });

  it('formats as a ratio', () => {
    expect(Tuplet.format(Tuplet.triplet())).toBe('3:2');
  });
});

describe('Duration', () => {
  it('omits absent dots and tuplet', () => {
    expect(Duration.of(NoteValue.Quarter)).toEqual({ noteValue: 'Quarter' });
  });

  it('carries dots and tuplet when given', () => {
    expect(Duration.of(NoteValue.Half, { dots: 1 })).toEqual({ noteValue: 'Half', dots: 1 });
    expect(Duration.of(NoteValue.Eighth, { tuplet: Tuplet.triplet() })).toEqual({
      noteValue: 'Eighth',
      tuplet: { count: 3, inSpaceOf: 2 },
    });
  });

  it('compares note value, dots, and tuplet', () => {
    const quarter = Duration.of(NoteValue.Quarter);

    expect(Duration.equals(quarter, Duration.of(NoteValue.Quarter))).toBe(true);
    expect(Duration.equals(quarter, Duration.of(NoteValue.Half))).toBe(false);
    expect(Duration.equals(quarter, Duration.of(NoteValue.Quarter, { dots: 1 }))).toBe(false);
    expect(
      Duration.equals(quarter, Duration.of(NoteValue.Quarter, { tuplet: Tuplet.triplet() })),
    ).toBe(false);
    expect(
      Duration.equals(
        Duration.of(NoteValue.Quarter, { tuplet: Tuplet.triplet() }),
        Duration.of(NoteValue.Quarter, { tuplet: Tuplet.triplet() }),
      ),
    ).toBe(true);
  });

  it('measures written length as a fraction of a whole note', () => {
    const fraction = (d: Duration) => Duration.fractionOfWhole(d);

    expect(fraction(Duration.of(NoteValue.Breve))).toEqual(Fraction.of(2, 1));
    expect(fraction(Duration.of(NoteValue.Whole))).toEqual(Fraction.of(1, 1));
    expect(fraction(Duration.of(NoteValue.Quarter))).toEqual(Fraction.of(1, 4));
    expect(fraction(Duration.of(NoteValue.SixtyFourth))).toEqual(Fraction.of(1, 64));
  });

  it('extends dotted values by 3/2 and 7/4', () => {
    expect(Duration.fractionOfWhole(Duration.of(NoteValue.Half, { dots: 1 }))).toEqual(
      Fraction.of(3, 4),
    );
    expect(Duration.fractionOfWhole(Duration.of(NoteValue.Quarter, { dots: 2 }))).toEqual(
      Fraction.of(7, 16),
    );
  });

  it('shrinks tuplet values by inSpaceOf/count', () => {
    expect(
      Duration.fractionOfWhole(Duration.of(NoteValue.Eighth, { tuplet: Tuplet.triplet() })),
    ).toEqual(Fraction.of(1, 12));
    expect(
      Duration.fractionOfWhole(
        Duration.of(NoteValue.Quarter, { dots: 1, tuplet: Tuplet.triplet() }),
      ),
    ).toEqual(Fraction.of(1, 4));
  });

  it('formats dots and tuplets', () => {
    expect(Duration.format(Duration.of(NoteValue.Quarter))).toBe('Quarter');
    expect(Duration.format(Duration.of(NoteValue.Half, { dots: 1 }))).toBe('dotted Half');
    expect(Duration.format(Duration.of(NoteValue.Half, { dots: 2 }))).toBe('double-dotted Half');
    expect(Duration.format(Duration.of(NoteValue.Eighth, { tuplet: Tuplet.triplet() }))).toBe(
      'Eighth (3:2)',
    );
    expect(
      Duration.format(Duration.of(NoteValue.Quarter, { dots: 1, tuplet: Tuplet.triplet() })),
    ).toBe('dotted Quarter (3:2)');
  });
});
