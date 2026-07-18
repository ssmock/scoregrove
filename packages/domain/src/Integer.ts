import type { Brand } from './Brand';
import type { Result } from './Result';

export type Integer = Brand<number, 'Integer'>;

export const Integer = {
  is(val: unknown): val is Integer {
    return typeof val === 'number' && Number.isInteger(val);
  },

  /**
   * Brands the given number without validating it; use only when the value
   * is already known to be an integer (e.g. a literal or a prior `is` check)
   */
  of(val: number): Integer {
    return val as Integer;
  },

  create(fieldName: string, candidate: number | null | undefined): Result<Integer> {
    if (candidate == null || !Integer.is(candidate)) {
      return {
        error: { code: 'Invalid', messages: [`${fieldName} must be an integer`] },
      } as Result<Integer>;
    }

    return { value: Integer.of(candidate) };
  },
};
