import { describe, expect, it } from 'vitest';
import { Duration, NoteValue, Tuplet } from '@scoregrove/domain/Duration';
import { NonEmptyArray } from '@scoregrove/domain/NonEmptyArray';
import { Articulation } from '@scoregrove/domain/Notations';
import { DurationOps } from '../src/DurationOps';

describe('DurationOps.halve', () => {
  it('moves one step shorter on the ladder', () => {
    expect(DurationOps.halve(Duration.of(NoteValue.Quarter))).toEqual(
      Duration.of(NoteValue.Eighth),
    );
  });

  it('clamps at the shortest value', () => {
    expect(DurationOps.halve(Duration.of(NoteValue.SixtyFourth))).toEqual(
      Duration.of(NoteValue.SixtyFourth),
    );
  });

  it('preserves dots and tuplet membership', () => {
    expect(DurationOps.halve(Duration.of(NoteValue.Quarter, { dots: 1 }))).toEqual(
      Duration.of(NoteValue.Eighth, { dots: 1 }),
    );

    const tuplet = Tuplet.triplet();

    expect(DurationOps.halve(Duration.of(NoteValue.Quarter, { tuplet }))).toEqual(
      Duration.of(NoteValue.Eighth, { tuplet }),
    );
  });
});

describe('DurationOps.double', () => {
  it('moves one step longer on the ladder', () => {
    expect(DurationOps.double(Duration.of(NoteValue.Quarter))).toEqual(Duration.of(NoteValue.Half));
  });

  it('clamps at the longest value', () => {
    expect(DurationOps.double(Duration.of(NoteValue.Breve))).toEqual(Duration.of(NoteValue.Breve));
  });

  it('is the exact inverse of halve for an interior value', () => {
    const start = Duration.of(NoteValue.Quarter, { dots: 1 });

    expect(DurationOps.double(DurationOps.halve(start))).toEqual(start);
  });
});

describe('DurationOps.cycleDots', () => {
  it('cycles none → single → double → none', () => {
    const none = Duration.of(NoteValue.Quarter);
    const single = DurationOps.cycleDots(none);
    const double = DurationOps.cycleDots(single);
    const back = DurationOps.cycleDots(double);

    expect(single).toEqual(Duration.of(NoteValue.Quarter, { dots: 1 }));
    expect(double).toEqual(Duration.of(NoteValue.Quarter, { dots: 2 }));
    expect(back).toEqual(none);
    expect(back.dots).toBeUndefined();
  });

  it('preserves tuplet membership through the cycle', () => {
    const tuplet = Tuplet.triplet();
    const start = Duration.of(NoteValue.Quarter, { tuplet });

    expect(DurationOps.cycleDots(start)).toEqual(
      Duration.of(NoteValue.Quarter, { dots: 1, tuplet }),
    );
  });
});

describe('DurationOps.toggleArticulation', () => {
  it('adds an articulation to an empty set', () => {
    expect(DurationOps.toggleArticulation(undefined, Articulation.Staccato)).toEqual([
      Articulation.Staccato,
    ]);
  });

  it('removes the last articulation back to undefined, not an empty array', () => {
    const one = NonEmptyArray.of([Articulation.Staccato]);

    expect(DurationOps.toggleArticulation(one, Articulation.Staccato)).toBeUndefined();
  });

  it('adds alongside an existing articulation', () => {
    const one = NonEmptyArray.of([Articulation.Staccato]);

    expect(DurationOps.toggleArticulation(one, Articulation.Accent)).toEqual([
      Articulation.Staccato,
      Articulation.Accent,
    ]);
  });

  it('removes just the one toggled, keeping the rest', () => {
    const both = NonEmptyArray.of([Articulation.Staccato, Articulation.Accent]);

    expect(DurationOps.toggleArticulation(both, Articulation.Staccato)).toEqual([
      Articulation.Accent,
    ]);
  });
});
