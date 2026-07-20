import { describe, expect, it } from 'vitest';
import { Clef } from '@scoregrove/domain/Clef';
import { Duration, NoteValue } from '@scoregrove/domain/Duration';
import { PositiveInteger } from '@scoregrove/domain/PositiveInteger';
import { Score } from '@scoregrove/domain/Score';
import { Staff } from '@scoregrove/domain/Staff';
import { BeatUnit, TimeSignature } from '@scoregrove/domain/TimeSignature';
import { RestBacking } from '../src/RestBacking';
import { buildScore, expectScoreCheckOk } from './helpers';

const timeOf = (beats: number, beatUnit: TimeSignature['beatUnit']): TimeSignature => ({
  beats: PositiveInteger.of(beats),
  beatUnit,
});

describe('RestBacking.wholeMeasureRests', () => {
  it('fills common time with a single whole rest', () => {
    expect(RestBacking.wholeMeasureRests(timeOf(4, BeatUnit.Quarter))).toEqual([
      { kind: 'rest', duration: Duration.of(NoteValue.Whole) },
    ]);
  });

  it('fills 3/4 with a single dotted half rest', () => {
    expect(RestBacking.wholeMeasureRests(timeOf(3, BeatUnit.Quarter))).toEqual([
      { kind: 'rest', duration: Duration.of(NoteValue.Half, { dots: 1 }) },
    ]);
  });

  it('fills an irregular capacity with more than one rest', () => {
    // 5/4 doesn't correspond to any single note value
    expect(RestBacking.wholeMeasureRests(timeOf(5, BeatUnit.Quarter))).toEqual([
      { kind: 'rest', duration: Duration.of(NoteValue.Whole) },
      { kind: 'rest', duration: Duration.of(NoteValue.Quarter) },
    ]);
  });
});

describe('RestBacking.emptyStaffContent', () => {
  it('wraps the rests as a single voice under the given clef', () => {
    const content = RestBacking.emptyStaffContent(timeOf(4, BeatUnit.Quarter), Clef.Bass);

    expect(content.clef).toBe(Clef.Bass);
    expect(content.voices).toHaveLength(1);
    expect(content.voices[0].elements).toEqual([
      { kind: 'rest', duration: Duration.of(NoteValue.Whole) },
    ]);
  });

  it('omits the clef field when none is given', () => {
    expect(RestBacking.emptyStaffContent(timeOf(4, BeatUnit.Quarter)).clef).toBeUndefined();
  });
});

describe('RestBacking.emptyMeasure', () => {
  it('gives every staff its own rest-backed content under its own clef', () => {
    const time = timeOf(4, BeatUnit.Quarter);
    const staves = [Staff.of(Clef.Treble), Staff.of(Clef.Bass)];
    const measure = RestBacking.emptyMeasure(time, staves);

    expect(measure.contents).toHaveLength(2);
    expect(measure.contents[0].clef).toBe(Clef.Treble);
    expect(measure.contents[1].clef).toBe(Clef.Bass);
  });

  it('produces a score that passes Score.check on its own', () => {
    const time = timeOf(3, BeatUnit.Quarter);
    const staves = [Staff.of(Clef.Treble), Staff.of(Clef.Alto)];
    const score = buildScore({
      time,
      staves,
      measures: [
        RestBacking.emptyMeasure(time, staves),
        RestBacking.emptyMeasure(time, staves),
        RestBacking.emptyMeasure(time, staves),
      ],
    });

    expectScoreCheckOk(score);
    expect(Score.measureCount(score)).toBe(3);
  });
});
