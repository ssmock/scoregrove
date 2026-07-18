import { NoteValue } from './Duration';
import { Fraction } from './Fraction';
import { PositiveInteger } from './PositiveInteger';
import { Result } from './Result';
import { vocabulary } from './Vocabulary';

const beatUnitMembers = {
  Whole: NoteValue.Whole,
  Half: NoteValue.Half,
  Quarter: NoteValue.Quarter,
  Eighth: NoteValue.Eighth,
  Sixteenth: NoteValue.Sixteenth,
  ThirtySecond: NoteValue.ThirtySecond,
} as const;

/**
 * The note values that may receive one beat (the lower figure of a time
 * signature).
 */
export type BeatUnit = (typeof beatUnitMembers)[keyof typeof beatUnitMembers];

/**
 * The figure conventionally printed for each beat unit. These numerals are
 * part of the written notation itself (the "4" in 3/4), not a performance
 * parameter.
 */
const numerals: Record<BeatUnit, number> = {
  Whole: 1,
  Half: 2,
  Quarter: 4,
  Eighth: 8,
  Sixteenth: 16,
  ThirtySecond: 32,
};

export const BeatUnit = {
  ...beatUnitMembers,
  ...vocabulary<BeatUnit>(beatUnitMembers),

  numeral(unit: BeatUnit): number {
    return numerals[unit];
  },
};

const symbolMembers = {
  Common: 'Common',
  CutCommon: 'CutCommon',
} as const;

/**
 * The traditional symbols that may stand in for a numeric time signature:
 * common time (𝄴, equivalent to 4/4) and cut common time (𝄵, equivalent
 * to 2/2).
 */
export type TimeSymbol = (typeof symbolMembers)[keyof typeof symbolMembers];

export const TimeSymbol = {
  ...symbolMembers,
  ...vocabulary<TimeSymbol>(symbolMembers),
};

const swingMembers = {
  Straight: 'Straight',
  LightSwing: 'LightSwing',
  MediumSwing: 'MediumSwing',
  HardSwing: 'HardSwing',
  Shuffle: 'Shuffle',
} as const;

/**
 * How written pairs of the beat's subdivision are performed. Straight plays
 * them as written; the swing presets lengthen the first of each pair, from
 * light, through medium (the classic jazz triplet swing), to hard, and
 * shuffle (the heavy blues feel). These are the feel names printed on charts;
 * mapping them to timing ratios is deliberately left for later. An absent
 * swing means Straight.
 */
export type Swing = (typeof swingMembers)[keyof typeof swingMembers];

export const Swing = {
  ...swingMembers,
  ...vocabulary<Swing>(swingMembers),
};

/**
 * A time signature: how many beats each measure holds and which note value
 * receives one beat, with an optional traditional symbol.
 */
export type TimeSignature = {
  beats: PositiveInteger;
  beatUnit: BeatUnit;
  symbol?: TimeSymbol;
};

export const TimeSignature = {
  create(beats: number, beatUnit: BeatUnit, symbol?: TimeSymbol): Result<TimeSignature> {
    const beatsResult = PositiveInteger.create('Time signature beat count', beats);

    if (!Result.isOk(beatsResult)) return Result.mapError(beatsResult);

    if (symbol === TimeSymbol.Common && (beats !== 4 || beatUnit !== BeatUnit.Quarter)) {
      return Result.invalid('Common time requires 4 beats with the Quarter note as the beat unit');
    }

    if (symbol === TimeSymbol.CutCommon && (beats !== 2 || beatUnit !== BeatUnit.Half)) {
      return Result.invalid('Cut common time requires 2 beats with the Half note as the beat unit');
    }

    const value: TimeSignature = symbol
      ? { beats: beatsResult.value, beatUnit, symbol }
      : { beats: beatsResult.value, beatUnit };

    return Result.ok(value);
  },

  commonTime(): TimeSignature {
    return { beats: PositiveInteger.of(4), beatUnit: BeatUnit.Quarter, symbol: TimeSymbol.Common };
  },

  cutCommonTime(): TimeSignature {
    return { beats: PositiveInteger.of(2), beatUnit: BeatUnit.Half, symbol: TimeSymbol.CutCommon };
  },

  equals(a: TimeSignature, b: TimeSignature): boolean {
    return a.beats === b.beats && a.beatUnit === b.beatUnit;
  },

  /**
   * How much written time one measure holds, as an exact fraction of a whole
   * note (3/4 holds 3/4; 6/8 holds the equivalent 3/4).
   */
  capacity(time: TimeSignature): Fraction {
    return Fraction.of(time.beats, BeatUnit.numeral(time.beatUnit));
  },

  format(time: TimeSignature): string {
    if (time.symbol === TimeSymbol.Common) return '𝄴';
    if (time.symbol === TimeSymbol.CutCommon) return '𝄵';

    return `${time.beats}/${BeatUnit.numeral(time.beatUnit)}`;
  },
};
