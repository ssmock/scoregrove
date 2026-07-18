import { Fraction } from './Fraction';
import { PositiveInteger } from './PositiveInteger';
import { Result } from './Result';
import { vocabulary } from './Vocabulary';

const noteValueMembers = {
  Breve: 'Breve',
  Whole: 'Whole',
  Half: 'Half',
  Quarter: 'Quarter',
  Eighth: 'Eighth',
  Sixteenth: 'Sixteenth',
  ThirtySecond: 'ThirtySecond',
  SixtyFourth: 'SixtyFourth',
} as const;

/**
 * The written note values, ordered longest to shortest. Breve is the double
 * whole note found in early and choral music.
 */
export type NoteValue = (typeof noteValueMembers)[keyof typeof noteValueMembers];

export const NoteValue = {
  ...noteValueMembers,
  ...vocabulary<NoteValue>(noteValueMembers),
};

/**
 * Augmentation dots: 1 = dotted, 2 = double-dotted. A duration without dots
 * simply omits the field.
 */
export type DotCount = 1 | 2;

export const DotCount = {
  values: [1, 2] as readonly DotCount[],

  is(val: unknown): val is DotCount {
    return val === 1 || val === 2;
  },

  create(fieldName: string, candidate: number | null | undefined): Result<DotCount> {
    if (!DotCount.is(candidate)) {
      return Result.invalid(`${fieldName} must be 1 (dotted) or 2 (double-dotted)`);
    }

    return Result.ok(candidate);
  },
};

/**
 * An irregular division of time: `count` notes played in the written space of
 * `inSpaceOf` notes of the same value. A triplet is 3:2; a duplet is 2:3; a
 * quintuplet is 5:4. Purely symbolic — no duration arithmetic yet.
 */
export type Tuplet = {
  count: PositiveInteger;
  inSpaceOf: PositiveInteger;
};

export const Tuplet = {
  /**
   * Brands the given ratio without validating it; use only when the values
   * are already known to form a valid tuplet (e.g. literals)
   */
  of(count: PositiveInteger, inSpaceOf: PositiveInteger): Tuplet {
    return { count, inSpaceOf };
  },

  triplet(): Tuplet {
    return Tuplet.of(PositiveInteger.of(3), PositiveInteger.of(2));
  },

  create(count: number, inSpaceOf: number): Result<Tuplet> {
    const messages: string[] = [];

    if (!PositiveInteger.is(count) || count < 2) {
      messages.push('Tuplet count must be an integer of at least 2');
    }

    if (!PositiveInteger.is(inSpaceOf)) {
      messages.push('Tuplet inSpaceOf must be a positive integer');
    }

    if (PositiveInteger.is(count) && PositiveInteger.is(inSpaceOf) && count === inSpaceOf) {
      messages.push('A tuplet must divide time irregularly; count and inSpaceOf are equal');
    }

    if (messages.length) return Result.invalid(messages);

    return Result.ok(Tuplet.of(PositiveInteger.of(count), PositiveInteger.of(inSpaceOf)));
  },

  equals(a: Tuplet, b: Tuplet): boolean {
    return a.count === b.count && a.inSpaceOf === b.inSpaceOf;
  },

  format(tuplet: Tuplet): string {
    return `${tuplet.count}:${tuplet.inSpaceOf}`;
  },
};

/**
 * A symbolic written duration: a note value, optional augmentation dots, and
 * an optional tuplet membership (e.g. a dotted quarter, or a triplet eighth).
 */
export type Duration = {
  noteValue: NoteValue;
  dots?: DotCount;
  tuplet?: Tuplet;
};

/**
 * Each note value's written length as a fraction of a whole note.
 */
const noteValueFractions: Record<NoteValue, Fraction> = {
  Breve: Fraction.of(2, 1),
  Whole: Fraction.of(1, 1),
  Half: Fraction.of(1, 2),
  Quarter: Fraction.of(1, 4),
  Eighth: Fraction.of(1, 8),
  Sixteenth: Fraction.of(1, 16),
  ThirtySecond: Fraction.of(1, 32),
  SixtyFourth: Fraction.of(1, 64),
};

export const Duration = {
  of(noteValue: NoteValue, extras: { dots?: DotCount; tuplet?: Tuplet } = {}): Duration {
    const { dots, tuplet } = extras;

    return {
      noteValue,
      ...(dots ? { dots } : {}),
      ...(tuplet ? { tuplet } : {}),
    };
  },

  equals(a: Duration, b: Duration): boolean {
    const tupletsEqual =
      a.tuplet && b.tuplet ? Tuplet.equals(a.tuplet, b.tuplet) : a.tuplet === b.tuplet;

    return a.noteValue === b.noteValue && (a.dots ?? 0) === (b.dots ?? 0) && tupletsEqual;
  },

  /**
   * The written length as an exact fraction of a whole note: dots multiply by
   * 3/2 (one dot) or 7/4 (two dots), and a tuplet multiplies by
   * inSpaceOf/count (a triplet eighth is 1/8 × 2/3 = 1/12).
   */
  fractionOfWhole(duration: Duration): Fraction {
    let fraction = noteValueFractions[duration.noteValue];

    if (duration.dots === 1) fraction = Fraction.multiply(fraction, Fraction.of(3, 2));
    if (duration.dots === 2) fraction = Fraction.multiply(fraction, Fraction.of(7, 4));

    if (duration.tuplet) {
      fraction = Fraction.multiply(
        fraction,
        Fraction.of(duration.tuplet.inSpaceOf, duration.tuplet.count),
      );
    }

    return fraction;
  },

  format(duration: Duration): string {
    const prefix = duration.dots === 2 ? 'double-dotted ' : duration.dots === 1 ? 'dotted ' : '';
    const suffix = duration.tuplet ? ` (${Tuplet.format(duration.tuplet)})` : '';

    return `${prefix}${duration.noteValue}${suffix}`;
  },
};
