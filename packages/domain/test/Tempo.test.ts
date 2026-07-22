import { describe, expect, it } from 'vitest';
import { NoteValue } from '../src/Duration';
import { PositiveInteger } from '../src/PositiveInteger';
import { MetronomeMark, Tempo, TempoChange, TempoMarking } from '../src/Tempo';
import { expectInvalid, expectOk, expectVocabulary } from './helpers';

describe('TempoMarking', () => {
  it('covers the traditional markings, slowest to fastest', () => {
    expectVocabulary(TempoMarking, [
      'Larghissimo',
      'Grave',
      'Largo',
      'Larghetto',
      'Adagio',
      'Adagietto',
      'Andante',
      'Andantino',
      'Moderato',
      'Allegretto',
      'Allegro',
      'Vivace',
      'Vivacissimo',
      'Presto',
      'Prestissimo',
    ]);
  });
});

describe('TempoChange', () => {
  it('covers the change instructions', () => {
    expectVocabulary(TempoChange, [
      'Accelerando',
      'Ritardando',
      'Rallentando',
      'Ritenuto',
      'ATempo',
    ]);
  });
});

describe('MetronomeMark', () => {
  it('builds a plain and a dotted mark', () => {
    expect(MetronomeMark.of(NoteValue.Quarter, PositiveInteger.of(120))).toEqual({
      noteValue: NoteValue.Quarter,
      bpm: 120,
    });
    expect(MetronomeMark.of(NoteValue.Quarter, PositiveInteger.of(80), 1)).toEqual({
      noteValue: NoteValue.Quarter,
      dots: 1,
      bpm: 80,
    });
  });

  it('validates the beats-per-minute count in create', () => {
    expect(expectOk(MetronomeMark.create(NoteValue.Quarter, 132))).toEqual({
      noteValue: NoteValue.Quarter,
      bpm: 132,
    });
    expectInvalid(MetronomeMark.create(NoteValue.Quarter, 0));
    expectInvalid(MetronomeMark.create(NoteValue.Quarter, -4));
    expectInvalid(MetronomeMark.create(NoteValue.Quarter, 90.5));
  });

  it('compares by note value, dots, and bpm', () => {
    const mark = MetronomeMark.of(NoteValue.Half, PositiveInteger.of(60));

    expect(
      MetronomeMark.equals(mark, MetronomeMark.of(NoteValue.Half, PositiveInteger.of(60))),
    ).toBe(true);
    expect(
      MetronomeMark.equals(mark, MetronomeMark.of(NoteValue.Half, PositiveInteger.of(66))),
    ).toBe(false);
    expect(
      MetronomeMark.equals(mark, MetronomeMark.of(NoteValue.Half, PositiveInteger.of(60), 1)),
    ).toBe(false);
  });

  it('formats as conventional prose', () => {
    expect(MetronomeMark.format(MetronomeMark.of(NoteValue.Quarter, PositiveInteger.of(120)))).toBe(
      'quarter = 120',
    );
    expect(
      MetronomeMark.format(MetronomeMark.of(NoteValue.Quarter, PositiveInteger.of(80), 1)),
    ).toBe('dotted quarter = 80');
    expect(MetronomeMark.format(MetronomeMark.of(NoteValue.Half, PositiveInteger.of(50), 2))).toBe(
      'double-dotted half = 50',
    );
  });
});

describe('Tempo', () => {
  it('lists the string tempos (markings and changes)', () => {
    expect(Tempo.values).toHaveLength(20);
    expect(Tempo.is(TempoMarking.Allegro)).toBe(true);
    expect(Tempo.is(TempoChange.Ritardando)).toBe(true);
    expect(Tempo.is('Fast')).toBe(false);
  });

  it('recognizes a metronome mark as a tempo', () => {
    const mark = MetronomeMark.of(NoteValue.Quarter, PositiveInteger.of(120));

    expect(Tempo.is(mark)).toBe(true);
    expect(Tempo.is({ noteValue: 'Quarter', bpm: 120 })).toBe(true);
    // structurally invalid metronome shapes are not tempos
    expect(Tempo.is({ noteValue: 'Quarter' })).toBe(false);
    expect(Tempo.is({ noteValue: 'Quarter', bpm: -1 })).toBe(false);
    expect(Tempo.is({ noteValue: 'NotANote', bpm: 120 })).toBe(false);
  });

  it('discriminates the three tempo kinds', () => {
    const mark = MetronomeMark.of(NoteValue.Quarter, PositiveInteger.of(120));

    expect(Tempo.isMarking(TempoMarking.Allegro)).toBe(true);
    expect(Tempo.isMarking(TempoChange.Ritardando)).toBe(false);
    expect(Tempo.isMarking(mark)).toBe(false);

    expect(Tempo.isChange(TempoChange.Ritardando)).toBe(true);
    expect(Tempo.isChange(TempoMarking.Allegro)).toBe(false);
    expect(Tempo.isChange(mark)).toBe(false);

    expect(Tempo.isMetronome(mark)).toBe(true);
    expect(Tempo.isMetronome(TempoMarking.Allegro)).toBe(false);
    expect(Tempo.isMetronome(TempoChange.Ritardando)).toBe(false);
  });
});
