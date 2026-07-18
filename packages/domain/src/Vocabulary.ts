import { Result } from './Result';
import { proseList } from './Utils';

/**
 * The functional companion for a closed vocabulary of named symbols
 * (a string-literal union type).
 */
export type Vocabulary<TValue extends string> = {
  values: readonly TValue[];
  is(val: unknown): val is TValue;
  create(fieldName: string, candidate: string | null | undefined): Result<TValue>;
};

/**
 * Builds the shared `values`/`is`/`create` companions for a vocabulary defined by a
 * `{ Name: 'Name' }` member object. Spread the return value into the type's companion
 * const alongside the members themselves.
 */
export function vocabulary<TValue extends string>(
  members: Record<string, TValue>,
): Vocabulary<TValue> {
  const values = Object.values(members);

  const is = (val: unknown): val is TValue =>
    typeof val === 'string' && (values as readonly string[]).includes(val);

  return {
    values,
    is,
    create(fieldName: string, candidate: string | null | undefined): Result<TValue> {
      if (is(candidate)) return Result.ok(candidate);

      return Result.invalid(`${fieldName} must be one of ${proseList([...values], 'or')}`);
    },
  };
}
