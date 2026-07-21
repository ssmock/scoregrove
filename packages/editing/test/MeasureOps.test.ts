import { describe, expect, it } from 'vitest';
import { Clef } from '@scoregrove/domain/Clef';
import { Duration, NoteValue } from '@scoregrove/domain/Duration';
import { StaffContent } from '@scoregrove/domain/Measure';
import { Chord, Note, TieRole } from '@scoregrove/domain/MeasureElement';
import { NonEmptyArray } from '@scoregrove/domain/NonEmptyArray';
import { SlurRole } from '@scoregrove/domain/Notations';
import { PitchLetter } from '@scoregrove/domain/Pitch';
import { PositiveInteger } from '@scoregrove/domain/PositiveInteger';
import { Staff } from '@scoregrove/domain/Staff';
import { BeatUnit, type TimeSignature } from '@scoregrove/domain/TimeSignature';
import { ContextWalk } from '@scoregrove/engraving/ContextWalk';
import { MeasureOps } from '../src/MeasureOps';
import { RestBacking } from '../src/RestBacking';
import { buildScore, expectInvalid, expectOk, expectScoreCheckOk, pitch } from './helpers';

const fourFour: TimeSignature = { beats: PositiveInteger.of(4), beatUnit: BeatUnit.Quarter };
const threeFour: TimeSignature = { beats: PositiveInteger.of(3), beatUnit: BeatUnit.Quarter };
const whole = Duration.of(NoteValue.Whole);
const g4 = pitch(PitchLetter.G, 4);
const b4 = pitch(PitchLetter.B, 4);

describe('MeasureOps.addMeasure', () => {
  it('appends a rest-backed measure under each staff', () => {
    const staves = [Staff.of(Clef.Treble), Staff.of(Clef.Bass)];
    const score = buildScore({
      time: fourFour,
      staves,
      measures: [RestBacking.emptyMeasure(fourFour, staves)],
    });

    const added = MeasureOps.addMeasure(score);

    expectScoreCheckOk(added);
    expect(added.measures).toHaveLength(2);
    expect(added.measures[1].contents[0].voices[0].elements).toEqual(
      RestBacking.wholeMeasureRests(fourFour),
    );
    expect(added.measures[1].contents[1].voices[0].elements).toEqual(
      RestBacking.wholeMeasureRests(fourFour),
    );
  });

  it('carries no clef, key/time/tempo change, or barline of its own', () => {
    const staves = [Staff.of(Clef.Treble)];
    const score = buildScore({
      time: fourFour,
      staves,
      measures: [RestBacking.emptyMeasure(fourFour, staves)],
    });

    const added = MeasureOps.addMeasure(score);

    // unlike RestBacking.emptyMeasure (used for a score's first measure,
    // which always prints its clef regardless), this measure isn't the
    // first, so no clef field means "no change" rather than "no clef"
    expect(added.measures[1]).toEqual({
      contents: NonEmptyArray.of([RestBacking.emptyStaffContent(fourFour)]),
    });
  });

  it('continues the time signature actually in force, not necessarily the score default', () => {
    const staves = [Staff.of(Clef.Treble)];
    const first = RestBacking.emptyMeasure(fourFour, staves);
    const second = { ...RestBacking.emptyMeasure(threeFour, staves), time: threeFour };
    const score = buildScore({ time: fourFour, staves, measures: [first, second] });

    const added = MeasureOps.addMeasure(score);

    expect(added.measures[2].contents[0].voices[0].elements).toEqual(
      RestBacking.wholeMeasureRests(threeFour),
    );
  });

  it('leaves the clef unset — an explicit clef means a change, and nothing changed here', () => {
    const staves = [Staff.of(Clef.Treble)];
    const first = {
      contents: NonEmptyArray.of([
        StaffContent.singleVoice(RestBacking.wholeMeasureRests(fourFour)),
      ]),
    };
    const second = {
      contents: NonEmptyArray.of([
        StaffContent.singleVoice(RestBacking.wholeMeasureRests(fourFour), Clef.Bass),
      ]),
    };
    const score = buildScore({ time: fourFour, staves, measures: [first, second] });

    const added = MeasureOps.addMeasure(score);

    expect(added.measures[2].contents[0].clef).toBeUndefined();
    // still resolves to the effective clef (Bass, from the change two
    // measures back), it just isn't re-declared as a change here
    expect(ContextWalk.walk(added)[2][0].clef).toBe(Clef.Bass);
  });
});

describe('MeasureOps.removeLastMeasure', () => {
  it('drops the last measure, leaving the rest untouched', () => {
    const staves = [Staff.of(Clef.Treble)];
    const first = RestBacking.emptyMeasure(fourFour, staves);
    const second = {
      contents: NonEmptyArray.of([
        StaffContent.singleVoice(NonEmptyArray.of([Note.of(g4, whole)])),
      ]),
    };
    const score = buildScore({ time: fourFour, staves, measures: [first, second] });

    const removed = expectOk(MeasureOps.removeLastMeasure(score));

    expectScoreCheckOk(removed);
    expect(removed.measures).toHaveLength(1);
    expect(removed.measures[0]).toEqual(first);
  });

  it('refuses to leave a score with no measures', () => {
    const staves = [Staff.of(Clef.Treble)];
    const score = buildScore({
      time: fourFour,
      staves,
      measures: [RestBacking.emptyMeasure(fourFour, staves)],
    });

    expectInvalid(MeasureOps.removeLastMeasure(score));
  });

  it('refuses when the last measure has a tied note', () => {
    const staves = [Staff.of(Clef.Treble)];
    const first = {
      contents: NonEmptyArray.of([
        StaffContent.singleVoice(NonEmptyArray.of([Note.of(g4, whole)])),
      ]),
    };
    const second = {
      contents: NonEmptyArray.of([
        StaffContent.singleVoice(NonEmptyArray.of([Note.of(g4, whole, { tie: TieRole.End })])),
      ]),
    };
    const score = buildScore({ time: fourFour, staves, measures: [first, second] });

    expectInvalid(MeasureOps.removeLastMeasure(score));
  });

  it('refuses when the last measure has a slurred note', () => {
    const staves = [Staff.of(Clef.Treble)];
    const first = {
      contents: NonEmptyArray.of([
        StaffContent.singleVoice(NonEmptyArray.of([Note.of(g4, whole)])),
      ]),
    };
    const second = {
      contents: NonEmptyArray.of([
        StaffContent.singleVoice(NonEmptyArray.of([Note.of(g4, whole, { slur: SlurRole.End })])),
      ]),
    };
    const score = buildScore({ time: fourFour, staves, measures: [first, second] });

    expectInvalid(MeasureOps.removeLastMeasure(score));
  });

  it('refuses when the last measure has a tied or slurred chord tone', () => {
    const staves = [Staff.of(Clef.Treble)];
    const tiedChord = expectOk(
      Chord.create([{ pitch: g4, tie: TieRole.End }, { pitch: b4 }], whole),
    );
    const score = buildScore({
      time: fourFour,
      staves,
      measures: [
        RestBacking.emptyMeasure(fourFour, staves),
        { contents: NonEmptyArray.of([StaffContent.singleVoice(NonEmptyArray.of([tiedChord]))]) },
      ],
    });

    expectInvalid(MeasureOps.removeLastMeasure(score));
  });

  it('allows removing a last measure containing an ordinary (untied, unslurred) chord', () => {
    const staves = [Staff.of(Clef.Treble)];
    const chord = expectOk(Chord.create([g4, b4], whole));
    const score = buildScore({
      time: fourFour,
      staves,
      measures: [
        RestBacking.emptyMeasure(fourFour, staves),
        { contents: NonEmptyArray.of([StaffContent.singleVoice(NonEmptyArray.of([chord]))]) },
      ],
    });

    const removed = expectOk(MeasureOps.removeLastMeasure(score));

    expectScoreCheckOk(removed);
    expect(removed.measures).toHaveLength(1);
  });
});
