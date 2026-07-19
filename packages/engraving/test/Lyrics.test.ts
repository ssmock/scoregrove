import { describe, expect, it } from 'vitest';
import { Clef } from '@scoregrove/domain/Clef';
import { Duration, NoteValue } from '@scoregrove/domain/Duration';
import { Mode } from '@scoregrove/domain/KeySignature';
import { StaffContent, type Measure } from '@scoregrove/domain/Measure';
import { Note, type MeasureElement } from '@scoregrove/domain/MeasureElement';
import { NonEmptyArray } from '@scoregrove/domain/NonEmptyArray';
import { NonEmptyString } from '@scoregrove/domain/NonEmptyString';
import { Lyric } from '@scoregrove/domain/Notations';
import { PitchClass, PitchLetter } from '@scoregrove/domain/Pitch';
import { PositiveInteger } from '@scoregrove/domain/PositiveInteger';
import { Score } from '@scoregrove/domain/Score';
import { Staff } from '@scoregrove/domain/Staff';
import { BeatUnit } from '@scoregrove/domain/TimeSignature';
import { ContextWalk } from '../src/ContextWalk';
import { Fixtures } from '../src/Fixtures';
import type { LaidOutNote } from '../src/LayoutTree';
import { MeasureLayout } from '../src/MeasureLayout';
import type { TextMeasurer } from '../src/TextMeasure';
import { pitch } from './helpers';

const melody = Fixtures.monophonicMelody();
const contexts = ContextWalk.walk(melody);

const layoutMeasure = (measureIndex: number, measureText?: TextMeasurer) =>
  MeasureLayout.layout({
    contexts: contexts[measureIndex],
    measure: melody.measures[measureIndex],
    measureIndex,
    ...(measureText ? { measureText } : {}),
  })[0];

describe('Lyrics', () => {
  it('centers each syllable under its notehead on the verse line', () => {
    const laid = layoutMeasure(0);
    const words = laid.lyrics.map((syllable) => syllable.text);

    expect(words).toEqual(['Sing', 'a', 'song', 'of', 'green']);

    const notes = laid.elements.filter((e): e is LaidOutNote => e.kind === 'note');

    laid.lyrics.forEach((syllable, index) => {
      expect(syllable.anchor).toBe('middle');
      expect(syllable.y).toBeGreaterThan(8);
      expect(syllable.x).toBeGreaterThan(notes[index].x);
    });
  });

  it('hyphenates between the syllables of a split word', () => {
    const laid = layoutMeasure(1);
    const texts = laid.lyrics.map((syllable) => syllable.text);

    expect(texts).toEqual(['sum', '-', 'mer']);

    const [sum, hyphen, mer] = laid.lyrics;

    expect(hyphen.x).toBeGreaterThan(sum.x);
    expect(hyphen.x).toBeLessThan(mer.x);
    expect(hyphen.y).toBe(sum.y);
  });

  it('widens a column to fit a long syllable', () => {
    const wide: TextMeasurer = () => 12;
    const narrow: TextMeasurer = () => 1;

    expect(layoutMeasure(0, wide).width).toBeGreaterThan(layoutMeasure(0, narrow).width);
  });

  it('stacks verses on separate lines', () => {
    const verses = (text1: string, text2: string) =>
      NonEmptyArray.of([Lyric.of(NonEmptyString.of(text1)), Lyric.of(NonEmptyString.of(text2))]);

    const elements: MeasureElement[] = [
      Note.of(pitch(PitchLetter.C, 4), Duration.of(NoteValue.Whole), {
        lyrics: verses('one', 'two'),
      }),
    ];
    const measure: Measure = {
      contents: NonEmptyArray.of([StaffContent.singleVoice(NonEmptyArray.of(elements))]),
    };
    const score = Score.of({
      staves: NonEmptyArray.of([Staff.of(Clef.Treble)]),
      key: { tonic: PitchClass.of(PitchLetter.C), mode: Mode.Major },
      time: { beats: PositiveInteger.of(4), beatUnit: BeatUnit.Quarter },
      measures: NonEmptyArray.of([measure]),
    });

    const laid = MeasureLayout.layout({
      contexts: ContextWalk.walk(score)[0],
      measure,
      measureIndex: 0,
    })[0];

    const [first, second] = laid.lyrics;

    expect(first.text).toBe('one');
    expect(second.text).toBe('two');
    expect(second.y).toBeGreaterThan(first.y);
    expect(second.x).toBe(first.x);
  });

  it('skips the hyphen when the continuation is out of reach', () => {
    // "sum-" ends measure 1's lyric row; the sixteenths that follow carry no
    // lyrics, and the word never continues — no dangling hyphen appears
    const laid = layoutMeasure(1);
    const hyphens = laid.lyrics.filter((syllable) => syllable.text === '-');

    expect(hyphens).toHaveLength(1);
  });

  it('leaves unlyriced staves empty', () => {
    const piece = Fixtures.twoStaffMultiVoice();
    const staves = MeasureLayout.layout({
      contexts: ContextWalk.walk(piece)[0],
      measure: piece.measures[0],
      measureIndex: 0,
    });

    staves.forEach((staff) => expect(staff.lyrics).toEqual([]));
  });

  it('respects an injected measurer for syllable extents', () => {
    const spy: string[] = [];
    const measurer: TextMeasurer = (text, style) => {
      spy.push(text);

      return text.length * style.size * 0.52;
    };

    layoutMeasure(0, measurer);

    expect(spy).toContain('Sing');
    expect(spy).toContain('green');
  });
});
