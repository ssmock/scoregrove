import { describe, expect, it } from 'vitest';
import { Clef } from '@scoregrove/domain/Clef';
import { Duration, NoteValue, Tuplet } from '@scoregrove/domain/Duration';
import { Mode } from '@scoregrove/domain/KeySignature';
import { StaffContent, type Measure } from '@scoregrove/domain/Measure';
import { Note, Rest, type MeasureElement } from '@scoregrove/domain/MeasureElement';
import { NonEmptyArray } from '@scoregrove/domain/NonEmptyArray';
import { GraceNote, GraceStyle } from '@scoregrove/domain/Notations';
import { PitchClass, PitchLetter } from '@scoregrove/domain/Pitch';
import { PositiveInteger } from '@scoregrove/domain/PositiveInteger';
import { Score } from '@scoregrove/domain/Score';
import { Staff } from '@scoregrove/domain/Staff';
import { BeatUnit } from '@scoregrove/domain/TimeSignature';
import { ContextWalk } from '../src/ContextWalk';
import { Fixtures } from '../src/Fixtures';
import type { LaidOutNote } from '../src/LayoutTree';
import { MeasureLayout } from '../src/MeasureLayout';
import { pitch } from './helpers';

const scoreOf = (elements: MeasureElement[][]): Score =>
  Score.of({
    staves: NonEmptyArray.of([Staff.of(Clef.Treble)]),
    key: { tonic: PitchClass.of(PitchLetter.C), mode: Mode.Major },
    time: { beats: PositiveInteger.of(4), beatUnit: BeatUnit.Quarter },
    measures: NonEmptyArray.of(
      elements.map((measureElements): Measure => ({
        contents: NonEmptyArray.of([StaffContent.singleVoice(NonEmptyArray.of(measureElements))]),
      })),
    ),
  });

const layoutFirst = (score: Score) =>
  MeasureLayout.layout({
    contexts: ContextWalk.walk(score)[0],
    measure: score.measures[0],
    measureIndex: 0,
  })[0];

describe('Grace notes', () => {
  it('lays the melody acciaccatura before its principal, slashed and scaled', () => {
    const melody = Fixtures.monophonicMelody();
    const laid = MeasureLayout.layout({
      contexts: ContextWalk.walk(melody)[3],
      measure: melody.measures[3],
      measureIndex: 3,
    })[0];
    const shine = laid.elements.find(
      (e): e is LaidOutNote => e.kind === 'note' && (e.graces?.length ?? 0) > 0,
    );

    expect(shine).toBeDefined();

    const [grace] = shine!.graces!;

    expect(grace.scale).toBeCloseTo(0.6);
    expect(grace.x).toBeLessThan(shine!.x);
    expect(grace.slash).toBeDefined();
    expect(grace.flag?.glyph).toBe('flag8thUp');
    expect(grace.stem.top).toBeLessThan(grace.stem.bottom);
  });

  it('leaves the appoggiatura unslashed', () => {
    const score = scoreOf([
      [
        Note.of(pitch(PitchLetter.C, 5), Duration.of(NoteValue.Whole), {
          graces: NonEmptyArray.of([
            GraceNote.of(pitch(PitchLetter.B, 4), GraceStyle.Appoggiatura),
          ]),
        }),
      ],
    ]);

    const laid = layoutFirst(score);
    const note = laid.elements.find((e): e is LaidOutNote => e.kind === 'note');

    expect(note!.graces![0].slash).toBeUndefined();
  });

  it('carves pre-onset room: graces sit before the accidental, widening the prefix', () => {
    const withGraces = scoreOf([
      [
        Note.of(pitch(PitchLetter.F, 4), Duration.of(NoteValue.Whole), {
          graces: NonEmptyArray.of([
            GraceNote.of(pitch(PitchLetter.E, 4), GraceStyle.Acciaccatura),
            GraceNote.of(pitch(PitchLetter.F, 4), GraceStyle.Acciaccatura),
          ]),
        }),
      ],
    ]);
    const without = scoreOf([[Note.of(pitch(PitchLetter.F, 4), Duration.of(NoteValue.Whole))]]);

    const laidWith = layoutFirst(withGraces);
    const laidWithout = layoutFirst(without);
    const note = laidWith.elements.find((e): e is LaidOutNote => e.kind === 'note')!;
    const bare = laidWithout.elements.find((e): e is LaidOutNote => e.kind === 'note')!;

    // The principal notehead moves right to make room for the grace block
    expect(note.x).toBeGreaterThan(bare.x);
    note.graces!.forEach((grace) => expect(grace.x).toBeLessThan(note.x));
  });
});

describe('Tuplets', () => {
  it('marks the repeats fixture triplet with a bracket over unbeamed halves', () => {
    const piece = Fixtures.repeatsAndNavigation();
    const laid = MeasureLayout.layout({
      contexts: ContextWalk.walk(piece)[3],
      measure: piece.measures[3],
      measureIndex: 3,
    })[0];

    expect(laid.tuplets).toHaveLength(1);

    const [tuplet] = laid.tuplets;
    const notes = laid.elements.filter((e): e is LaidOutNote => e.kind === 'note');

    expect(tuplet.label).toBe('3');
    expect(tuplet.bracket).toBe(true);
    expect(tuplet.x1).toBeLessThan(notes[0].x);
    expect(tuplet.x2).toBeGreaterThan(notes[2].x);
    expect(tuplet.y).toBeLessThan(0);
  });

  it('shows only the number over a fully beamed triplet', () => {
    const triplet = (letter: PitchLetter) =>
      Note.of(pitch(letter, 4), Duration.of(NoteValue.Eighth, { tuplet: Tuplet.triplet() }));
    const score = scoreOf([
      [
        triplet(PitchLetter.C),
        triplet(PitchLetter.D),
        triplet(PitchLetter.E),
        Note.of(pitch(PitchLetter.F, 4), Duration.of(NoteValue.Half)),
        Note.of(pitch(PitchLetter.G, 4), Duration.of(NoteValue.Quarter)),
      ],
    ]);

    const laid = layoutFirst(score);

    expect(laid.tuplets).toHaveLength(1);
    expect(laid.tuplets[0].bracket).toBe(false);
  });

  it('keeps rests inside a tuplet run', () => {
    const score = scoreOf([
      [
        Note.of(
          pitch(PitchLetter.C, 4),
          Duration.of(NoteValue.Quarter, { tuplet: Tuplet.triplet() }),
        ),
        Rest.of(Duration.of(NoteValue.Quarter, { tuplet: Tuplet.triplet() })),
        Note.of(
          pitch(PitchLetter.E, 4),
          Duration.of(NoteValue.Quarter, { tuplet: Tuplet.triplet() }),
        ),
        Note.of(pitch(PitchLetter.F, 4), Duration.of(NoteValue.Half)),
      ],
    ]);

    const laid = layoutFirst(score);

    expect(laid.tuplets).toHaveLength(1);
    expect(laid.tuplets[0].bracket).toBe(true);
  });

  it('marks nothing without tuplets', () => {
    const melody = Fixtures.monophonicMelody();
    const laid = MeasureLayout.layout({
      contexts: ContextWalk.walk(melody)[0],
      measure: melody.measures[0],
      measureIndex: 0,
    })[0];

    expect(laid.tuplets).toEqual([]);
  });
});
