declare const brandSymbol: unique symbol;

export type Brand<T, TBrand extends string> = T & {
  readonly [brandSymbol]: TBrand;
};
