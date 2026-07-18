import { DomainError, DomainErrorCode, LabeledError, LabelFunction } from './DomainError';
import type { Candidate } from './UtilityTypes';
import { alwaysArray, compactMap, keysOf, reduceDistinct } from './Utils';
import { Integer } from './Integer';
import { NonEmptyArray } from './NonEmptyArray';
import { NonEmptyString } from './NonEmptyString';

export type Result<T> = { value: T } | { error: DomainError };

export type CreateFn<TCandidate, TResult> = (c: TCandidate) => Result<TResult>;

export type CreateCompositeFn<TCandidate, TResult> = (c: TCandidate) => CompositeResult<TResult>;

export const Result = {
  pickError<T>(r: Result<T>): DomainError | undefined {
    return Result.isError(r) ? r.error : undefined;
  },

  pickErrors(...results: Result<unknown>[]): DomainError[] {
    return results.filter(Result.isError).map((r) => r.error);
  },

  /**
   * Picks errors from the given result list, and labels them with the given function.
   */
  labelErrors<T>(labelFn: LabelFunction, results: Result<T>[]): LabeledError[] {
    return results.reduce((agg: LabeledError[], result, i) => {
      if (Result.isError(result)) {
        agg.push({
          label: labelFn(result.error, i),
          error: result.error,
        });
      }

      return agg;
    }, []);
  },

  pickValue<T>(r: Result<T>): T | undefined {
    return Result.isOk(r) ? r.value : undefined;
  },

  pickValues<T>(results: Result<T>[]): T[] {
    return compactMap((result) => {
      if (!Result.isOk(result)) return null;
      return result.value;
    }, results);
  },

  // TODO: Use this more places
  /**
   * Uses the given `create` function to validate each entry in the given list, aggregating
   * the values, or validation errors into a single result.
   *
   * @param create - A function that creates a validated `Result` for the given type
   * @param noun - A noun to use in error messages; should be singular and capitalized
   * @param list - The list to validate
   */
  validateRequiredListField: <TCandidate, TResult>(
    create: (c: TCandidate) => Result<TResult>,
    noun: string,
    list: TCandidate[] | null | undefined,
  ): Result<TResult[]> => {
    if (!list) return Result.invalid([`${noun} list is required`]);

    const results = list.map(create);

    const labeledErrors = Result.labelErrors((_e, i) => `${noun} ${i + 1}`, results);

    if (labeledErrors.length) {
      const error = DomainError.aggregate(DomainErrorCode.Invalid, labeledErrors);

      return { error };
    }

    const values = Result.pickValues(results);

    return {
      value: values,
    };
  },

  // TODO: Use this more places
  /**
   * Uses the given `create` function to validate each entry in the given list, aggregating
   * the values, or validation errors.
   *
   * @param create - A function that creates a validated `Result` for the given type
   * @param noun - A noun to use in error messages; should be singular and capitalized
   * @param list - The list to validate
   */
  validateOptionalListField: <TCandidate, TResult>(
    create: (c: TCandidate) => Result<TResult>,
    noun: string,
    list: TCandidate[] | null | undefined,
  ): Result<TResult[]> => {
    if (!list) return { value: [] };

    return Result.validateRequiredListField(create, noun, list);
  },

  /**
   * Provides a new result of the given type with the error from the given source
   */
  mapError<TResult>(r: { error: DomainError }): Result<TResult> {
    return { error: r.error };
  },

  map<TSource, TResult>(r: Result<TSource>, map: (s: TSource) => TResult): Result<TResult> {
    if (Result.isError(r)) return r;

    return Result.ok(map(r.value));
  },

  mapDistinctArray<T>(result: Result<T[]>): Result<T[]> {
    if (!Result.isOk(result)) return result;

    return Result.ok(result.value.reduce(reduceDistinct, [] as T[]));
  },

  mapDistinctNonEmptyArray<T>(result: Result<NonEmptyArray<T>>): Result<NonEmptyArray<T>> {
    if (!Result.isOk(result)) return result;

    const distinct = result.value.reduce(reduceDistinct, [] as T[]) as NonEmptyArray<T>;

    return Result.ok(distinct);
  },

  createMaybe<TCandidate, TResult>(
    createFn: CreateFn<TCandidate, TResult>,
    val: TCandidate | null | undefined,

    /**
     * When given and evaluates to false, returns Result<null>;
     * useful with empty strings, arrays, and the like
     */
    hasValue?: (val: TCandidate) => boolean,
  ): Result<TResult | null> {
    if (val == null) return Result.ok(null);
    if (typeof hasValue === 'function' && !hasValue(val)) return Result.ok(null);

    return createFn(val);
  },

  createStringMaybe<TCandidate extends string, TResult>(
    createFn: CreateFn<TCandidate, TResult>,
    val: TCandidate | null | undefined,
  ): Result<TResult | null> {
    return Result.createMaybe(createFn, val, (str) => !!str?.trim().length);
  },

  invalid<TResult>(messages: string | string[]): Result<TResult> {
    return {
      error: DomainError.invalid(messages),
    };
  },

  integrationFailed<TResult>(messages: string | string[]): Result<TResult> {
    return {
      error: DomainError.integrationFailed(messages),
    };
  },

  tryCreateMany<TCandidate, TResult>(
    createFn: CreateFn<TCandidate, TResult>,
    labelFn: (err: DomainError, itemIndex: number) => string,
    candidates: TCandidate[],
  ): Result<TResult[]> {
    const results = candidates.map(createFn);

    return Result.fromMany(labelFn, results);
  },

  tryCreateManyNonEmpty<TCandidate, TResult>(
    createFn: CreateFn<TCandidate, TResult>,
    labelFn: (err: DomainError, itemIndex: number) => string,
    candidates: TCandidate[],
    fieldName?: NonEmptyString,
  ): Result<NonEmptyArray<TResult>> {
    const results = candidates.map(createFn);

    return Result.fromManyNonEmpty(labelFn, results, fieldName);
  },

  fromMany<TResult>(
    labelFn: (err: DomainError, itemIndex: number) => string,
    results: Result<TResult>[],
  ): Result<TResult[]> {
    const errors = Result.labelErrors(labelFn, results);

    if (errors.length) {
      const error = DomainError.aggregate(DomainErrorCode.Invalid, errors);

      return {
        error,
      };
    }

    return Result.ok(Result.pickValues(results));
  },

  fromManyNonEmpty<TResult>(
    labelFn: (err: DomainError, itemIndex: number) => string,
    results: Result<TResult>[],
    fieldName?: NonEmptyString,
  ): Result<NonEmptyArray<TResult>> {
    const errors = Result.labelErrors(labelFn, results);

    if (errors.length) {
      const error = DomainError.aggregate(DomainErrorCode.Invalid, errors);

      return {
        error,
      };
    }

    return NonEmptyArray.create(Result.pickValues(results), fieldName);
  },

  fromComposite<TResult>(composite: CompositeResult<TResult>): Result<TResult> {
    return CompositeResultInternal.flatten(composite);
  },

  fromDefinition<TResult>(
    definition: CompositeResultDefinition<TResult>,
    candidate: Candidate<Partial<TResult>>,
  ): Result<TResult> {
    return CompositeResultDefinition.toResult(definition, candidate);
  },

  ok<TResult>(value: TResult): Result<TResult> {
    return { value };
  },

  okNoValue(): Result<void> {
    return { value: undefined };
  },

  error<T>(code: DomainErrorCode, messages: NonEmptyString | NonEmptyString[]): Result<T> {
    return {
      error: {
        code,
        messages: alwaysArray(messages),
      },
    };
  },

  isOk<T>(result: Result<T>): result is { value: T } {
    return 'value' in result;
  },

  isError<T>(result: Result<T>): result is { error: DomainError } {
    return 'error' in result;
  },

  hasErrorWithText<T>(match: RegExp, result: Result<T>): result is { error: DomainError } {
    if (!Result.isError(result)) return false;

    return DomainError.hasMessageIncludingText(match, result.error);
  },

  fromNullable<T>(msg: NonEmptyString, maybeVal: T | null): Result<T> {
    if (maybeVal == null) return Result.invalid(msg);

    return Result.ok(maybeVal);
  },

  requireBoolean(msg: NonEmptyString, maybeFlag: boolean | undefined): Result<boolean> {
    if (maybeFlag === true || maybeFlag === false) return Result.ok(maybeFlag);

    return Result.invalid(msg);
  },

  /**
   * Tries to create a boolean from a string (e.g. from a CSV)
   */
  requireBooleanString(msg: NonEmptyString, maybeFlag: string | undefined): Result<boolean> {
    if (maybeFlag == null) return Result.invalid(msg);

    const normalizedFlag = maybeFlag.trim().toString().toLowerCase();

    if (normalizedFlag === 'true') return Result.ok(true);

    if (normalizedFlag === 'false') return Result.ok(false);

    return Result.invalid(msg);
  },

  /**
   * Tries to create a boolean from either a normal
   * candidate or a string (e.g. `CsvModelDefinition`)
   */
  requireBooleanOrString(msg: NonEmptyString, maybeFlag: unknown): Result<boolean> {
    if (maybeFlag == null) return Result.invalid(msg);

    if (typeof maybeFlag === 'string') return Result.requireBooleanString(msg, maybeFlag);

    if (typeof maybeFlag === 'boolean') return Result.requireBoolean(msg, maybeFlag);

    return Result.invalid(msg);
  },

  /**
   * To be used in cases where a value is expected, and its absence
   * indicates a bigger problem (i.e. throw an error)
   */
  assertValue<T>(result: Result<T>): T {
    if (Result.isOk(result)) return result.value;
    else throw Error(DomainError.summarize(result.error));
  },

  requireTrue(msg: NonEmptyString, maybeFlag: boolean | undefined | null): Result<boolean> {
    if (maybeFlag === true) return Result.ok(maybeFlag);

    return Result.invalid(msg);
  },

  validate<T>(msg: NonEmptyString, pred: (val: T) => boolean, val: T): Result<T> {
    if (pred(val)) return Result.ok(val);

    return Result.invalid(msg);
  },

  requireNull<T>(msg: NonEmptyString, maybeNull: T | null): Result<null> {
    if (maybeNull == null) return Result.ok(null);

    return Result.invalid(msg);
  },

  summarizeErrors<T>(result: Result<T>): string | null {
    if (Result.isError(result)) {
      return DomainError.summarize(result.error);
    }

    return null;
  },

  prependErrorMessages(
    result: { error: DomainError },
    messages: string | string[],
  ): { error: DomainError } {
    return {
      error: DomainError.prependMessages(result.error, messages),
    };
  },

  createTypedString<T extends NonEmptyString>(
    candidate: string | null | undefined,
    typeguardFn: (val: NonEmptyString) => val is T,
    fieldName: string,
  ): Result<T> {
    const strResult = NonEmptyString.create(fieldName, candidate);

    if (!Result.isOk(strResult)) return Result.mapError(strResult);

    const value = strResult.value;

    if (!typeguardFn(value)) {
      return Result.invalid(`"${value}" is not a valid ${fieldName}`);
    }

    return Result.ok(value);
  },

  isResult(val: unknown): val is Result<unknown> {
    if (!val) return false;

    if (typeof val !== 'object') return false;

    const obj = val as Record<string, unknown>;

    if (obj.value !== undefined && obj.error !== undefined) {
      throw 'Result should not have both a value and an error';
    }

    if (obj.error !== undefined) {
      return DomainError.isDomainError(obj.error);
    }

    return obj.value !== undefined;
  },
};

export type ResultHash<T> = Record<string | Integer, Result<T>>;

export const ResultHash = {
  getErrors<T>(r: ResultHash<T>) {
    return Object.keys(r).reduce((agg, key) => {
      if (Result.isError(r[key])) {
        agg[key] = r[key];
      }

      return agg;
    }, {} as ResultHash<T>);
  },

  getValid<T>(r: ResultHash<T>) {
    return Object.keys(r).reduce((agg, key) => {
      if (Result.isOk(r[key])) {
        agg[key] = r[key];
      }

      return agg;
    }, {} as ResultHash<T>);
  },

  pickErrors<T>(r: ResultHash<T>): DomainError[] {
    const errors = ResultHash.getErrors(r);

    const keys = keysOf(errors);

    return Result.pickErrors(...keys.map((k) => r[k]));
  },

  pickValues<T>(r: ResultHash<T>): T[] {
    const valid = ResultHash.getValid(r);

    const keys = keysOf(valid);

    return Result.pickValues(keys.map((k) => r[k]));
  },

  pickErrorMessages<T>(r: ResultHash<T>): string[] {
    return DomainError.pickMessages(ResultHash.pickErrors(r));
  },

  isEmpty<T>(r: ResultHash<T>) {
    return !Object.keys(r).length;
  },

  hasErrors<T>(r: ResultHash<T>): boolean {
    return !ResultHash.isEmpty(ResultHash.getErrors(r));
  },

  tryCreateMany<TCandidate, TResult>(
    createFn: CreateFn<TCandidate, TResult>,
    keyFn: (c: TCandidate, i: number) => string,
    candidates: TCandidate[],
  ): ResultHash<TResult> {
    return candidates.reduce((agg: ResultHash<TResult>, c: TCandidate, i: number) => {
      const key: string = keyFn(c, i);

      if (key && !Object.keys(agg).includes(key)) {
        agg[key] = createFn(c);
      }

      return agg;
    }, {});
  },

  isResultHash(data: unknown): data is ResultHash<unknown> {
    if (!data) return false;

    if (typeof data !== 'object') return false;

    if (Array.isArray(data)) return false;

    const obj = data as Record<string, unknown>;

    const keys = Object.keys(obj);

    return keys.every((k) => Result.isResult(obj[k]));
  },
};

export type CompositeResult<T> = {
  [Prop in keyof T]: Result<T[Prop]>;
};

// Used internally to assert that a property of T really is
// a property of T. Useful when T is unknown, i.e. a type parameter.
type AlwaysProperty<T, Prop> = Prop extends T[keyof T] ? Prop : never;

const CompositeResultInternal = {
  pick<T, Prop>(k: keyof T, r: CompositeResult<T>): Result<AlwaysProperty<T, Prop>> {
    return r[k] as Result<AlwaysProperty<T, Prop>>;
  },

  flatten<T>(r: CompositeResult<T>): Result<T> {
    const msgs = [] as string[];
    const result = {} as Record<keyof T, unknown>;

    for (const p in r) {
      const field = CompositeResultInternal.pick(p, r);

      if (Result.isError(field)) msgs.push(...field.error.messages);
      else if (Result.isOk(field)) result[p] = field.value;
    }

    if (msgs.length) return Result.invalid(msgs);

    return {
      value: result as unknown,
    } as Result<T>;
  },
};

export const CompositeResult = {
  fromDefinition<T>(
    definition: CompositeResultDefinition<T>,
    candidate: Candidate<Partial<T>>,
  ): CompositeResult<T> {
    return CompositeResultDefinition.toCompositeResult(definition, candidate);
  },
};

/**
 * More closely resembles our run-of-the-mill create functions that accept
 * `any` from a `Candidate<TResult>` object, as well as null and undefined.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- must admit any concrete candidate shape a caller's create function expects
export type LenientCreateFn<TResult> = CreateFn<any | null | undefined, TResult>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- must admit any concrete candidate shape a caller's create function expects
export type LenientCreateCompositeFn<TResult> = CreateCompositeFn<any | null | undefined, TResult>;

export type CompositeResultDefinition<T> = {
  [Prop in keyof T]: LenientCreateFn<T[Prop]>;
};

const CompositeResultDefinition = {
  pick<T, Prop>(
    k: keyof T,
    d: CompositeResultDefinition<T>,
  ): LenientCreateFn<AlwaysProperty<T, Prop>> {
    return d[k] as LenientCreateFn<AlwaysProperty<T, Prop>>;
  },

  toCompositeResult<T>(
    d: CompositeResultDefinition<T>,
    c: Candidate<Partial<T>>,
  ): CompositeResult<T> {
    const result = {} as Record<keyof T, unknown>;

    for (const p in d) {
      const createFn = CompositeResultDefinition.pick(p, d);
      result[p] = createFn(c[p]);
    }

    return result as CompositeResult<T>;
  },

  toResult<T>(d: CompositeResultDefinition<T>, c: Candidate<Partial<T>>): Result<T> {
    const compositeResult = CompositeResultDefinition.toCompositeResult(d, c);

    return CompositeResultInternal.flatten(compositeResult);
  },
};
