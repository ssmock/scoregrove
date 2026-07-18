export type HasShape<T extends object> = {
  // takes every property and assigns it "unknown" type
  // for properties that are objects it recursively calls it to run it for those properties, and so on
  [K in keyof T]: T[K] extends object ? HasShape<T[K]> : unknown;
};

export type DeepPartial<T> = T extends object
  ? {
      [P in keyof T]?: DeepPartial<T[P]>;
    }
  : T;

export type NotExtends<T, U> = T extends U ? never : T;

/**
 * Combines HasShape with Partial
 */
export type Candidate<T extends object> = {
  [K in keyof T]?: T[K] extends object ? HasShape<T[K]> : unknown;
};

export type NullableFields<T extends object> = {
  [K in keyof T]: T[K] | null;
};

export type NullFields<T extends object> = {
  [K in keyof T]: null;
};

/**
 * Verifies that the given type is a primitive
 * (i.e. no objects, functions, or arrays allowed)
 */
type IsPrimitive<T> = T extends object ? never : T;

/**
 * Verifies that the given type is an array of primitives
 */
type IsPrimitiveArray<T> =
  T extends Array<unknown> ? (T[number] extends object ? never : T) : never;

type IsPrimitiveOrPrimitiveArray<T> = IsPrimitive<T> | IsPrimitiveArray<T>;

/**
 * Verifies that every property of an object is either a primitive or an
 * array of primitives (i.e. no nested objects allowed)
 */
export type IsFlat<T extends object> = {
  [K in keyof T]: T[K] extends IsPrimitiveOrPrimitiveArray<T[K]> ? T[K] : never;
};

/**
 * Describes an object that shares keys with the given type T whose
 * values are of type V
 */
export type CompositeType<T extends object, V> = {
  [Prop in keyof T]: V;
};
