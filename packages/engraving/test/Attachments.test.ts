import { describe, expect, it } from 'vitest';
import { Clef } from '@scoregrove/domain/Clef';
import { Duration, NoteValue } from '@scoregrove/domain/Duration';
import { Mode } from '@scoregrove/domain/KeySignature';
import { StaffContent } from '@scoregrove/domain/Measure';
import { Chord, type MeasureElement } from '@scoregrove/domain/MeasureElement';
import { NonEmptyArray } from '@scoregrove/domain/NonEmptyArray';
import { Articulation } from '@scoregrove/domain/Notations';
import { PitchClass, PitchLetter } from '@scoregrove/domain/Pitch';
import { PositiveInteger } from '@scoregrove/domain/PositiveInteger';
import { Score } from '@scoregrove/domain/Score';
import { Staff } from '@scoregrove/domain/Staff';
import { BeatUnit } from '@scoregrove/domain/TimeSignature';
import { ContextWalk } from '../src/ContextWalk';
import { Fixtures } from '../src/Fixtures';
import type { LaidOutChord, LaidOutNote } from '../src/LayoutTree';
import { MeasureLayout } from '../src/MeasureLayout';
import { ScoreLayout } from '../src/ScoreLayout';
import { StaffPosition } from '../src/StaffPosition';
import { expectOk, pitch } from './helpers';

const melody = Fixtures.monophonicMelody();
const contexts = ContextWalk.walk(melody);

const notesOf = (measureIndex: number): LaidOutNote[] =>
  MeasureLayout.layout({
    contexts: contexts[measureIndex],
    measure: melody.measures[measureIndex],
    measureIndex,
  })[0].elements.filter((e): e is LaidOutNote => e.kind === 'note');

describe('Articulations on notes', () => {
  it('places staccato dots opposite the up-stems of the beamed pair', () => {
    const [, a4, b4] = notesOf(0);

    // Both eighths beam with up-stems, so the dots go below the noteheads
    [a4, b4].forEach((note) => {
      expect(note.articulations).toHaveLength(1);

      const [dot] = note.articulations!;

      expect(dot.glyph).toBe('articStaccatoBelow');
      expect(dot.y).toBeGreaterThan(StaffPosition.y(note.position));
    });
  });

  it('places the accent above a down-stem note', () => {
    const [cSharp] = notesOf(2);
    const [accent] = cSharp.articulations!;

    expect(cSharp.stem?.direction).toBe('Down');
    expect(accent.glyph).toBe('articAccentAbove');
    expect(accent.y).toBeLessThan(StaffPosition.y(cSharp.position));
  });

  it('lifts the fermata above the final note', () => {
    const finalNote = notesOf(3).at(-1)!;

    expect(finalNote.fermata?.glyph).toBe('fermataAbove');
    expect(finalNote.fermata!.y).toBeLessThanOrEqual(-1.5);
    expect(finalNote.fermata!.y).toBeLessThan(finalNote.stem!.top);
  });
});

describe('Articulations on chords', () => {
  it('stacks marks beyond the extreme tone opposite the stem', () => {
    const chord = expectOk(
      Chord.create(
        [pitch(PitchLetter.C, 4), pitch(PitchLetter.G, 4)],
        Duration.of(NoteValue.Whole),
        { articulations: NonEmptyArray.of([Articulation.Tenuto]) },
      ),
    );

    const elements: MeasureElement[] = [chord];
    const score = Score.of({
      staves: NonEmptyArray.of([Staff.of(Clef.Treble)]),
      key: { tonic: PitchClass.of(PitchLetter.C), mode: Mode.Major },
      time: { beats: PositiveInteger.of(4), beatUnit: BeatUnit.Quarter },
      measures: NonEmptyArray.of([
        { contents: NonEmptyArray.of([StaffContent.singleVoice(NonEmptyArray.of(elements))]) },
      ]),
    });

    const laid = MeasureLayout.layout({
      contexts: ContextWalk.walk(score)[0],
      measure: score.measures[0],
      measureIndex: 0,
    })[0].elements.find((e): e is LaidOutChord => e.kind === 'chord');

    // Whole-note chord is stemless: marks go above the top tone (G4)
    const [tenuto] = laid!.articulations!;

    expect(tenuto.glyph).toBe('articTenutoAbove');
    expect(tenuto.y).toBeLessThan(
      StaffPosition.y(StaffPosition.of(Clef.Treble, pitch(PitchLetter.G, 4))),
    );
  });
});

describe('ScoreLayout.staffLabels', () => {
  it('carries each staff label for the first system', () => {
    expect(ScoreLayout.layout(Fixtures.twoStaffMultiVoice(), { width: 60 }).staffLabels).toEqual([
      'RH',
      'LH',
    ]);

    expect(ScoreLayout.layout(melody, { width: 60 }).staffLabels).toEqual([undefined]);
  });
});
