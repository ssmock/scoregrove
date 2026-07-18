import { Clef } from '@scoregrove/domain/Clef';
import type { KeySignature } from '@scoregrove/domain/KeySignature';
import { BeatUnit, TimeSymbol, type TimeSignature } from '@scoregrove/domain/TimeSignature';
import type { GlyphName } from './Bravura';
import { Glyphs } from './Glyphs';
import type { LaidOutGlyph } from './LayoutTree';
import { KeySignatureLayout } from './KeySignatureLayout';
import { StaffPosition } from './StaffPosition';

/**
 * A horizontal run of positioned glyphs with its total advance — the shape
 * signature painting reduces to.
 */
export type GlyphRun = {
  glyphs: readonly LaidOutGlyph[];
  width: number;
};

const clefGlyphs: Record<Clef, { glyph: GlyphName; y: number }> = {
  /** The G clef curls around the G4 line */
  Treble: { glyph: 'gClef', y: 3 },
  /** The F clef's dots straddle the F3 line */
  Bass: { glyph: 'fClef', y: 1 },
  /** The C clef centers on the middle line */
  Alto: { glyph: 'cClef', y: 2 },
};

const digitGlyphs: Record<string, GlyphName> = {
  '0': 'timeSig0',
  '1': 'timeSig1',
  '2': 'timeSig2',
  '3': 'timeSig3',
  '4': 'timeSig4',
  '5': 'timeSig5',
  '6': 'timeSig6',
  '7': 'timeSig7',
  '8': 'timeSig8',
  '9': 'timeSig9',
};

const digitsOf = (value: number): GlyphName[] =>
  [...String(value)].map((digit) => digitGlyphs[digit]);

const rowWidth = (row: readonly GlyphName[]): number =>
  row.reduce((sum, glyph) => sum + Glyphs.width(glyph), 0);

/**
 * Positioned glyph runs for the signatures printed at the start of a measure.
 * Each run starts at x 0; the caller advances a cursor by `width` plus its
 * own gaps.
 */
export const Signatures = {
  clef(clef: Clef): GlyphRun {
    const { glyph, y } = clefGlyphs[clef];

    return { glyphs: [{ glyph, x: 0, y }], width: Glyphs.width(glyph) };
  },

  /**
   * The key signature's accidentals in their standard positions for the clef.
   * An empty run for C major / A minor.
   */
  key(clef: Clef, key: KeySignature): GlyphRun {
    const accidentals = KeySignatureLayout.accidentals(key);

    if (!accidentals) return { glyphs: [], width: 0 };

    const glyph = Glyphs.forAccidental(accidentals.accidental);
    const advance = Glyphs.width(glyph) + 0.1;

    const glyphs = KeySignatureLayout.positions(clef, key).map((position, index) => ({
      glyph,
      x: index * advance,
      y: StaffPosition.y(position),
    }));

    return { glyphs, width: glyphs.length * advance };
  },

  /**
   * The time signature: a single symbol glyph on the middle line for common
   * and cut time, otherwise the beat count stacked over the beat unit's
   * numeral, each row centered on the wider one.
   */
  time(time: TimeSignature): GlyphRun {
    if (time.symbol === TimeSymbol.Common || time.symbol === TimeSymbol.CutCommon) {
      const glyph: GlyphName =
        time.symbol === TimeSymbol.Common ? 'timeSigCommon' : 'timeSigCutCommon';

      return { glyphs: [{ glyph, x: 0, y: 2 }], width: Glyphs.width(glyph) };
    }

    const top = digitsOf(time.beats);
    const bottom = digitsOf(BeatUnit.numeral(time.beatUnit));
    const width = Math.max(rowWidth(top), rowWidth(bottom));

    const layoutRow = (row: readonly GlyphName[], y: number): LaidOutGlyph[] => {
      let x = (width - rowWidth(row)) / 2;

      return row.map((glyph) => {
        const laid = { glyph, x, y };

        x += Glyphs.width(glyph);

        return laid;
      });
    };

    return { glyphs: [...layoutRow(top, 1), ...layoutRow(bottom, 3)], width };
  },
};
