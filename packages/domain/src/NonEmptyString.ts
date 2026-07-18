import type { Brand } from './Brand';
import type { Result } from './Result';

export type NonEmptyString = Brand<string, 'NonEmptyString'>;

export const NonEmptyString = {
  is(val: unknown): val is NonEmptyString {
    return typeof val === 'string' && val.trim().length > 0;
  },

  /**
   * Brands the given string without validating it; use only when the value
   * is already known to be non-empty (e.g. a literal or a prior `is` check)
   */
  of(val: string): NonEmptyString {
    return val as NonEmptyString;
  },

  create(fieldName: string, candidate: string | null | undefined): Result<NonEmptyString> {
    if (candidate == null || !NonEmptyString.is(candidate)) {
      return {
        error: { code: 'Invalid', messages: [`${fieldName} is required`] },
      } as Result<NonEmptyString>;
    }

    return { value: NonEmptyString.of(candidate) };
  },
};
