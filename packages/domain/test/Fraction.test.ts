import { describe, expect, it } from 'vitest';
import { Fraction } from '../src/Fraction';

describe('Fraction', () => {
  it('normalizes to lowest terms', () => {
    expect(Fraction.of(2, 4)).toEqual({ numerator: 1, denominator: 2 });
    expect(Fraction.of(6, 8)).toEqual({ numerator: 3, denominator: 4 });
    expect(Fraction.of(0, 5)).toEqual({ numerator: 0, denominator: 1 });
  });

  it('throws on invalid parts', () => {
    expect(() => Fraction.of(1, 0)).toThrow();
    expect(() => Fraction.of(1.5, 2)).toThrow();
    expect(() => Fraction.of(1, -2)).toThrow();
  });

  it('provides zero', () => {
    expect(Fraction.zero()).toEqual({ numerator: 0, denominator: 1 });
  });

  it('adds exactly', () => {
    expect(Fraction.add(Fraction.of(1, 4), Fraction.of(1, 4))).toEqual(Fraction.of(1, 2));
    expect(Fraction.add(Fraction.of(1, 8), Fraction.of(1, 12))).toEqual(Fraction.of(5, 24));
  });

  it('multiplies exactly', () => {
    expect(Fraction.multiply(Fraction.of(1, 8), Fraction.of(2, 3))).toEqual(Fraction.of(1, 12));
    expect(Fraction.multiply(Fraction.of(1, 4), Fraction.of(3, 2))).toEqual(Fraction.of(3, 8));
  });

  it('compares by value', () => {
    expect(Fraction.compare(Fraction.of(1, 4), Fraction.of(1, 4))).toBe(0);
    expect(Fraction.compare(Fraction.of(1, 4), Fraction.of(1, 2))).toBeLessThan(0);
    expect(Fraction.compare(Fraction.of(3, 4), Fraction.of(1, 2))).toBeGreaterThan(0);
  });

  it('treats equivalent fractions as equal', () => {
    expect(Fraction.equals(Fraction.of(6, 8), Fraction.of(3, 4))).toBe(true);
    expect(Fraction.equals(Fraction.of(1, 3), Fraction.of(1, 4))).toBe(false);
  });

  it('formats in lowest terms', () => {
    expect(Fraction.format(Fraction.of(6, 8))).toBe('3/4');
    expect(Fraction.format(Fraction.of(2, 1))).toBe('2/1');
  });
});
