import { describe, expect, it } from 'vitest';
import { Clef } from '@scoregrove/domain/Clef';
import { Duration, NoteValue } from '@scoregrove/domain/Duration';
import { Mode } from '@scoregrove/domain/KeySignature';
import { StaffContent, type Measure } from '@scoregrove/domain/Measure';
import { Note } from '@scoregrove/domain/MeasureElement';
import { NonEmptyArray } from '@scoregrove/domain/NonEmptyArray';
import { PitchClass, PitchLetter } from '@scoregrove/domain/Pitch';
import { PositiveInteger } from '@scoregrove/domain/PositiveInteger';
import { Score } from '@scoregrove/domain/Score';
import { Staff } from '@scoregrove/domain/Staff';
import { BeatUnit, Swing, type TimeSignature } from '@scoregrove/domain/TimeSignature';
import { ContextWalk } from '../src/ContextWalk';
import { Fixtures } from '../src/Fixtures';
import { pitch } from './helpers';

const threeFour: TimeSignature = { beats: PositiveInteger.of(3), beatUnit: BeatUnit.Quarter };

describe('ContextWalk.walk', () => {
  it('prints everything at the first measure and only changes after', () => {
    const contexts = ContextWalk.walk(Fixtures.monophonicMelody());

    expect(contexts[0][0]).toMatchObject({
      clef: Clef.Treble,
      printClef: true,
      printKey: true,
      printTime: true,
      printTempo: true,
      printSwing: false,
    });

    expect(contexts[1][0]).toMatchObject({
      clef: Clef.Treble,
      printClef: false,
      printKey: false,
      printTime: false,
      printTempo: false,
    });
  });

  it('carries changes forward from the measure that makes them', () => {
    const note = () =>
      NonEmptyArray.of([
        Note.of(pitch(PitchLetter.C, 4), Duration.of(NoteValue.Half, { dots: 1 })),
      ]);
    const measure = (extras: Omit<Measure, 'contents'> = {}, clef?: Clef): Measure => ({
      contents: NonEmptyArray.of([StaffContent.singleVoice(note(), clef)]),
      ...extras,
    });

    const score = Score.of({
      staves: NonEmptyArray.of([Staff.of(Clef.Treble)]),
      key: { tonic: PitchClass.of(PitchLetter.C), mode: Mode.Major },
      time: threeFour,
      measures: NonEmptyArray.of([
        measure(),
        measure({ swing: Swing.MediumSwing }, Clef.Bass),
        measure(),
      ]),
    });

    const contexts = ContextWalk.walk(score);

    expect(contexts[1][0]).toMatchObject({
      clef: Clef.Bass,
      swing: Swing.MediumSwing,
      printClef: true,
      printSwing: true,
    });

    expect(contexts[2][0]).toMatchObject({
      clef: Clef.Bass,
      swing: Swing.MediumSwing,
      printClef: false,
      printSwing: false,
    });
  });
});
