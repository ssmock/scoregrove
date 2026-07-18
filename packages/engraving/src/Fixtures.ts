import { ClosingBarline, OpeningBarline } from '@scoregrove/domain/Barline';
import { Clef } from '@scoregrove/domain/Clef';
import { DotCount, Duration, NoteValue } from '@scoregrove/domain/Duration';
import { DynamicMark } from '@scoregrove/domain/Dynamic';
import type { KeySignature } from '@scoregrove/domain/KeySignature';
import { Mode } from '@scoregrove/domain/KeySignature';
import { StaffContent, Voice, type Measure } from '@scoregrove/domain/Measure';
import {
  DynamicElement,
  Note,
  Rest,
  TieRole,
  type MeasureElement,
} from '@scoregrove/domain/MeasureElement';
import { NavigationJump, NavigationMark } from '@scoregrove/domain/Navigation';
import { NonEmptyArray } from '@scoregrove/domain/NonEmptyArray';
import { NonEmptyString } from '@scoregrove/domain/NonEmptyString';
import { SlurRole } from '@scoregrove/domain/Notations';
import {
  Accidental,
  Octave,
  Pitch,
  PitchClass,
  PitchLetter,
  type Pitch as PitchType,
} from '@scoregrove/domain/Pitch';
import { PositiveInteger } from '@scoregrove/domain/PositiveInteger';
import { Score } from '@scoregrove/domain/Score';
import { Staff } from '@scoregrove/domain/Staff';
import { TempoMarking } from '@scoregrove/domain/Tempo';
import { BeatUnit, type TimeSignature } from '@scoregrove/domain/TimeSignature';

const pitch = (letter: PitchLetter, octave: number, accidental?: Accidental): PitchType =>
  Pitch.of(PitchClass.of(letter, accidental), Octave.of(octave));

const duration = (noteValue: NoteValue, dots?: DotCount): Duration =>
  Duration.of(noteValue, dots ? { dots } : {});

const key = (letter: PitchLetter, mode: Mode, accidental?: Accidental): KeySignature => ({
  tonic: PitchClass.of(letter, accidental),
  mode,
});

const fourFour: TimeSignature = {
  beats: PositiveInteger.of(4),
  beatUnit: BeatUnit.Quarter,
};

const singleVoiceMeasure = (
  elements: MeasureElement[],
  extras: Omit<Measure, 'contents'> = {},
): Measure => ({
  contents: NonEmptyArray.of([StaffContent.singleVoice(NonEmptyArray.of(elements))]),
  ...extras,
});

/**
 * Sample scores powering the Storybook stories, the engraving tests, and the
 * full rendering demo. Each is structurally valid — the test suite holds
 * them to Score.check.
 */
export const Fixtures = {
  /**
   * A four-measure single-staff melody in G major exercising the
   * single-voice slice: mixed note values with dots and sixteenth flags, an
   * opening dynamic, a printed sharp with its later cancellation, a rest, a
   * cross-barline tie, and a final fermata.
   */
  monophonicMelody(): Score {
    return Score.of({
      title: NonEmptyString.of('Study in G'),
      composer: NonEmptyString.of('Scoregrove'),
      staves: NonEmptyArray.of([Staff.of(Clef.Treble)]),
      key: key(PitchLetter.G, Mode.Major),
      time: fourFour,
      tempo: TempoMarking.Allegretto,
      measures: NonEmptyArray.of([
        singleVoiceMeasure([
          DynamicElement.of(DynamicMark.Piano),
          Note.of(pitch(PitchLetter.G, 4), duration(NoteValue.Quarter)),
          Note.of(pitch(PitchLetter.A, 4), duration(NoteValue.Eighth)),
          Note.of(pitch(PitchLetter.B, 4), duration(NoteValue.Eighth)),
          Note.of(pitch(PitchLetter.C, 5), duration(NoteValue.Quarter)),
          Note.of(pitch(PitchLetter.A, 4), duration(NoteValue.Quarter)),
        ]),
        singleVoiceMeasure([
          Note.of(pitch(PitchLetter.B, 4), duration(NoteValue.Quarter, 1)),
          Note.of(pitch(PitchLetter.A, 4), duration(NoteValue.Eighth)),
          Note.of(pitch(PitchLetter.G, 4), duration(NoteValue.Sixteenth)),
          Note.of(pitch(PitchLetter.F, 4), duration(NoteValue.Sixteenth)),
          Note.of(pitch(PitchLetter.G, 4), duration(NoteValue.Sixteenth)),
          Note.of(pitch(PitchLetter.A, 4), duration(NoteValue.Sixteenth)),
          Rest.of(duration(NoteValue.Quarter)),
        ]),
        singleVoiceMeasure([
          Note.of(pitch(PitchLetter.C, 5, Accidental.Sharp), duration(NoteValue.Quarter)),
          Note.of(pitch(PitchLetter.C, 5), duration(NoteValue.Quarter)),
          Note.of(pitch(PitchLetter.D, 5), duration(NoteValue.Half), { tie: TieRole.Begin }),
        ]),
        singleVoiceMeasure(
          [
            Note.of(pitch(PitchLetter.D, 5), duration(NoteValue.Half), { tie: TieRole.End }),
            Note.of(pitch(PitchLetter.C, 5), duration(NoteValue.Quarter)),
            Note.of(pitch(PitchLetter.G, 4), duration(NoteValue.Quarter), { fermata: true }),
          ],
          { closing: ClosingBarline.Final },
        ),
      ]),
    });
  },

  /**
   * Two measures for two staves (treble and bass), the treble carrying two
   * voices in both measures with a slur across the barline in the upper
   * voice — the multi-voice and multi-staff test bed.
   */
  twoStaffMultiVoice(): Score {
    const rightHand = (upper: MeasureElement[], lower: MeasureElement[]): StaffContent =>
      StaffContent.of(
        NonEmptyArray.of([Voice.of(NonEmptyArray.of(upper)), Voice.of(NonEmptyArray.of(lower))]),
      );

    return Score.of({
      title: NonEmptyString.of('Two Hands'),
      staves: NonEmptyArray.of([
        Staff.of(Clef.Treble, NonEmptyString.of('RH')),
        Staff.of(Clef.Bass, NonEmptyString.of('LH')),
      ]),
      key: key(PitchLetter.C, Mode.Major),
      time: fourFour,
      measures: NonEmptyArray.of([
        {
          contents: NonEmptyArray.of([
            rightHand(
              [
                Note.of(pitch(PitchLetter.E, 5), duration(NoteValue.Quarter), {
                  slur: SlurRole.Begin,
                }),
                Note.of(pitch(PitchLetter.F, 5), duration(NoteValue.Quarter)),
                Note.of(pitch(PitchLetter.G, 5), duration(NoteValue.Half)),
              ],
              [
                Note.of(pitch(PitchLetter.C, 5), duration(NoteValue.Half)),
                Note.of(pitch(PitchLetter.B, 4), duration(NoteValue.Half)),
              ],
            ),
            StaffContent.singleVoice(
              NonEmptyArray.of([Note.of(pitch(PitchLetter.C, 3), duration(NoteValue.Whole))]),
            ),
          ]),
        },
        {
          contents: NonEmptyArray.of([
            rightHand(
              [
                Note.of(pitch(PitchLetter.G, 5), duration(NoteValue.Half)),
                Note.of(pitch(PitchLetter.E, 5), duration(NoteValue.Half), {
                  slur: SlurRole.End,
                }),
              ],
              [Note.of(pitch(PitchLetter.C, 5), duration(NoteValue.Whole))],
            ),
            StaffContent.singleVoice(
              NonEmptyArray.of([
                Note.of(pitch(PitchLetter.E, 3), duration(NoteValue.Half)),
                Note.of(pitch(PitchLetter.C, 3), duration(NoteValue.Half)),
              ]),
            ),
          ]),
          closing: ClosingBarline.Final,
        },
      ]),
    });
  },

  /**
   * Four whole-note measures wearing the repeat and navigation furniture: a
   * repeated passage with first and second endings, segno and Fine marks,
   * and a dal segno al Fine jump.
   */
  repeatsAndNavigation(): Score {
    const whole = (letter: PitchLetter): MeasureElement[] => [
      Note.of(pitch(letter, 4), duration(NoteValue.Whole)),
    ];

    return Score.of({
      title: NonEmptyString.of('Roads and Returns'),
      staves: NonEmptyArray.of([Staff.of(Clef.Treble)]),
      key: key(PitchLetter.C, Mode.Major),
      time: fourFour,
      measures: NonEmptyArray.of([
        singleVoiceMeasure(whole(PitchLetter.C), {
          opening: OpeningBarline.RepeatOpen,
          marks: NonEmptyArray.of([NavigationMark.Segno]),
        }),
        singleVoiceMeasure(whole(PitchLetter.D), {
          ending: NonEmptyArray.of([PositiveInteger.of(1)]),
          closing: ClosingBarline.RepeatClose,
        }),
        singleVoiceMeasure(whole(PitchLetter.E), {
          ending: NonEmptyArray.of([PositiveInteger.of(2)]),
          marks: NonEmptyArray.of([NavigationMark.Fine]),
          closing: ClosingBarline.Double,
        }),
        singleVoiceMeasure(whole(PitchLetter.F), {
          jump: NavigationJump.DalSegnoAlFine,
          closing: ClosingBarline.Final,
        }),
      ]),
    });
  },
};
