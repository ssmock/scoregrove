import { describe, expect, it } from 'vitest';
import { Clef } from '@scoregrove/domain/Clef';
import { Mode, type KeySignature } from '@scoregrove/domain/KeySignature';
import { PitchClass, PitchLetter } from '@scoregrove/domain/Pitch';
import { PositiveInteger } from '@scoregrove/domain/PositiveInteger';
import { BeatUnit, TimeSignature } from '@scoregrove/domain/TimeSignature';
import { Signatures } from '../src/Signatures';

describe('Signatures.clef', () => {
  it('hangs each clef on its reference line', () => {
    expect(Signatures.clef(Clef.Treble).glyphs).toEqual([{ glyph: 'gClef', x: 0, y: 3 }]);
    expect(Signatures.clef(Clef.Bass).glyphs).toEqual([{ glyph: 'fClef', x: 0, y: 1 }]);
    expect(Signatures.clef(Clef.Alto).glyphs).toEqual([{ glyph: 'cClef', x: 0, y: 2 }]);
  });
});

describe('Signatures.key', () => {
  const dMajor: KeySignature = { tonic: PitchClass.of(PitchLetter.D), mode: Mode.Major };

  it('advances the accidentals left to right at their staff positions', () => {
    const run = Signatures.key(Clef.Treble, dMajor);

    expect(run.glyphs.map((laid) => laid.glyph)).toEqual(['accidentalSharp', 'accidentalSharp']);
    expect(run.glyphs[0].y).toBe(0);
    expect(run.glyphs[1].y).toBe(1.5);
    expect(run.glyphs[1].x).toBeGreaterThan(run.glyphs[0].x);
    expect(run.width).toBeGreaterThan(0);
  });

  it('is empty for C major', () => {
    expect(
      Signatures.key(Clef.Treble, { tonic: PitchClass.of(PitchLetter.C), mode: Mode.Major }),
    ).toEqual({ glyphs: [], width: 0 });
  });
});

describe('Signatures.time', () => {
  it('stacks the beat count over the unit numeral, centering the narrower row', () => {
    const run = Signatures.time({ beats: PositiveInteger.of(3), beatUnit: BeatUnit.Quarter });
    const [top, bottom] = run.glyphs;

    expect(top).toMatchObject({ glyph: 'timeSig3', y: 1 });
    expect(bottom).toMatchObject({ glyph: 'timeSig4', x: 0, y: 3 });
    // Bravura's 3 is slightly narrower than its 4, so the top row shifts right
    expect(top.x).toBeGreaterThan(0);
    expect(top.x).toBeLessThan(0.5);
  });

  it('centers the narrower row under a two-digit beat count', () => {
    const run = Signatures.time({ beats: PositiveInteger.of(12), beatUnit: BeatUnit.Eighth });
    const top = run.glyphs.filter((laid) => laid.y === 1);
    const bottom = run.glyphs.filter((laid) => laid.y === 3);

    expect(top).toHaveLength(2);
    expect(bottom).toHaveLength(1);
    expect(bottom[0].x).toBeGreaterThan(0);
  });

  it('prints the traditional symbols on the middle line', () => {
    expect(Signatures.time(TimeSignature.commonTime()).glyphs).toEqual([
      { glyph: 'timeSigCommon', x: 0, y: 2 },
    ]);
    expect(Signatures.time(TimeSignature.cutCommonTime()).glyphs).toEqual([
      { glyph: 'timeSigCutCommon', x: 0, y: 2 },
    ]);
  });
});
