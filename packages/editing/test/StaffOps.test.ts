import { describe, expect, it } from 'vitest';
import { Clef } from '@scoregrove/domain/Clef';
import { NonEmptyString } from '@scoregrove/domain/NonEmptyString';
import { PositiveInteger } from '@scoregrove/domain/PositiveInteger';
import { Result } from '@scoregrove/domain/Result';
import { Staff } from '@scoregrove/domain/Staff';
import { BeatUnit, type TimeSignature } from '@scoregrove/domain/TimeSignature';
import { StaffContent } from '@scoregrove/domain/Measure';
import { NonEmptyArray } from '@scoregrove/domain/NonEmptyArray';
import { ContextWalk } from '@scoregrove/engraving/ContextWalk';
import { RestBacking } from '../src/RestBacking';
import { StaffOps } from '../src/StaffOps';
import { buildScore, expectInvalid, expectOk, expectScoreCheckOk } from './helpers';

const fourFour: TimeSignature = { beats: PositiveInteger.of(4), beatUnit: BeatUnit.Quarter };
const threeFour: TimeSignature = { beats: PositiveInteger.of(3), beatUnit: BeatUnit.Quarter };

describe('StaffOps.addStaff', () => {
  it('appends a staff and back-fills every measure with rests under its clef', () => {
    const staves = [Staff.of(Clef.Treble)];
    const score = buildScore({
      time: fourFour,
      staves,
      measures: [
        RestBacking.emptyMeasure(fourFour, staves),
        RestBacking.emptyMeasure(fourFour, staves),
      ],
    });

    const withBass = StaffOps.addStaff(score, Clef.Bass);

    expectScoreCheckOk(withBass);
    expect(withBass.staves).toHaveLength(2);
    expect(withBass.staves[1]).toEqual(Staff.of(Clef.Bass));

    withBass.measures.forEach((measure) => {
      expect(measure.contents).toHaveLength(2);
      // No clef stamp — the new staff's own clef governs via ContextWalk.
      expect(measure.contents[1].clef).toBeUndefined();
      expect(measure.contents[1].voices[0].elements).toEqual(
        RestBacking.wholeMeasureRests(fourFour),
      );
    });
    expect(ContextWalk.walk(withBass)[0][1].clef).toBe(Clef.Bass);
  });

  it('back-fills using the time signature actually in force at each measure', () => {
    const staves = [Staff.of(Clef.Treble)];
    const first = RestBacking.emptyMeasure(fourFour, staves);
    const second = { ...RestBacking.emptyMeasure(threeFour, staves), time: threeFour };
    const score = buildScore({ time: fourFour, staves, measures: [first, second] });

    const withAlto = StaffOps.addStaff(score, Clef.Alto);

    expectScoreCheckOk(withAlto);
    // The second measure changed to 3/4 — its back-fill must match that,
    // not the score's initial 4/4
    expect(withAlto.measures[0].contents[1].voices[0].elements).toEqual(
      RestBacking.wholeMeasureRests(fourFour),
    );
    expect(withAlto.measures[1].contents[1].voices[0].elements).toEqual(
      RestBacking.wholeMeasureRests(threeFour),
    );
  });

  it('carries a label through', () => {
    const staves = [Staff.of(Clef.Treble)];
    const score = buildScore({
      time: fourFour,
      staves,
      measures: [RestBacking.emptyMeasure(fourFour, staves)],
    });

    const labeled = StaffOps.addStaff(score, Clef.Bass, NonEmptyString.of('LH'));

    expect(labeled.staves[1].label).toBe('LH');
  });
});

describe('StaffOps.removeStaff', () => {
  it('drops the staff and its column from every measure', () => {
    const staves = [Staff.of(Clef.Treble), Staff.of(Clef.Bass)];
    const score = buildScore({
      time: fourFour,
      staves,
      measures: [RestBacking.emptyMeasure(fourFour, staves)],
    });

    const removed = expectOk(StaffOps.removeStaff(score, 1));

    expectScoreCheckOk(removed);
    expect(removed.staves).toHaveLength(1);
    expect(removed.staves[0]).toEqual(Staff.of(Clef.Treble));
    expect(removed.measures[0].contents).toHaveLength(1);
  });

  it('refuses to drop the last staff', () => {
    const staves = [Staff.of(Clef.Treble)];
    const score = buildScore({
      time: fourFour,
      staves,
      measures: [RestBacking.emptyMeasure(fourFour, staves)],
    });

    expectInvalid(StaffOps.removeStaff(score, 0));
  });

  it('refuses an out-of-range index', () => {
    const staves = [Staff.of(Clef.Treble), Staff.of(Clef.Bass)];
    const score = buildScore({
      time: fourFour,
      staves,
      measures: [RestBacking.emptyMeasure(fourFour, staves)],
    });

    expectInvalid(StaffOps.removeStaff(score, 5));
  });
});

describe('StaffOps.updateStaff', () => {
  it('replaces the clef and label together', () => {
    const staves = [Staff.of(Clef.Treble, NonEmptyString.of('RH'))];
    const score = buildScore({
      time: fourFour,
      staves,
      measures: [RestBacking.emptyMeasure(fourFour, staves)],
    });

    const updated = expectOk(StaffOps.updateStaff(score, 0, Clef.Bass, NonEmptyString.of('LH')));

    expectScoreCheckOk(updated);
    expect(updated.staves[0]).toEqual(Staff.of(Clef.Bass, NonEmptyString.of('LH')));
  });

  it('clears the label when none is given', () => {
    const staves = [Staff.of(Clef.Treble, NonEmptyString.of('RH'))];
    const score = buildScore({
      time: fourFour,
      staves,
      measures: [RestBacking.emptyMeasure(fourFour, staves)],
    });

    const updated = expectOk(StaffOps.updateStaff(score, 0, Clef.Treble));

    expect(updated.staves[0].label).toBeUndefined();
  });

  it('leaves existing music untouched', () => {
    const staves = [Staff.of(Clef.Treble)];
    const score = buildScore({
      time: fourFour,
      staves,
      measures: [RestBacking.emptyMeasure(fourFour, staves)],
    });

    const updated = expectOk(StaffOps.updateStaff(score, 0, Clef.Alto));

    expect(updated.measures).toEqual(score.measures);
  });

  it('makes the new clef take effect in what actually renders', () => {
    const staves = [Staff.of(Clef.Treble)];
    const score = buildScore({
      time: fourFour,
      staves,
      measures: [RestBacking.emptyMeasure(fourFour, staves)],
    });

    const updated = expectOk(StaffOps.updateStaff(score, 0, Clef.Bass));

    expect(ContextWalk.walk(updated)[0][0].clef).toBe(Clef.Bass);
  });

  it('heals a stale first-measure clef stamp so the new clef wins', () => {
    // A score built before empty measures stopped stamping their clef: the
    // first measure carries an explicit Treble that would otherwise shadow the
    // staff's clef forever ("only treble ever appears").
    const staves = [Staff.of(Clef.Treble)];
    const score = buildScore({
      time: fourFour,
      staves,
      measures: [
        {
          contents: NonEmptyArray.of([
            StaffContent.singleVoice(RestBacking.wholeMeasureRests(fourFour), Clef.Treble),
          ]),
        },
      ],
    });

    const updated = expectOk(StaffOps.updateStaff(score, 0, Clef.Bass));

    expect(updated.measures[0].contents[0].clef).toBeUndefined();
    expect(ContextWalk.walk(updated)[0][0].clef).toBe(Clef.Bass);
  });

  it('refuses an out-of-range index', () => {
    const staves = [Staff.of(Clef.Treble)];
    const score = buildScore({
      time: fourFour,
      staves,
      measures: [RestBacking.emptyMeasure(fourFour, staves)],
    });

    expectInvalid(StaffOps.updateStaff(score, 3, Clef.Bass));
  });
});

describe('StaffOps result contract', () => {
  it('exposes Result.isOk/isError consistently', () => {
    const staves = [Staff.of(Clef.Treble)];
    const score = buildScore({
      time: fourFour,
      staves,
      measures: [RestBacking.emptyMeasure(fourFour, staves)],
    });

    expect(Result.isError(StaffOps.removeStaff(score, 0))).toBe(true);
  });
});
