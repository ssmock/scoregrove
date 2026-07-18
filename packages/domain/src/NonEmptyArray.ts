import type { Brand } from './Brand';
import type { NonEmptyString } from './NonEmptyString';
import type { Result } from './Result';

export type NonEmptyArray<T> = Brand<T[], 'NonEmptyArray'>;

export const NonEmptyArray = {
  is<T>(val: T[] | null | undefined): val is NonEmptyArray<T> {
    return Array.isArray(val) && val.length > 0;
  },

  /**
   * Brands the given array without validating it; use only when the value
   * is already known to be non-empty (e.g. a literal or a prior `is` check)
   */
  of<T>(val: T[]): NonEmptyArray<T> {
    return val as NonEmptyArray<T>;
  },

  create<T>(list: T[] | null | undefined, fieldName?: NonEmptyString): Result<NonEmptyArray<T>> {
    if (!NonEmptyArray.is(list)) {
      return {
        error: {
          code: 'Invalid',
          messages: [`${fieldName ?? 'list'} must contain at least one item`],
        },
      } as Result<NonEmptyArray<T>>;
    }

    return { value: NonEmptyArray.of(list) };
  },
};
