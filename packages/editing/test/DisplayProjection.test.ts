import { describe, expect, it } from 'vitest';
import { Clef } from '@scoregrove/domain/Clef';
import { Staff } from '@scoregrove/domain/Staff';
import { BeatUnit, type TimeSignature } from '@scoregrove/domain/TimeSignature';
import { PositiveInteger } from '@scoregrove/domain/PositiveInteger';
import { DisplayProjection } from '../src/DisplayProjection';
import { RestBacking } from '../src/RestBacking';
import { buildScore, expectScoreCheckOk } from './helpers';

const fourFour: TimeSignature = { beats: PositiveInteger.of(4), beatUnit: BeatUnit.Quarter };

const threeStaffScore = () => {
  const staves = [Staff.of(Clef.Treble), Staff.of(Clef.Alto), Staff.of(Clef.Bass)];

  return buildScore({
    time: fourFour,
    staves,
    measures: [RestBacking.emptyMeasure(fourFour, staves)],
  });
};

describe('DisplayProjection.project', () => {
  it('is the identity when nothing is hidden', () => {
    const score = threeStaffScore();
    const projection = DisplayProjection.project(score, new Set());

    expect(projection.score).toEqual(score);
    expect(projection.staffMap).toEqual([0, 1, 2]);
  });

  it('filters out a hidden staff from staves and every measure', () => {
    const score = threeStaffScore();
    const projection = DisplayProjection.project(score, new Set([1]));

    expectScoreCheckOk(projection.score);
    expect(projection.score.staves.map((s) => s.clef)).toEqual([Clef.Treble, Clef.Bass]);
    expect(projection.score.measures[0].contents).toHaveLength(2);
    expect(projection.staffMap).toEqual([0, 2]);
  });

  it('falls back to showing everything if every staff would be hidden', () => {
    const score = threeStaffScore();
    const projection = DisplayProjection.project(score, new Set([0, 1, 2]));

    expect(projection.score.staves).toHaveLength(3);
    expect(projection.staffMap).toEqual([0, 1, 2]);
  });

  it('handles hiding multiple non-adjacent staves', () => {
    const score = threeStaffScore();
    const projection = DisplayProjection.project(score, new Set([0, 2]));

    expect(projection.score.staves.map((s) => s.clef)).toEqual([Clef.Alto]);
    expect(projection.staffMap).toEqual([1]);
  });
});

describe('DisplayProjection.toRealAddress', () => {
  it('translates a projected staff index back to the real score', () => {
    const score = threeStaffScore();
    const projection = DisplayProjection.project(score, new Set([1]));

    // Projected staff 1 (Bass) is real staff 2
    expect(
      DisplayProjection.toRealAddress(projection, { measure: 0, staff: 1, voice: 0, element: 0 }),
    ).toEqual({ measure: 0, staff: 2, voice: 0, element: 0 });
  });

  it('is the identity when nothing is hidden', () => {
    const score = threeStaffScore();
    const projection = DisplayProjection.project(score, new Set());

    expect(
      DisplayProjection.toRealAddress(projection, { measure: 0, staff: 2, voice: 0, element: 0 }),
    ).toEqual({ measure: 0, staff: 2, voice: 0, element: 0 });
  });
});
