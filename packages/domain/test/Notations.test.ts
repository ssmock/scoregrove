import { describe, expect, it } from 'vitest';
import { NoteValue } from '../src/Duration';
import { NonEmptyString } from '../src/NonEmptyString';
import { Articulation, GraceNote, GraceStyle, Lyric, SlurRole, Syllabic } from '../src/Notations';
import { Octave, Pitch, PitchClass, PitchLetter } from '../src/Pitch';
import { expectVocabulary } from './helpers';

const d5 = Pitch.of(PitchClass.of(PitchLetter.D), Octave.of(5));

describe('Articulation', () => {
  it('covers the attack and length marks', () => {
    expectVocabulary(Articulation, ['Staccato', 'Staccatissimo', 'Tenuto', 'Accent', 'Marcato']);
  });
});

describe('SlurRole', () => {
  it('covers slur participation', () => {
    expectVocabulary(SlurRole, ['Begin', 'End', 'Both']);
  });
});

describe('GraceStyle', () => {
  it('covers the two grace-note styles', () => {
    expectVocabulary(GraceStyle, ['Acciaccatura', 'Appoggiatura']);
  });
});

describe('GraceNote', () => {
  it('defaults to an eighth note', () => {
    expect(GraceNote.of(d5, GraceStyle.Acciaccatura)).toEqual({
      pitch: d5,
      style: 'Acciaccatura',
      noteValue: 'Eighth',
    });
  });

  it('accepts an explicit note value', () => {
    expect(GraceNote.of(d5, GraceStyle.Appoggiatura, NoteValue.Sixteenth).noteValue).toBe(
      'Sixteenth',
    );
  });
});

describe('Syllabic', () => {
  it('covers hyphenation positions', () => {
    expectVocabulary(Syllabic, ['Single', 'Begin', 'Middle', 'End']);
  });
});

describe('Lyric', () => {
  it('omits an absent syllabic', () => {
    expect(Lyric.of(NonEmptyString.of('joy'))).toEqual({ text: 'joy' });
  });

  it('carries a syllabic when given', () => {
    expect(Lyric.of(NonEmptyString.of('glo'), Syllabic.Begin)).toEqual({
      text: 'glo',
      syllabic: 'Begin',
    });
  });
});
