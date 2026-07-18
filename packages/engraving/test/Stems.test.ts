import { describe, expect, it } from 'vitest';
import { StemDirection, Stems } from '../src/Stems';

describe('Stems.direction', () => {
  it('stems below-middle notes up and above-middle notes down', () => {
    expect(Stems.direction([-2])).toBe(StemDirection.Up);
    expect(Stems.direction([3])).toBe(StemDirection.Down);
  });

  it('takes a down-stem on the middle line and on balanced extremes', () => {
    expect(Stems.direction([0])).toBe(StemDirection.Down);
    expect(Stems.direction([-3, 3])).toBe(StemDirection.Down);
  });

  it('lets the notehead farthest from the middle line decide', () => {
    expect(Stems.direction([-1, 4])).toBe(StemDirection.Down);
    expect(Stems.direction([-5, 2])).toBe(StemDirection.Up);
  });
});

describe('Stems.directionForVoice', () => {
  it('stems the first voice up and the second down', () => {
    expect(Stems.directionForVoice(0)).toBe(StemDirection.Up);
    expect(Stems.directionForVoice(1)).toBe(StemDirection.Down);
  });
});

describe('Stems.tipPosition', () => {
  it('reaches an octave beyond the notehead', () => {
    expect(Stems.tipPosition(-2, StemDirection.Up)).toBe(5);
    expect(Stems.tipPosition(3, StemDirection.Down)).toBe(-4);
  });

  it('extends to the middle line for far ledger notes', () => {
    expect(Stems.tipPosition(-10, StemDirection.Up)).toBe(0);
    expect(Stems.tipPosition(11, StemDirection.Down)).toBe(0);
  });
});
