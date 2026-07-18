import type { Brand } from './Brand';
import { Integer } from './Integer';
import type { Result } from './Result';

/**
 * An integer greater than zero (e.g. a beat count, a repeat pass, or a volta ending number)
 */
export type PositiveInteger = Brand<number, 'PositiveInteger'>;

export const PositiveInteger = {
  is(val: unknown): val is PositiveInteger {
    return Integer.is(val) && val > 0;
  },

  /**
   * Brands the given number without validating it; use only when the value
   * is already known to be a positive integer (e.g. a literal or a prior `is` check)
   */
  of(val: number): PositiveInteger {
    return val as PositiveInteger;
  },

  create(fieldName: string, candidate: number | null | undefined): Result<PositiveInteger> {
    if (candidate == null || !PositiveInteger.is(candidate)) {
      return {
        error: { code: 'Invalid', messages: [`${fieldName} must be a positive integer`] },
      } as Result<PositiveInteger>;
    }

    return { value: PositiveInteger.of(candidate) };
  },
};
