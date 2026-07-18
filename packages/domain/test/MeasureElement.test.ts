import { describe, expect, it } from 'vitest';
import { Duration, NoteValue } from '../src/Duration';
import { DynamicMark } from '../src/Dynamic';
import {
  Chord,
  ChordTone,
  DynamicElement,
  Note,
  Rest,
  TieRole,
  type MeasureElement,
} from '../src/MeasureElement';
import { NonEmptyArray } from '../src/NonEmptyArray';
import { Articulation, SlurRole } from '../src/Notations';
import { Accidental, Octave, Pitch, PitchClass, PitchLetter } from '../src/Pitch';
import { expectInvalid, expectOk, expectVocabulary } from './helpers';

const c4 = Pitch.of(PitchClass.of(PitchLetter.C), Octave.of(4));
const e4 = Pitch.of(PitchClass.of(PitchLetter.E), Octave.of(4));
const g4 = Pitch.of(PitchClass.of(PitchLetter.G), Octave.of(4));
const quarter = Duration.of(NoteValue.Quarter);
const half = Duration.of(NoteValue.Half);

describe('TieRole', () => {
  it('covers tie participation', () => {
    expectVocabulary(TieRole, ['Begin', 'End', 'Both']);
  });
});

describe('Note', () => {
  it('builds a bare note', () => {
    expect(Note.of(c4, quarter)).toEqual({ kind: 'note', pitch: c4, duration: quarter });
  });

  it('carries tie and notations when given', () => {
    const note = Note.of(c4, quarter, {
      tie: TieRole.Begin,
      slur: SlurRole.Begin,
      articulations: NonEmptyArray.of([Articulation.Staccato]),
      fermata: true,
    });

    expect(note.tie).toBe('Begin');
    expect(note.slur).toBe('Begin');
    expect(note.articulations).toEqual(['Staccato']);
    expect(note.fermata).toBe(true);
  });
});

describe('Rest', () => {
  it('builds a bare rest', () => {
    expect(Rest.of(quarter)).toEqual({ kind: 'rest', duration: quarter });
  });

  it('carries a fermata when given', () => {
    expect(Rest.of(quarter, { fermata: true }).fermata).toBe(true);
  });
});

describe('ChordTone', () => {
  it('omits an absent tie', () => {
    expect(ChordTone.of(c4)).toEqual({ pitch: c4 });
  });

  it('carries a tie when given', () => {
    expect(ChordTone.of(c4, TieRole.End)).toEqual({ pitch: c4, tie: 'End' });
  });
});

describe('Chord', () => {
  it('normalizes plain pitches into tones', () => {
    const chord = expectOk(Chord.create([c4, e4, g4], half));

    expect(chord.kind).toBe('chord');
    expect(chord.tones).toEqual([{ pitch: c4 }, { pitch: e4 }, { pitch: g4 }]);
    expect(chord.duration).toBe(half);
  });

  it('accepts mixed pitch and tone input, preserving per-tone ties', () => {
    const chord = expectOk(Chord.create([ChordTone.of(c4, TieRole.Begin), e4], half));

    expect(chord.tones[0].tie).toBe('Begin');
    expect(chord.tones[1].tie).toBeUndefined();
  });

  it('carries chord-level notations', () => {
    const chord = expectOk(
      Chord.create([c4, e4], half, { articulations: NonEmptyArray.of([Articulation.Tenuto]) }),
    );

    expect(chord.articulations).toEqual(['Tenuto']);
  });

  it('rejects fewer than two tones', () => {
    const error = expectInvalid(Chord.create([c4], half));
    expect(error.messages).toEqual(['A chord requires at least two tones']);
  });

  it('rejects empty and null input', () => {
    const error = expectInvalid(Chord.create([], half));
    expect(error.messages).toEqual(['Chord tones must contain at least one item']);
    expectInvalid(Chord.create(null, half));
  });

  it('rejects duplicate pitches, treating Natural as no accidental', () => {
    const cNatural4 = Pitch.of(PitchClass.of(PitchLetter.C, Accidental.Natural), Octave.of(4));
    const error = expectInvalid(Chord.create([c4, cNatural4, e4], half));
    expect(error.messages).toEqual(['A chord cannot repeat a pitch: C4']);
  });
});

describe('DynamicElement', () => {
  it('wraps a dynamic indication', () => {
    expect(DynamicElement.of(DynamicMark.Forte)).toEqual({ kind: 'dynamic', dynamic: 'Forte' });
  });
});

describe('element type guards', () => {
  const elements: MeasureElement[] = [
    Note.of(c4, quarter),
    Rest.of(quarter),
    expectOk(Chord.create([c4, e4], half)),
    DynamicElement.of(DynamicMark.Piano),
  ];

  it('discriminate by kind', () => {
    expect(elements.map((e) => Note.is(e))).toEqual([true, false, false, false]);
    expect(elements.map((e) => Rest.is(e))).toEqual([false, true, false, false]);
    expect(elements.map((e) => Chord.is(e))).toEqual([false, false, true, false]);
    expect(elements.map((e) => DynamicElement.is(e))).toEqual([false, false, false, true]);
  });
});
