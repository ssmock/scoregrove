import { describe, expect, it } from 'vitest';
import { Duration, NoteValue } from '@scoregrove/domain/Duration';
import { Fraction } from '@scoregrove/domain/Fraction';
import { DurationDecomposition } from '../src/DurationDecomposition';

const sumOf = (durations: readonly Duration[]): Fraction =>
  durations.reduce(
    (sum, duration) => Fraction.add(sum, Duration.fractionOfWhole(duration)),
    Fraction.zero(),
  );

describe('DurationDecomposition.decompose', () => {
  it('is empty for zero', () => {
    expect(DurationDecomposition.decompose(Fraction.zero())).toEqual([]);
  });

  it('picks a single whole rest for a whole note', () => {
    expect(DurationDecomposition.decompose(Fraction.of(1, 1))).toEqual([
      Duration.of(NoteValue.Whole),
    ]);
  });

  it('prefers a dotted value when it fits exactly (3/8 → dotted quarter)', () => {
    expect(DurationDecomposition.decompose(Fraction.of(3, 8))).toEqual([
      Duration.of(NoteValue.Quarter, { dots: 1 }),
    ]);
  });

  it('prefers a double-dotted value when it fits exactly (7/16 → double-dotted quarter)', () => {
    expect(DurationDecomposition.decompose(Fraction.of(7, 16))).toEqual([
      Duration.of(NoteValue.Quarter, { dots: 2 }),
    ]);
  });

  it('falls back to multiple values when no single one fits (5/8 → half + eighth)', () => {
    expect(DurationDecomposition.decompose(Fraction.of(5, 8))).toEqual([
      Duration.of(NoteValue.Half),
      Duration.of(NoteValue.Eighth),
    ]);
  });

  it('fills a 3/4 measure with a single dotted half', () => {
    expect(DurationDecomposition.decompose(Fraction.of(3, 4))).toEqual([
      Duration.of(NoteValue.Half, { dots: 1 }),
    ]);
  });

  it('reaches down to a single sixty-fourth', () => {
    expect(DurationDecomposition.decompose(Fraction.of(1, 64))).toEqual([
      Duration.of(NoteValue.SixtyFourth),
    ]);
  });

  it('throws on a negative span', () => {
    expect(() => DurationDecomposition.decompose(Fraction.of(-1, 4))).toThrow();
  });

  it('always sums back exactly to the input, swept across every 64th up to two whole notes', () => {
    // Every multiple of 1/64 is reachable via plain (undotted) values alone
    // — ordinary binary representation — so this sweep covers a genuinely
    // reachable space, unlike finer grains (see below).
    for (let numerator = 1; numerator <= 128; numerator += 1) {
      const target = Fraction.of(numerator, 64);
      const durations = DurationDecomposition.decompose(target);

      expect(Fraction.equals(sumOf(durations), target)).toBe(true);
    }
  });

  it('sums exactly for finer-grained remainders left by dotted short notes', () => {
    // A dotted or double-dotted sixty-fourth (3/128, 7/256) is finer than
    // the plain 1/64 grain, e.g. from merging a plain 64th with an adjacent
    // dotted-64th rest. Not every multiple of 1/128 or 1/256 is reachable
    // this way (nothing in the candidate set is smaller than 1/64, and 1/64
    // itself is *bigger* than these finer fractions), so this checks
    // specific reachable cases rather than sweeping every value.
    expect(DurationDecomposition.decompose(Fraction.of(5, 128))).toEqual([
      Duration.of(NoteValue.SixtyFourth, { dots: 1 }),
      Duration.of(NoteValue.SixtyFourth),
    ]);
    expect(DurationDecomposition.decompose(Fraction.of(7, 256))).toEqual([
      Duration.of(NoteValue.SixtyFourth, { dots: 2 }),
    ]);
  });

  it('throws rather than silently misrepresent a fraction no rest sequence can express exactly', () => {
    // 1/128 alone has no representation in the domain's Duration model at
    // all (the finest value, a plain 64th, is 2/128) — a real, narrow limit
    // of the note-value system itself, not a flaw in the algorithm.
    expect(() => DurationDecomposition.decompose(Fraction.of(1, 128))).toThrow();
  });
});
