import { describe, expect, it } from 'vitest';
import { ClosingBarline } from '@scoregrove/domain/Barline';
import { Duration, NoteValue } from '@scoregrove/domain/Duration';
import { StaffContent, type Measure } from '@scoregrove/domain/Measure';
import { Rest } from '@scoregrove/domain/MeasureElement';
import { NonEmptyArray } from '@scoregrove/domain/NonEmptyArray';
import { ContextWalk } from '../src/ContextWalk';
import { Fixtures } from '../src/Fixtures';
import type { LaidOutNote, LaidOutRest } from '../src/LayoutTree';
import { MeasureLayout } from '../src/MeasureLayout';
import { StemDirection } from '../src/Stems';

const melody = Fixtures.monophonicMelody();
const contexts = ContextWalk.walk(melody);

const layoutMeasure = (measureIndex: number) =>
  MeasureLayout.layout({
    contexts: contexts[measureIndex],
    measure: melody.measures[measureIndex],
    measureIndex,
  })[0];

describe('MeasureLayout.layout', () => {
  it('prints clef, key, and time at the first measure only', () => {
    const first = layoutMeasure(0);
    const second = layoutMeasure(1);

    expect(first.signatures.map((laid) => laid.glyph)).toEqual([
      'gClef',
      'accidentalSharp',
      'timeSig4',
      'timeSig4',
    ]);
    expect(second.signatures).toEqual([]);
  });

  it('lays elements left to right with increasing x', () => {
    const laid = layoutMeasure(0);
    const xs = laid.elements.map((element) => element.x);

    expect(laid.elements).toHaveLength(6);
    expect([...xs].sort((a, b) => a - b)).toEqual(xs);
    expect(laid.width).toBeGreaterThan(xs[xs.length - 1]);
  });

  it('attaches an opening dynamic at the first note', () => {
    const laid = layoutMeasure(0);
    const [dynamic, firstNote] = laid.elements;

    expect(dynamic).toMatchObject({ kind: 'dynamic', glyph: 'dynamicPiano', y: 7 });
    expect(dynamic.x).toBe(firstNote.x);
  });

  it('gives short notes stems and long notes none', () => {
    const laid = layoutMeasure(2);
    const notes = laid.elements.filter((e): e is LaidOutNote => e.kind === 'note');

    // C♯5 quarter: stemmed, no flag; D5 half at position 2: stem down, no flag
    expect(notes[0].stem).toBeDefined();
    expect(notes[0].flag).toBeUndefined();
    expect(notes[2].stem?.direction).toBe(StemDirection.Down);
  });

  it('flags an isolated eighth but beams runs sharing a beat', () => {
    const laid = layoutMeasure(1);
    const notes = laid.elements.filter((e): e is LaidOutNote => e.kind === 'note');

    // The eighth after the dotted quarter is alone in its beat: flagged
    expect(notes[1].flag?.glyph).toBe('flag8thUp');

    // The four sixteenths beam as one group: no flags, a two-level beam
    const sixteenths = notes.slice(2);

    sixteenths.forEach((note) => expect(note.flag).toBeUndefined());
    expect(laid.beams.filter((beam) => beam.level === 1)).toHaveLength(1);
    expect(laid.beams.filter((beam) => beam.level === 2)).toHaveLength(1);

    // Every stem in the group ends on the primary beam line
    const [primary] = laid.beams;
    const up = primary.direction === StemDirection.Up;

    sixteenths.forEach((note) => {
      const tip = up ? note.stem!.top : note.stem!.bottom;
      const slope = (primary.y2 - primary.y1) / (primary.x2 - primary.x1);

      expect(tip).toBeCloseTo(primary.y1 + slope * (note.stem!.x - primary.x1));
    });
  });

  it('beams the eighth pair in the opening measure with one direction', () => {
    const laid = layoutMeasure(0);
    const notes = laid.elements.filter((e): e is LaidOutNote => e.kind === 'note');

    // A4 and B4 eighths share a beat: beamed together, uniform stems
    expect(notes[1].flag).toBeUndefined();
    expect(notes[2].flag).toBeUndefined();
    expect(notes[1].stem?.direction).toBe(notes[2].stem?.direction);
    expect(laid.beams).toHaveLength(1);
  });

  it('resolves printed accidentals against key and measure', () => {
    const laid = layoutMeasure(2);
    const notes = laid.elements.filter((e): e is LaidOutNote => e.kind === 'note');

    expect(notes[0].accidental?.glyph).toBe('accidentalSharp');
    expect(notes[0].accidental!.x).toBeLessThan(notes[0].x);
    expect(notes[1].accidental?.glyph).toBe('accidentalNatural');
    expect(notes[2].accidental).toBeUndefined();
  });

  it('marks dotted durations and rests', () => {
    const laid = layoutMeasure(1);
    const [dotted] = laid.elements;
    const rest = laid.elements.at(-1) as LaidOutRest;

    expect(dotted.kind).toBe('note');
    expect((dotted as LaidOutNote).dots).toHaveLength(1);
    expect(rest).toMatchObject({ kind: 'rest', glyph: 'restQuarter', y: 2 });
  });

  it('centers a whole-measure rest in the music region', () => {
    const measure: Measure = {
      contents: NonEmptyArray.of([
        StaffContent.singleVoice(NonEmptyArray.of([Rest.of(Duration.of(NoteValue.Whole))])),
      ]),
    };

    const laid = MeasureLayout.layout({
      contexts: contexts[1],
      measure,
      measureIndex: 1,
    })[0];

    const [rest] = laid.elements as LaidOutRest[];
    const musicCenter = laid.width / 2;

    // Signatures are absent at measure 1, so the region is nearly the measure
    expect(rest.x).toBeGreaterThan(musicCenter - 2);
    expect(rest.x).toBeLessThan(musicCenter);

    // A half rest beside another element stays at its column
    const twoRests: Measure = {
      contents: NonEmptyArray.of([
        StaffContent.singleVoice(
          NonEmptyArray.of([
            Rest.of(Duration.of(NoteValue.Half)),
            Rest.of(Duration.of(NoteValue.Half)),
          ]),
        ),
      ]),
    };

    const laidTwo = MeasureLayout.layout({
      contexts: contexts[1],
      measure: twoRests,
      measureIndex: 1,
    })[0];

    expect((laidTwo.elements[0] as LaidOutRest).x).toBeLessThan(laidTwo.width / 4);
  });

  it('places a fermata over a marked rest', () => {
    const measure: Measure = {
      contents: NonEmptyArray.of([
        StaffContent.singleVoice(
          NonEmptyArray.of([
            Rest.of(Duration.of(NoteValue.Half), { fermata: true }),
            Rest.of(Duration.of(NoteValue.Half)),
          ]),
        ),
      ]),
    };

    const laid = MeasureLayout.layout({
      contexts: contexts[1],
      measure,
      measureIndex: 1,
    })[0];

    const [held, plain] = laid.elements as LaidOutRest[];

    expect(held.fermata?.glyph).toBe('fermataAbove');
    expect(held.fermata!.y).toBeLessThan(0);
    expect(plain.fermata).toBeUndefined();
  });

  it('passes barlines through, defaulting the closing to Regular', () => {
    expect(layoutMeasure(0).closing).toBe(ClosingBarline.Regular);
    expect(layoutMeasure(3).closing).toBe(ClosingBarline.Final);
  });

  it('keeps score addresses pointing at the domain elements', () => {
    const laid = layoutMeasure(0);
    const dynamic = laid.elements.find((element) => element.kind === 'dynamic');
    const addresses = laid.elements.map((element) => element.address.element);

    expect(dynamic?.address).toEqual({ measure: 0, staff: 0, voice: 0, element: 0 });
    expect(new Set(addresses).size).toBe(addresses.length);
  });

  it('prints no accidental on a note the key already covers', () => {
    const laid = layoutMeasure(1);
    const fSharp = laid.elements.find(
      (e): e is LaidOutNote => e.kind === 'note' && e.position === -3,
    );

    expect(fSharp).toBeDefined();
    expect(fSharp?.accidental).toBeUndefined();
  });
});

describe('MeasureLayout.layout across staves and voices', () => {
  const piece = Fixtures.twoStaffMultiVoice();
  const pieceContexts = ContextWalk.walk(piece);

  const layoutFirst = () =>
    MeasureLayout.layout({
      contexts: pieceContexts[0],
      measure: piece.measures[0],
      measureIndex: 0,
    });

  const notesOf = (laid: { elements: readonly { kind: string }[] }, voice?: number) =>
    laid.elements.filter(
      (e): e is LaidOutNote =>
        e.kind === 'note' && (voice === undefined || (e as LaidOutNote).address.voice === voice),
    );

  it('gives every staff the same width', () => {
    const [treble, bass] = layoutFirst();

    expect(treble.width).toBe(bass.width);
  });

  it('aligns simultaneous onsets on one column across staves and voices', () => {
    const [treble, bass] = layoutFirst();
    const upperFirst = notesOf(treble, 0)[0];
    const lowerFirst = notesOf(treble, 1)[0];
    const bassFirst = notesOf(bass)[0];

    // E5 (voice 1), C5 (voice 2), and the bass whole note all sound at onset 0
    expect(upperFirst.x).toBe(lowerFirst.x);
    expect(upperFirst.x).toBe(bassFirst.x);
  });

  it('places later onsets of different voices on their own columns', () => {
    const [treble] = layoutFirst();
    const upper = notesOf(treble, 0);
    const lower = notesOf(treble, 1);

    // Voice 1: quarters at 0 and 1/4; voice 2: halves at 0 and 1/2
    expect(upper[1].x).toBeGreaterThan(upper[0].x);
    expect(lower[1].x).toBeGreaterThan(upper[1].x);

    // Voice 1's half at 1/2 shares the column of voice 2's second half
    expect(upper[2].x).toBe(lower[1].x);
  });

  it('stems the first voice up and the second down', () => {
    const [treble] = layoutFirst();

    notesOf(treble, 0).forEach((note) => {
      if (note.stem) expect(note.stem.direction).toBe(StemDirection.Up);
    });

    notesOf(treble, 1).forEach((note) => {
      if (note.stem) expect(note.stem.direction).toBe(StemDirection.Down);
    });
  });

  it('addresses every element with its true staff and voice', () => {
    const [treble, bass] = layoutFirst();

    expect(notesOf(treble, 1).length).toBeGreaterThan(0);
    notesOf(treble).forEach((note) => expect(note.address.staff).toBe(0));
    notesOf(bass).forEach((note) => expect(note.address.staff).toBe(1));
  });
});
