import { Integer } from './Integer';
import { PositiveInteger } from './PositiveInteger';

/**
 * An exact rational number, kept in lowest terms. Used for written-duration
 * arithmetic (fractions of a whole note), where floating point would make
 * equality checks unreliable (a triplet eighth is exactly 1/12). This is
 * structural notation math, not a mapping to performance parameters.
 */
export type Fraction = {
  numerator: Integer;
  denominator: PositiveInteger;
};

const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));

export const Fraction = {
  /**
   * Builds a normalized fraction. Throws on a zero or fractional denominator —
   * that is a programming error, not a validation case.
   */
  of(numerator: number, denominator: number): Fraction {
    if (!Integer.is(numerator) || !PositiveInteger.is(denominator)) {
      throw Error(`Invalid fraction: ${numerator}/${denominator}`);
    }

    const divisor = gcd(numerator, denominator) || 1;

    return {
      numerator: Integer.of(numerator / divisor),
      denominator: PositiveInteger.of(denominator / divisor),
    };
  },

  zero(): Fraction {
    return Fraction.of(0, 1);
  },

  add(a: Fraction, b: Fraction): Fraction {
    return Fraction.of(
      a.numerator * b.denominator + b.numerator * a.denominator,
      a.denominator * b.denominator,
    );
  },

  /**
   * a − b, exact. May be negative — a fraction's numerator carries the sign.
   */
  subtract(a: Fraction, b: Fraction): Fraction {
    return Fraction.add(a, Fraction.of(-b.numerator, b.denominator));
  },

  multiply(a: Fraction, b: Fraction): Fraction {
    return Fraction.of(a.numerator * b.numerator, a.denominator * b.denominator);
  },

  /**
   * Negative when a < b, zero when equal, positive when a > b
   */
  compare(a: Fraction, b: Fraction): number {
    return a.numerator * b.denominator - b.numerator * a.denominator;
  },

  equals(a: Fraction, b: Fraction): boolean {
    return Fraction.compare(a, b) === 0;
  },

  format(fraction: Fraction): string {
    return `${fraction.numerator}/${fraction.denominator}`;
  },
};
