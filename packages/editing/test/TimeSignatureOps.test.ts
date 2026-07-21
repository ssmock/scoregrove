import { describe, expect, it } from 'vitest';
import { Clef } from '@scoregrove/domain/Clef';
import { Duration, NoteValue } from '@scoregrove/domain/Duration';
import { StaffContent } from '@scoregrove/domain/Measure';
import { Note } from '@scoregrove/domain/MeasureElement';
import { NonEmptyArray } from '@scoregrove/domain/NonEmptyArray';
import { PitchLetter } from '@scoregrove/domain/Pitch';
import { PositiveInteger } from '@scoregrove/domain/PositiveInteger';
import { Staff } from '@scoregrove/domain/Staff';
import { BeatUnit, TimeSignature } from '@scoregrove/domain/TimeSignature';
import { RestBacking } from '../src/RestBacking';
import { TimeSignatureOps } from '../src/TimeSignatureOps';
import { buildScore, expectInvalid, expectOk, expectScoreCheckOk, pitch } from './helpers';

const fourFour: TimeSignature = { beats: PositiveInteger.of(4), beatUnit: BeatUnit.Quarter };
const threeFour: TimeSignature = { beats: PositiveInteger.of(3), beatUnit: BeatUnit.Quarter };
const whole = Duration.of(NoteValue.Whole);
const g4 = pitch(PitchLetter.G, 4);

describe('TimeSignatureOps.setTimeSignature', () => {
  it('sets the time signature and rebuilds rest-backed content to fill it', () => {
    const staves = [Staff.of(Clef.Treble)];
    const score = buildScore({
      time: fourFour,
      staves,
      measures: [RestBacking.emptyMeasure(fourFour, staves)],
    });

    const changed = expectOk(TimeSignatureOps.setTimeSignature(score, 0, threeFour));

    expectScoreCheckOk(changed);
    expect(changed.measures[0].time).toEqual(threeFour);
    expect(changed.measures[0].contents[0].voices[0].elements).toEqual(
      RestBacking.wholeMeasureRests(threeFour),
    );
  });

  it('preserves each staff’s own clef', () => {
    const staves = [Staff.of(Clef.Treble), Staff.of(Clef.Bass)];
    const score = buildScore({
      time: fourFour,
      staves,
      measures: [RestBacking.emptyMeasure(fourFour, staves)],
    });

    const changed = expectOk(TimeSignatureOps.setTimeSignature(score, 0, threeFour));

    expect(changed.measures[0].contents[1].clef).toBe(Clef.Bass);
  });

  it('refuses a measure that already has notes', () => {
    const staves = [Staff.of(Clef.Treble)];
    const score = buildScore({
      time: fourFour,
      staves,
      measures: [
        {
          contents: NonEmptyArray.of([
            StaffContent.singleVoice(NonEmptyArray.of([Note.of(g4, whole)])),
          ]),
        },
      ],
    });

    expectInvalid(TimeSignatureOps.setTimeSignature(score, 0, threeFour));
  });

  it('refuses an out-of-range measure index', () => {
    const staves = [Staff.of(Clef.Treble)];
    const score = buildScore({
      time: fourFour,
      staves,
      measures: [RestBacking.emptyMeasure(fourFour, staves)],
    });

    expectInvalid(TimeSignatureOps.setTimeSignature(score, 9, threeFour));
  });
});

describe('TimeSignatureOps.clearTimeSignature', () => {
  it('resets the first measure to common time, whatever the score started in', () => {
    const staves = [Staff.of(Clef.Treble)];
    const score = buildScore({
      time: threeFour,
      staves,
      measures: [{ ...RestBacking.emptyMeasure(threeFour, staves), time: threeFour }],
    });

    const cleared = expectOk(TimeSignatureOps.clearTimeSignature(score, 0));

    expectScoreCheckOk(cleared);
    expect(cleared.time).toEqual(TimeSignature.commonTime());
    expect(cleared.measures[0].time).toBeUndefined();
    expect(cleared.measures[0].contents[0].voices[0].elements).toEqual(
      RestBacking.wholeMeasureRests(TimeSignature.commonTime()),
    );
  });

  it('resets the first measure to common time even when it never restated its own change', () => {
    // The typical case: the score's own initial time signature (not 4/4
    // here) is what actually prints on measure 0, with no explicit
    // `measure.time` of its own to point to — this must still work, since
    // that measure's time signature is always in force regardless.
    const staves = [Staff.of(Clef.Treble)];
    const score = buildScore({
      time: threeFour,
      staves,
      measures: [RestBacking.emptyMeasure(threeFour, staves)],
    });

    const cleared = expectOk(TimeSignatureOps.clearTimeSignature(score, 0));

    expectScoreCheckOk(cleared);
    expect(cleared.time).toEqual(TimeSignature.commonTime());
    expect(cleared.measures[0].contents[0].voices[0].elements).toEqual(
      RestBacking.wholeMeasureRests(TimeSignature.commonTime()),
    );
  });

  it('reverts a later measure to whatever was effective just before it', () => {
    const staves = [Staff.of(Clef.Treble)];
    const score = buildScore({
      time: fourFour,
      staves,
      measures: [
        RestBacking.emptyMeasure(fourFour, staves),
        { ...RestBacking.emptyMeasure(threeFour, staves), time: threeFour },
      ],
    });

    const cleared = expectOk(TimeSignatureOps.clearTimeSignature(score, 1));

    expectScoreCheckOk(cleared);
    expect(cleared.measures[1].time).toBeUndefined();
    expect(cleared.measures[1].contents[0].voices[0].elements).toEqual(
      RestBacking.wholeMeasureRests(fourFour),
    );
  });

  it('refuses a later measure with no time signature of its own', () => {
    const staves = [Staff.of(Clef.Treble)];
    const score = buildScore({
      time: fourFour,
      staves,
      measures: [
        RestBacking.emptyMeasure(fourFour, staves),
        RestBacking.emptyMeasure(fourFour, staves),
      ],
    });

    expectInvalid(TimeSignatureOps.clearTimeSignature(score, 1));
  });

  it('refuses a measure that already has notes', () => {
    const staves = [Staff.of(Clef.Treble)];
    const score = buildScore({
      time: fourFour,
      staves,
      measures: [
        {
          contents: NonEmptyArray.of([
            StaffContent.singleVoice(NonEmptyArray.of([Note.of(g4, whole)])),
          ]),
          time: threeFour,
        },
      ],
    });

    expectInvalid(TimeSignatureOps.clearTimeSignature(score, 0));
  });

  it('refuses an out-of-range measure index', () => {
    const staves = [Staff.of(Clef.Treble)];
    const score = buildScore({
      time: fourFour,
      staves,
      measures: [RestBacking.emptyMeasure(fourFour, staves)],
    });

    expectInvalid(TimeSignatureOps.clearTimeSignature(score, 9));
  });
});
