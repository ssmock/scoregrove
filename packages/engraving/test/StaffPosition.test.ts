import { describe, expect, it } from 'vitest';
import { Clef } from '@scoregrove/domain/Clef';
import { PitchLetter } from '@scoregrove/domain/Pitch';
import { StaffPosition } from '../src/StaffPosition';
import { pitch } from './helpers';

describe('StaffPosition.of', () => {
  it('puts each clef reference pitch on the middle line', () => {
    expect(StaffPosition.of(Clef.Treble, pitch(PitchLetter.B, 4))).toBe(0);
    expect(StaffPosition.of(Clef.Bass, pitch(PitchLetter.D, 3))).toBe(0);
    expect(StaffPosition.of(Clef.Alto, pitch(PitchLetter.C, 4))).toBe(0);
  });

  it('counts positions diatonically, ignoring accidentals', () => {
    expect(StaffPosition.of(Clef.Treble, pitch(PitchLetter.E, 4))).toBe(-4);
    expect(StaffPosition.of(Clef.Treble, pitch(PitchLetter.F, 5))).toBe(4);
    expect(StaffPosition.of(Clef.Treble, pitch(PitchLetter.C, 4))).toBe(-6);
    expect(StaffPosition.of(Clef.Treble, pitch(PitchLetter.G, 5))).toBe(5);
    expect(StaffPosition.of(Clef.Bass, pitch(PitchLetter.G, 2))).toBe(-4);
  });
});

describe('StaffPosition.y', () => {
  it('maps positions onto staff spaces from the top line, y downward', () => {
    expect(StaffPosition.y(4)).toBe(0);
    expect(StaffPosition.y(0)).toBe(2);
    expect(StaffPosition.y(-4)).toBe(4);
    expect(StaffPosition.y(1)).toBe(1.5);
  });
});

describe('StaffPosition.ledgerLines', () => {
  it('needs no ledger lines within the staff', () => {
    expect(StaffPosition.ledgerLines(0)).toEqual([]);
    expect(StaffPosition.ledgerLines(4)).toEqual([]);
    expect(StaffPosition.ledgerLines(-5)).toEqual([]);
  });

  it('adds lines every other position outward from the staff', () => {
    expect(StaffPosition.ledgerLines(6)).toEqual([6]);
    expect(StaffPosition.ledgerLines(7)).toEqual([6]);
    expect(StaffPosition.ledgerLines(-6)).toEqual([-6]);
    expect(StaffPosition.ledgerLines(-9)).toEqual([-6, -8]);
    expect(StaffPosition.ledgerLines(10)).toEqual([6, 8, 10]);
  });
});
