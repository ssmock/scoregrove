import { Integer } from './Integer';
import { NonEmptyString } from './NonEmptyString';
import { Count } from './Count';

export const camelCaseString = (s: string) =>
  s && s.replace(/(_+\w)/g, (_, chars) => chars.slice(-1).toUpperCase());

export const camelCaseRecord = <TField extends string>(
  obj: Record<TField, unknown>,
): Record<string, unknown> => {
  const result: Record<string, unknown> = {};

  for (const p in obj) {
    result[camelCaseString(p)] = obj[p];
  }

  return result;
};

export const toPrice = (val: string | number) => parseFloat(val.toString());

export const toPriceWithCents = (val: string | number, fractionDigits: number = 3) =>
  parseFloat(toPrice(val).toFixed(fractionDigits));

export const zeroPadLeft = (val: string, length: number) => {
  if (val.length > length) return val;

  return `${'0'.repeat(length)}${val}`.slice(-length);
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- intentionally accepts any callback shape; `unknown[]` would reject callers passing narrower-typed functions
export type VoidFunction = (...args: any) => void;

export const debounce = (fn: VoidFunction, delay: number): VoidFunction => {
  let timeoutHandle = 0;

  const wrapped = (...args: unknown[]) => {
    clearTimeout(timeoutHandle);

    timeoutHandle = setTimeout(() => {
      fn(...args);
    }, delay);
  };

  return wrapped as VoidFunction;
};

export const roundToCents = (val: number) => Math.round(val * 100) / 100;

export const roundToThousandths = (val: number) => Math.round(val * 1000) / 1000;

export const wait = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- intentionally accepts any callback shape; `unknown[]` would reject callers passing narrower-typed functions
export type VoidPromiseFunction = (...args: any) => Promise<void>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- generic upper bound must admit any async function shape
export type AnyPromiseFunction = (...args: any) => Promise<any>;

export type FunctionKey = string;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- generic upper bound must admit any function shape
export type KeyMapFunction<TFn extends (...args: any) => any> = (
  ...args: Parameters<TFn>
) => FunctionKey;

type DebounceRecord = {
  timeoutHandle: number;
  resolveQueue: (() => void)[];
};

type KeyedFunctionDictionary = Record<FunctionKey, DebounceRecord>;

export const rateLimitKeyedFunction = <TFn extends AnyPromiseFunction>(
  keyMap: KeyMapFunction<TFn>,
  fn: TFn,
  interval: number,
): VoidPromiseFunction => {
  const dict: KeyedFunctionDictionary = {};
  const getDebounceRecord = (key: FunctionKey): DebounceRecord => {
    if (!dict[key]) {
      const newRecord = {
        timeoutHandle: 0,
        resolveQueue: [],
      };

      dict[key] = newRecord;

      return newRecord;
    }

    return dict[key];
  };

  return async (...args: Parameters<TFn>) =>
    new Promise((res) => {
      const key = keyMap(...args);
      const debounceRecord = getDebounceRecord(key);

      clearTimeout(debounceRecord.timeoutHandle);
      debounceRecord.resolveQueue.push(res);

      debounceRecord.timeoutHandle = setTimeout(() => {
        if (debounceRecord.resolveQueue.length) {
          fn(...args).then(() => {
            debounceRecord.resolveQueue.forEach((r) => r());
            debounceRecord.resolveQueue = [];
          });
        }
      }, interval);
    });
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- generic upper bound must admit any function shape
export const rateLimitFunction = <TFn extends (...args: any) => any>(
  fn: TFn,
  interval: number,
): ((...params: Parameters<TFn>) => void) => {
  let isIntervalSet = false;
  return (...args: Parameters<TFn>) => {
    if (isIntervalSet) return;

    isIntervalSet = true;

    setTimeout(() => {
      isIntervalSet = false;
      fn(...args);
    }, interval);
  };
};

/**
 * Spins at an interval of `intervalMs` waiting for `keepWaiting` to return `false`
 * for a maximum of `timeoutMs`. If `false` is returned before `timeoutMs` is reached,
 * the result of `successFn` is returned, otherwise the result of `timedOutFn` is
 * returned. Useful for monitoring an async process outside of the current context
 * while avoiding an infinite loop.
 *
 * @param timeoutMs The maximum amount of time (in ms) to try calling `keepWaiting` before timing out
 * @param intervalMs The amount of time (in ms) to wait in between each call to `keepWaiting`
 * @param keepWaiting The while loop's condition expression
 * @param timedOutFn The function that is called if `timeoutMs` is reached before `keepWaiting` resolves to `false`
 * @param successFn The function that is called if `keepWaiting` resolves to `false` before timing out
 *
 * @returns A Promise of `TResult` returned by either `timedOutFn` or `successFn`
 */
export async function timeoutFunction<TResult>(
  timeoutMs: number,
  intervalMs: number,
  keepWaiting: () => boolean | Promise<boolean>,
  timedOutFn: () => TResult | Promise<TResult>,
  successFn: () => TResult | Promise<TResult>,
): Promise<TResult> {
  let timedOut: boolean = false;

  const to = setTimeout(() => (timedOut = true), timeoutMs);

  while (await keepWaiting()) {
    await wait(intervalMs);

    if (timedOut) {
      clearTimeout(to);
      return await timedOutFn();
    }
  }

  clearTimeout(to);
  return await successFn();
}

export function capitalize(str: string) {
  if (!str) return str;

  return [str[0].toUpperCase(), str.slice(1)].join('');
}

export function spacePascalCase(str: string) {
  if (!str) return str;

  return (
    str[0] +
    str.slice(1).replace(/[A-Z]/g, (substr) => {
      return ' ' + substr;
    })
  );
}

export function deepCopy<T>(obj: T) {
  return JSON.parse(JSON.stringify(obj)) as T;
}

export function makePropsEnumerable<T>(obj: T) {
  return JSON.parse(
    JSON.stringify(obj, obj instanceof Error ? Object.getOwnPropertyNames(obj) : undefined),
  ) as T;
}

export function reduceDistinct<T>(agg: T[], entry: T) {
  if (agg.includes(entry)) return agg;

  return [...agg, entry];
}

export function reduceDistinctWithFn<TEq>(equalityFn: EqualityFn<TEq>) {
  return <T extends TEq>(agg: T[], entry: T): T[] => {
    if (agg.some((a) => equalityFn(a, entry))) return agg;

    return [...agg, entry];
  };
}

export function isNumber(n: string) {
  return !isNaN(Number(n));
}

export function isWholeNumber(n: number) {
  return Math.floor(n) === n;
}

export const emptyUuid = '00000000-0000-0000-0000-000000000000';

/**
 * n.b. `[TArr1 | null, TArr2 | null]` is the type for a binary array with different
 * types in its first and second positions
 */
export function zip<TArr1, TArr2>(arr1: TArr1[], arr2: TArr2[]): [TArr1 | null, TArr2 | null][] {
  const arraySpec = { length: Math.max(arr1.length, arr2.length) };

  const result: [TArr1 | null, TArr2 | null][] = Array.from(arraySpec).map((_e, i) => [
    arr1[i] || null,
    arr2[i] || null,
  ]);

  return result;
}

export function compactMap<TFrom, TTo>(
  fn: (from: TFrom) => TTo | null,
  arr: readonly TFrom[],
): TTo[] {
  return arr.reduce((agg: TTo[], item: TFrom) => {
    const mapped = fn(item);

    if (mapped === null) return agg;

    agg.push(mapped);

    return agg;
  }, [] as TTo[]);
}

export function findMap<TFrom, TTo>(
  fn: (from: TFrom) => TTo | null,
  arr: readonly TFrom[],
): TTo | null {
  for (const item of arr) {
    const mapped = fn(item);

    if (mapped) return mapped;
  }

  return null;
}

/**
 * Creates a new array from the old one, but ordered as specified by the given keys.
 *
 * @param array The array to reorder
 * @param pickKey A function that gets a unique key for each item in the array
 * @param keyOrder An array of item keys (per pickKey) that specifies the item ordering
 * @returns A copy of the original array, reordered, though items without keys and keys
 *  without items result in exclusions
 */
export function reorderByKey<TArr, TKey>(
  array: TArr[],
  pickKey: (t: TArr) => TKey,
  keyOrder: TKey[],
): TArr[] {
  const usedKeys = [] as TKey[];

  const result = Array.from({ length: keyOrder.length }).reduce(
    (agg: TArr[], _empty: unknown, i: number) => {
      const key = keyOrder[i];

      if (usedKeys.includes(key)) return agg;

      const arrayItem = array.find((a) => pickKey(a) === key);

      if (arrayItem) {
        agg.push(arrayItem);
        usedKeys.push(key);
      }

      return agg;
    },
    [],
  );

  return result;
}

export function alwaysArray<T>(val: T | T[]): T[] {
  if (Array.isArray(val)) return val;

  return [val];
}

export function proseList(vals: string[], conjunction?: 'and' | 'or'): string {
  if (vals.length === 0) return '';

  if (vals.length === 1) return vals[0];

  if (vals.length === 2) return `${vals[0]} ${conjunction ?? 'and'} ${vals[1]}`;

  const rest = vals.slice(0, vals.length - 1);
  const tail = vals[vals.length - 1];

  return `${rest.join(', ')}, ${conjunction ?? 'and'} ${tail}`;
}

/**
 * Checks the given array for duplicates using strict equality (Set-based)
 */
export function pickDuplicates<TArr>(arr: Array<TArr>): Array<TArr> {
  const { dupes } = arr.reduce(
    (agg, item) => {
      if (agg.checked.has(item)) {
        agg.dupes.add(item);
      } else {
        agg.checked.add(item);
      }

      return agg;
    },
    {
      checked: new Set<TArr>(),
      dupes: new Set<TArr>(),
    },
  );

  return Array.from(dupes);
}

type EqualityFn<T> = (o1: T, o2: T) => boolean;

/**
 * Checks the given array for duplicates using the given equality function
 */
export function pickDuplicatesWithFn<T>(arr: T[], equalityFn: EqualityFn<T>): T[] {
  const { dupes } = arr.reduce(
    (agg, item) => {
      if (agg.checked.some((a) => equalityFn(a, item))) {
        agg.dupes.push(item);
      } else {
        agg.checked.push(item);
      }

      return agg;
    },
    {
      checked: [] as T[],
      dupes: [] as T[],
    },
  );

  return dupes;
}

export function findIndices<T>(arr: T[], condition: (val: T) => boolean): Count[] {
  return arr
    .map((value, index) => (condition(value) ? index : -1))
    .filter((index) => index !== -1)
    .map(Count.of);
}

export function formatOrdinalNumber(num: Integer) {
  const digit = num % 10;
  let postfix = 'th';

  switch (digit) {
    case 1:
      postfix = 'st';
      break;
    case 2:
      postfix = 'nd';
      break;
    case 3:
      postfix = 'rd';
      break;
  }

  const endsWithRuleException = [11, 12, 13].filter((n) => String(num).endsWith(String(n)));

  if (num > 10 && endsWithRuleException.length) postfix = 'th';
  return `${num}${postfix}`;
}

export function trimFalsy<T>(arr: T[]) {
  return arr.filter((x) => !!x) as Exclude<T, undefined | null | 0 | '0' | '' | -0 | 0n>[];
}

export function replaceFirstArrayItem<T>(origItem: T, newItem: T, items: T[]): T[] {
  const i = items.indexOf(origItem);

  if (i < 0) return items;

  return [...items.slice(0, i), newItem, ...items.slice(i + 1)];
}

export function replaceFirstArrayItemLike<T extends object>(
  predicate: (item: T) => boolean,
  newItem: T | ((origItem: T) => T),
  items: T[],
): T[] {
  const i = items.findIndex(predicate);

  if (i < 0) return items;
  const effectiveItem = typeof newItem === 'function' ? newItem(items[i]) : newItem;

  return [...items.slice(0, i), effectiveItem, ...items.slice(i + 1)];
}

export function patchMany<T>(
  origList: T[],
  patchFn: (orig: T) => T,
  shouldPatchFn?: (orig: T) => boolean,
): T[] {
  const mapper =
    shouldPatchFn && typeof shouldPatchFn === 'function'
      ? (orig: T) => (shouldPatchFn(orig) ? patchFn(orig) : orig)
      : (orig: T) => patchFn(orig);

  return origList.map(mapper);
}

/**
 * Compensates for TypeScript losing track of key types via Object.keys
 */
export function keysOf<TKey extends string>(record: Partial<Record<TKey, unknown>>): TKey[] {
  return Object.keys(record) as TKey[];
}

export function matchesExpFor<T extends string>(exp: RegExp, val: string): val is T {
  return !!val.match(exp);
}

const fileNameHeaderRegexp = /attachment; filename=(.*)/;
export function tryExtractFileNameFromHeader(
  contentDispositionHeader: NonEmptyString,
): NonEmptyString | null {
  const result = fileNameHeaderRegexp.exec(contentDispositionHeader);

  if (!result || result.length < 2) return null;

  const trimmed = result[1].trim();

  if (!trimmed.length) return null;

  // Remove quotes if needed
  if (trimmed.startsWith('"')) return NonEmptyString.of(trimmed.substring(1, trimmed.length - 1));

  return NonEmptyString.of(trimmed);
}

export const maybeMap =
  <TArg, TResult>(fn: (arg: TArg) => TResult | null) =>
  (arg: TArg | null | undefined): TResult | null => {
    if (arg == null) return null;

    return fn(arg);
  };

export function assertNotNull<T>(name: NonEmptyString, val: T | null | undefined): T {
  if (val == null) throw Error(`${name} should not be null`);

  return val;
}

export type Searchable<T extends object> = T & {
  searchText: NonEmptyString;
};

export const Searchable = {
  makeSearchable:
    <T extends object>(chooseText: (o: T) => NonEmptyString) =>
    (val: T): Searchable<T> => {
      return {
        ...val,
        searchText: chooseText(val),
      };
    },

  matchesInsensitive: (filterVal: string) => {
    const exp = new RegExp(filterVal, 'i');

    return <T extends object>(val: Searchable<T>): boolean => exp.test(val.searchText);
  },
};

export type Selectable<T extends object> = T & {
  isSelected: boolean;
};

/**
 * Used to determine whether a given object contains another object
 * as a property with a given name; useful prior to passing an untyped
 * value to a .create function
 */
export function hasObjectProperty<TReq extends object, TRes extends TReq>(
  obj: TReq,
  propName: keyof TRes,
): obj is TRes {
  const record = obj as Record<PropertyKey, unknown>;

  return propName in obj && typeof record[propName] === 'object' && record[propName] !== null;
}

export function removeDashes(str: string) {
  return str.replace(/-/g, '');
}

export function clamp(num: number, bounds: { min?: number; max?: number }) {
  if (bounds.max != null && num > bounds.max) return bounds.max;
  if (bounds.min != null && num < bounds.min) return bounds.min;

  return num;
}

export function getReadableIdentifier(identifier: NonEmptyString): NonEmptyString {
  return NonEmptyString.of(
    capitalize(
      identifier
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        // Add space between letters and digits
        .replace(/([a-zA-Z])(\d)/g, '$1 $2')
        .replace(/(\d)([a-zA-Z])/g, '$1 $2') // Add space between digits and letters
        // Replace underscores with spaces for snake_case
        .replace(/_/g, ' ')
        .trim(),
    ),
  );
}

export function toQueryStringComponent<TObj extends object>(obj: TObj): string {
  if (typeof obj !== 'object') return '';

  return (Object.keys(obj) as (keyof TObj)[])
    .map((key) => `${encodeURIComponent(String(key))}=${encodeURIComponent(String(obj[key]))}`)
    .join('&');
}

export function mapNullable<TFrom, TTo>(fn: (x: TFrom) => TTo) {
  return (x: TFrom | null) => (x == null ? null : fn(x));
}

const fallbackErrorMessage = NonEmptyString.of('Unknown error');

function toNonEmptyMessage(candidate: string): NonEmptyString {
  return NonEmptyString.is(candidate) ? NonEmptyString.of(candidate) : fallbackErrorMessage;
}

export function parseUnknownError(
  err: unknown,
): { message: NonEmptyString } & Record<string, unknown> {
  if (err instanceof Error) {
    return {
      message: toNonEmptyMessage(err.message),
      name: err.name,
      stack: err.stack,
      ...(err as unknown as Record<string, unknown>), // if custom fields were attached
    };
  }

  if (typeof err === 'object' && err !== null) {
    return {
      message: NonEmptyString.of('Unknown error object'),
      ...(err as Record<string, unknown>),
    };
  }

  return {
    message: toNonEmptyMessage(String(err)),
  };
}

export function trimSlashes(input: NonEmptyString): NonEmptyString {
  return NonEmptyString.of(input.replace(/^\/+|\/+$/g, ''));
}

export function combineUrls(head: NonEmptyString, tail: NonEmptyString): NonEmptyString {
  return NonEmptyString.of(`${trimSlashes(head)}/${trimSlashes(tail)}`);
}

export function wrapTextWithHtmlTag(tag: string, text: string) {
  return `<${tag}>${text}</${tag}>`;
}

export function enstrongify(text: string): string {
  return wrapTextWithHtmlTag('strong', text);
}
