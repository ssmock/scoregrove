import { describe, expect, it } from 'vitest';
import { Clef } from '@scoregrove/domain/Clef';
import { ClosingBarline, OpeningBarline } from '@scoregrove/domain/Barline';
import { Duration, NoteValue } from '@scoregrove/domain/Duration';
import { Mode } from '@scoregrove/domain/KeySignature';
import { StaffContent, type Measure } from '@scoregrove/domain/Measure';
import { Note, type MeasureElement } from '@scoregrove/domain/MeasureElement';
import { NonEmptyArray } from '@scoregrove/domain/NonEmptyArray';
import { PitchClass, PitchLetter } from '@scoregrove/domain/Pitch';
import { PositiveInteger } from '@scoregrove/domain/PositiveInteger';
import { Score } from '@scoregrove/domain/Score';
import { Staff } from '@scoregrove/domain/Staff';
import { MetronomeMark } from '@scoregrove/domain/Tempo';
import { Swing } from '@scoregrove/domain/TimeSignature';
import { BeatUnit } from '@scoregrove/domain/TimeSignature';
import { ContextWalk } from '../src/ContextWalk';
import { Fixtures } from '../src/Fixtures';
import { MeasureLayout } from '../src/MeasureLayout';
import { SystemLayout } from '../src/SystemLayout';
import { pitch } from './helpers';

const annotationsOf = (score: Score, measureIndex: number) =>
  MeasureLayout.layout({
    contexts: ContextWalk.walk(score)[measureIndex],
    measure: score.measures[measureIndex],
    measureIndex,
  })[0].annotations;

const texts = (annotations: ReturnType<typeof annotationsOf>) =>
  annotations.flatMap((a) => (a.kind === 'text' ? [a.text] : []));

describe('Annotations', () => {
  it('prints the tempo above the first measure only', () => {
    const melody = Fixtures.monophonicMelody();

    expect(texts(annotationsOf(melody, 0))).toContain('Allegretto');
    expect(texts(annotationsOf(melody, 1))).toEqual([]);
  });

  it('joins tempo and swing on one line', () => {
    const score = Score.of({
      staves: NonEmptyArray.of([Staff.of(Clef.Treble)]),
      key: { tonic: PitchClass.of(PitchLetter.C), mode: Mode.Major },
      time: { beats: PositiveInteger.of(4), beatUnit: BeatUnit.Quarter },
      tempo: 'Moderato',
      swing: Swing.MediumSwing,
      measures: NonEmptyArray.of([
        {
          contents: NonEmptyArray.of([
            StaffContent.singleVoice(
              NonEmptyArray.of([Note.of(pitch(PitchLetter.C, 4), Duration.of(NoteValue.Whole))]),
            ),
          ]),
        },
      ]),
    });

    expect(texts(annotationsOf(score, 0))).toContain('Moderato, Medium Swing');
  });

  it('prints an exact metronome mark as its conventional text', () => {
    const score = Score.of({
      staves: NonEmptyArray.of([Staff.of(Clef.Treble)]),
      key: { tonic: PitchClass.of(PitchLetter.C), mode: Mode.Major },
      time: { beats: PositiveInteger.of(4), beatUnit: BeatUnit.Quarter },
      tempo: MetronomeMark.of(NoteValue.Quarter, PositiveInteger.of(120)),
      measures: NonEmptyArray.of([
        {
          contents: NonEmptyArray.of([
            StaffContent.singleVoice(
              NonEmptyArray.of([Note.of(pitch(PitchLetter.C, 4), Duration.of(NoteValue.Whole))]),
            ),
          ]),
        },
      ]),
    });

    expect(texts(annotationsOf(score, 0))).toContain('quarter = 120');
  });

  it('places the navigation furniture of the repeats fixture', () => {
    const piece = Fixtures.repeatsAndNavigation();

    const first = annotationsOf(piece, 0);
    const segno = first.find((a) => a.kind === 'glyph' && a.glyph === 'segno');

    expect(segno).toBeDefined();
    expect(segno!.y).toBeLessThan(0);

    const fineMeasure = annotationsOf(piece, 2);
    const fine = fineMeasure.find((a) => a.kind === 'text' && a.text === 'Fine');

    expect(fine).toMatchObject({ anchor: 'end', italic: true });

    const jumpMeasure = annotationsOf(piece, 3);

    expect(texts(jumpMeasure)).toContain('D.S. al Fine');
  });

  it('prints the repeat count over a closing repeat barline', () => {
    const elements: MeasureElement[] = [
      Note.of(pitch(PitchLetter.C, 4), Duration.of(NoteValue.Whole)),
    ];
    const measure: Measure = {
      contents: NonEmptyArray.of([StaffContent.singleVoice(NonEmptyArray.of(elements))]),
      opening: OpeningBarline.RepeatOpen,
      closing: ClosingBarline.RepeatClose,
      repeatTimes: PositiveInteger.of(3),
    };
    const score = Score.of({
      staves: NonEmptyArray.of([Staff.of(Clef.Treble)]),
      key: { tonic: PitchClass.of(PitchLetter.C), mode: Mode.Major },
      time: { beats: PositiveInteger.of(4), beatUnit: BeatUnit.Quarter },
      measures: NonEmptyArray.of([measure]),
    });

    const laid = annotationsOf(score, 0);
    const count = laid.find((a) => a.kind === 'text' && a.text === '×3');

    expect(count).toMatchObject({ anchor: 'end' });
  });

  it('keeps annotations off later staves', () => {
    const piece = Fixtures.twoStaffMultiVoice();
    const staves = MeasureLayout.layout({
      contexts: ContextWalk.walk(piece)[0],
      measure: piece.measures[0],
      measureIndex: 0,
    });

    expect(staves[1].annotations).toEqual([]);
  });
});

describe('Change clefs', () => {
  it('prints the small variant at a mid-piece change but not at system starts', () => {
    const note = () =>
      NonEmptyArray.of([Note.of(pitch(PitchLetter.C, 4), Duration.of(NoteValue.Whole))]);
    const score = Score.of({
      staves: NonEmptyArray.of([Staff.of(Clef.Treble)]),
      key: { tonic: PitchClass.of(PitchLetter.C), mode: Mode.Major },
      time: { beats: PositiveInteger.of(4), beatUnit: BeatUnit.Quarter },
      measures: NonEmptyArray.of([
        { contents: NonEmptyArray.of([StaffContent.singleVoice(note())]) },
        { contents: NonEmptyArray.of([StaffContent.singleVoice(note(), Clef.Bass)]) },
      ]),
    });

    const system = SystemLayout.unbroken(score);
    const first = system.measures[0].staves[0].signatures.map((laid) => laid.glyph);
    const second = system.measures[1].staves[0].signatures.map((laid) => laid.glyph);

    expect(first).toContain('gClef');
    expect(second).toContain('fClefChange');
    expect(second).not.toContain('fClef');
  });
});
