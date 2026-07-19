import { describe, expect, it } from 'vitest';
import { Duration, NoteValue } from '@scoregrove/domain/Duration';
import { DynamicMark } from '@scoregrove/domain/Dynamic';
import { DynamicElement, Note, Rest, type MeasureElement } from '@scoregrove/domain/MeasureElement';
import { PitchLetter } from '@scoregrove/domain/Pitch';
import { PositiveInteger } from '@scoregrove/domain/PositiveInteger';
import { BeatUnit, type TimeSignature } from '@scoregrove/domain/TimeSignature';
import { Beaming } from '../src/Beaming';
import { StemDirection } from '../src/Stems';
import { pitch } from './helpers';

const time = (beats: number, beatUnit: TimeSignature['beatUnit']): TimeSignature => ({
  beats: PositiveInteger.of(beats),
  beatUnit,
});

const note = (noteValue: NoteValue, letter: PitchLetter = PitchLetter.B): MeasureElement =>
  Note.of(pitch(letter, 4), Duration.of(noteValue));

const eighth = () => note(NoteValue.Eighth);
const sixteenth = () => note(NoteValue.Sixteenth);
const quarter = () => note(NoteValue.Quarter);

describe('Beaming.groups', () => {
  it('beams eighths in pairs by the beat in simple meter', () => {
    const groups = Beaming.groups(
      [eighth(), eighth(), eighth(), eighth()],
      time(4, BeatUnit.Quarter),
    );

    expect(groups.map((group) => group.elements)).toEqual([
      [0, 1],
      [2, 3],
    ]);
  });

  it('keeps a full beat of sixteenths in one group', () => {
    const groups = Beaming.groups(
      [sixteenth(), sixteenth(), sixteenth(), sixteenth()],
      time(4, BeatUnit.Quarter),
    );

    expect(groups.map((group) => group.elements)).toEqual([[0, 1, 2, 3]]);
  });

  it('breaks groups at rests and longer notes', () => {
    const groups = Beaming.groups(
      [eighth(), Rest.of(Duration.of(NoteValue.Eighth)), eighth(), eighth(), quarter()],
      time(4, BeatUnit.Quarter),
    );

    expect(groups.map((group) => group.elements)).toEqual([[2, 3]]);
  });

  it('lets dynamics pass through a beam', () => {
    const groups = Beaming.groups(
      [eighth(), DynamicElement.of(DynamicMark.Forte), eighth()],
      time(4, BeatUnit.Quarter),
    );

    expect(groups.map((group) => group.elements)).toEqual([[0, 2]]);
  });

  it('groups compound meter by the dotted beat', () => {
    const groups = Beaming.groups(
      [eighth(), eighth(), eighth(), eighth(), eighth(), eighth()],
      time(6, BeatUnit.Eighth),
    );

    expect(groups.map((group) => group.elements)).toEqual([
      [0, 1, 2],
      [3, 4, 5],
    ]);
  });

  it('never groups a lone beamable note', () => {
    const groups = Beaming.groups([quarter(), eighth(), quarter()], time(4, BeatUnit.Quarter));

    expect(groups).toEqual([]);
  });
});

describe('Beaming.geometry', () => {
  it('lays a level beam over equal noteheads at the ideal stem length', () => {
    const { tips, lines } = Beaming.geometry({
      stems: [
        { x: 2, noteY: 2, count: 1 },
        { x: 6, noteY: 2, count: 1 },
      ],
      direction: StemDirection.Up,
    });

    expect(tips).toEqual([-1.5, -1.5]);
    expect(lines).toEqual([{ x1: 2, y1: -1.5, x2: 6, y2: -1.5, level: 1 }]);
  });

  it('slants with the outer noteheads, clamped', () => {
    const { tips } = Beaming.geometry({
      stems: [
        { x: 2, noteY: 2, count: 1 },
        { x: 6, noteY: 6, count: 1 },
      ],
      direction: StemDirection.Up,
    });

    expect(tips[1] - tips[0]).toBe(1);
  });

  it('shifts the whole beam to preserve the minimum stem length', () => {
    const { tips } = Beaming.geometry({
      stems: [
        { x: 2, noteY: 5, count: 1 },
        { x: 6, noteY: 0, count: 1 },
      ],
      direction: StemDirection.Up,
    });

    expect(5 - tips[0]).toBeGreaterThanOrEqual(3.25);
    expect(0 - tips[1]).toBeGreaterThanOrEqual(3.25);
  });

  it('stacks a full secondary beam toward the noteheads', () => {
    const { lines } = Beaming.geometry({
      stems: [
        { x: 2, noteY: 2, count: 2 },
        { x: 4, noteY: 2, count: 2 },
      ],
      direction: StemDirection.Up,
    });

    expect(lines).toHaveLength(2);
    expect(lines[1].level).toBe(2);
    expect(lines[1].y1).toBeCloseTo(lines[0].y1 + 0.75);
  });

  it('runs a secondary beam only under the notes that carry it', () => {
    const { lines } = Beaming.geometry({
      stems: [
        { x: 2, noteY: 2, count: 1 },
        { x: 4, noteY: 2, count: 2 },
        { x: 6, noteY: 2, count: 2 },
        { x: 8, noteY: 2, count: 1 },
      ],
      direction: StemDirection.Up,
    });

    const secondary = lines.find((line) => line.level === 2);

    expect(secondary).toMatchObject({ x1: 4, x2: 6 });
  });

  it('mirrors below for down-stem groups', () => {
    const { tips, lines } = Beaming.geometry({
      stems: [
        { x: 2, noteY: 1, count: 2 },
        { x: 6, noteY: 1, count: 2 },
      ],
      direction: StemDirection.Down,
    });

    expect(tips[0]).toBe(4.5);
    expect(lines[1].y1).toBeCloseTo(lines[0].y1 - 0.75);
  });
});
