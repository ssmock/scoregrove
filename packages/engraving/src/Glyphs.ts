import { Accidental } from '@scoregrove/domain/Pitch';
import { Articulation } from '@scoregrove/domain/Notations';
import type { DynamicMark } from '@scoregrove/domain/Dynamic';
import type { NavigationMark } from '@scoregrove/domain/Navigation';
import { NoteValue } from '@scoregrove/domain/Duration';
import { glyphs, type GlyphData, type GlyphName } from './Bravura';
import { StemDirection } from './Stems';

const accidentalGlyphs: Record<Accidental, GlyphName> = {
  Sharp: 'accidentalSharp',
  Flat: 'accidentalFlat',
  Natural: 'accidentalNatural',
  DoubleSharp: 'accidentalDoubleSharp',
  DoubleFlat: 'accidentalDoubleFlat',
};

const noteheadGlyphs: Record<NoteValue, GlyphName> = {
  Breve: 'noteheadDoubleWhole',
  Whole: 'noteheadWhole',
  Half: 'noteheadHalf',
  Quarter: 'noteheadBlack',
  Eighth: 'noteheadBlack',
  Sixteenth: 'noteheadBlack',
  ThirtySecond: 'noteheadBlack',
  SixtyFourth: 'noteheadBlack',
};

const restGlyphs: Record<NoteValue, GlyphName> = {
  Breve: 'restDoubleWhole',
  Whole: 'restWhole',
  Half: 'restHalf',
  Quarter: 'restQuarter',
  Eighth: 'rest8th',
  Sixteenth: 'rest16th',
  ThirtySecond: 'rest32nd',
  SixtyFourth: 'rest64th',
};

const flagGlyphs: Partial<Record<NoteValue, Record<StemDirection, GlyphName>>> = {
  Eighth: { Up: 'flag8thUp', Down: 'flag8thDown' },
  Sixteenth: { Up: 'flag16thUp', Down: 'flag16thDown' },
  ThirtySecond: { Up: 'flag32ndUp', Down: 'flag32ndDown' },
  SixtyFourth: { Up: 'flag64thUp', Down: 'flag64thDown' },
};

const dynamicGlyphs: Record<DynamicMark, GlyphName> = {
  Pianississimo: 'dynamicPPP',
  Pianissimo: 'dynamicPP',
  Piano: 'dynamicPiano',
  MezzoPiano: 'dynamicMP',
  MezzoForte: 'dynamicMF',
  Forte: 'dynamicForte',
  Fortissimo: 'dynamicFF',
  Fortississimo: 'dynamicFFF',
  Sforzando: 'dynamicSforzato',
  Fortepiano: 'dynamicFortePiano',
};

const articulationGlyphs: Record<Articulation, { above: GlyphName; below: GlyphName }> = {
  Staccato: { above: 'articStaccatoAbove', below: 'articStaccatoBelow' },
  Staccatissimo: { above: 'articStaccatissimoAbove', below: 'articStaccatissimoBelow' },
  Tenuto: { above: 'articTenutoAbove', below: 'articTenutoBelow' },
  Accent: { above: 'articAccentAbove', below: 'articAccentBelow' },
  Marcato: { above: 'articMarcatoAbove', below: 'articMarcatoBelow' },
};

const navigationGlyphs: Partial<Record<NavigationMark, GlyphName>> = {
  Segno: 'segno',
  Coda: 'coda',
};

/**
 * Lookup helpers from domain vocabulary onto SMuFL glyphs, plus metric
 * accessors over the generated Bravura data. All widths are in staff spaces.
 */
export const Glyphs = {
  char(name: GlyphName): string {
    return glyphs[name].codepoint;
  },

  data(name: GlyphName): GlyphData {
    return glyphs[name];
  },

  /**
   * The horizontal advance of a glyph: the right edge of its bounding box
   * (Bravura glyph origins sit at the left edge).
   */
  width(name: GlyphName): number {
    return glyphs[name].bBoxNE[0];
  },

  forAccidental(accidental: Accidental): GlyphName {
    return accidentalGlyphs[accidental];
  },

  forNotehead(noteValue: NoteValue): GlyphName {
    return noteheadGlyphs[noteValue];
  },

  forRest(noteValue: NoteValue): GlyphName {
    return restGlyphs[noteValue];
  },

  /**
   * The flag glyph for an unbeamed stem, or undefined for values that carry
   * no flag (quarter and longer).
   */
  forFlag(noteValue: NoteValue, direction: StemDirection): GlyphName | undefined {
    return flagGlyphs[noteValue]?.[direction];
  },

  forDynamicMark(mark: DynamicMark): GlyphName {
    return dynamicGlyphs[mark];
  },

  forArticulation(articulation: Articulation, placement: 'above' | 'below'): GlyphName {
    return articulationGlyphs[articulation][placement];
  },

  forFermata(placement: 'above' | 'below'): GlyphName {
    return placement === 'above' ? 'fermataAbove' : 'fermataBelow';
  },

  /**
   * The glyph for a navigation mark, or undefined for Fine, which is printed
   * as text rather than a sign.
   */
  forNavigationMark(mark: NavigationMark): GlyphName | undefined {
    return navigationGlyphs[mark];
  },
};
