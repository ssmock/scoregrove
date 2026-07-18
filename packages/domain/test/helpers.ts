import { expect } from 'vitest';
import { DomainError } from '../src/DomainError';
import { Result } from '../src/Result';
import type { Vocabulary } from '../src/Vocabulary';

/**
 * Unwraps an ok result, failing the test with the error summary otherwise.
 */
export function expectOk<T>(result: Result<T>): T {
  if (!Result.isOk(result)) {
    throw new Error(`Expected ok, got error: ${DomainError.summarize(result.error)}`);
  }

  return result.value;
}

/**
 * Unwraps an error result, asserting it carries the Invalid code.
 */
export function expectInvalid<T>(result: Result<T>): DomainError {
  if (!Result.isError(result)) {
    throw new Error('Expected an error result, got ok');
  }

  expect(result.error.code).toBe('Invalid');

  return result.error;
}

/**
 * Asserts the standard vocabulary contract: the exact value list, membership
 * via `is` (including non-string rejection), and `create` round-tripping.
 */
export function expectVocabulary<TValue extends string>(
  vocab: Vocabulary<TValue>,
  expectedValues: readonly TValue[],
): void {
  expect(vocab.values).toEqual(expectedValues);

  for (const value of expectedValues) {
    expect(vocab.is(value)).toBe(true);
  }

  expect(vocab.is('NotAMember')).toBe(false);
  expect(vocab.is(42)).toBe(false);
  expect(vocab.is(null)).toBe(false);
  expect(vocab.is(undefined)).toBe(false);

  expect(expectOk(vocab.create('Field', expectedValues[0]))).toBe(expectedValues[0]);

  const error = expectInvalid(vocab.create('Field', 'NotAMember'));
  expect(error.messages[0]).toContain('Field must be one of');
}
