import type { Clef } from './Clef';
import type { NonEmptyString } from './NonEmptyString';

/**
 * A staff definition: its starting clef and an optional label (e.g. "Piano RH").
 * The measures themselves live on the score, which carries one content entry
 * per staff for every measure.
 */
export type Staff = {
  clef: Clef;
  label?: NonEmptyString;
};

export const Staff = {
  of(clef: Clef, label?: NonEmptyString): Staff {
    return label ? { clef, label } : { clef };
  },
};
