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
    context: contexts[measureIndex][0],
    measure: melody.measures[measureIndex],
    measureIndex,
    staffIndex: 0,
  });

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

  it('gives short notes stems and flags and long notes neither', () => {
    const laid = layoutMeasure(2);
    const notes = laid.elements.filter((e): e is LaidOutNote => e.kind === 'note');

    // C♯5 quarter: stemmed, no flag; D5 half at position 2: stem down, no flag
    expect(notes[0].stem).toBeDefined();
    expect(notes[0].flag).toBeUndefined();
    expect(notes[2].stem?.direction).toBe(StemDirection.Down);

    const sixteenths = layoutMeasure(1).elements.filter(
      (e): e is LaidOutNote => e.kind === 'note' && e.flag?.glyph === 'flag16thUp',
    );

    expect(sixteenths.length).toBeGreaterThan(0);
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
      context: contexts[1][0],
      measure,
      measureIndex: 1,
      staffIndex: 0,
    });

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
