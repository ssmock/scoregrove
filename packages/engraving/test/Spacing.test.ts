import { describe, expect, it } from 'vitest';
import { Duration, NoteValue } from '@scoregrove/domain/Duration';
import { Spacing } from '../src/Spacing';

describe('Spacing.widthOf', () => {
  it('gives the quarter note its base width', () => {
    expect(Spacing.widthOf(Duration.of(NoteValue.Quarter))).toBe(3.5);
  });

  it('adds one space per doubling and removes one per halving', () => {
    expect(Spacing.widthOf(Duration.of(NoteValue.Half))).toBe(4.5);
    expect(Spacing.widthOf(Duration.of(NoteValue.Whole))).toBe(5.5);
    expect(Spacing.widthOf(Duration.of(NoteValue.Eighth))).toBe(2.5);
  });

  it('spaces dotted durations on the same curve', () => {
    expect(Spacing.widthOf(Duration.of(NoteValue.Quarter, { dots: 1 }))).toBeCloseTo(
      3.5 + Math.log2(1.5),
    );
  });

  it('floors very short values', () => {
    expect(Spacing.widthOf(Duration.of(NoteValue.SixtyFourth))).toBe(1.5);
  });
});
