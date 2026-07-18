import type { Brand } from './Brand';
import { Integer } from './Integer';
import type { Result } from './Result';

/**
 * A non-negative integer (e.g. a length, index, or quantity)
 */
export type Count = Brand<number, 'Count'>;

export const Count = {
  is(val: unknown): val is Count {
    return Integer.is(val) && val >= 0;
  },

  /**
   * Brands the given number without validating it; use only when the value
   * is already known to be a non-negative integer (e.g. a literal or a prior `is` check)
   */
  of(val: number): Count {
    return val as Count;
  },

  create(fieldName: string, candidate: number | null | undefined): Result<Count> {
    if (candidate == null || !Count.is(candidate)) {
      return {
        error: { code: 'Invalid', messages: [`${fieldName} must be a non-negative integer`] },
      } as Result<Count>;
    }

    return { value: Count.of(candidate) };
  },
};
