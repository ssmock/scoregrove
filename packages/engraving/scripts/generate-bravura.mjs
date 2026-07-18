/**
 * Regenerates src/Bravura.ts from the vendored SMuFL/Bravura metadata in
 * assets/. Run via `pnpm --filter @scoregrove/engraving generate` after adding
 * a glyph name below or updating the vendored JSON.
 *
 * The full metadata files stay out of the TypeScript build on purpose: they
 * are large, and extracting just the glyphs we use keeps the compiled package
 * small and the build fast.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Every SMuFL glyph the engraving pipeline and components may reference.
 * Grouped as in the SMuFL specification.
 */
const glyphNames = [
  // Clefs
  'gClef',
  'fClef',
  'cClef',
  // Time signatures
  'timeSig0',
  'timeSig1',
  'timeSig2',
  'timeSig3',
  'timeSig4',
  'timeSig5',
  'timeSig6',
  'timeSig7',
  'timeSig8',
  'timeSig9',
  'timeSigCommon',
  'timeSigCutCommon',
  // Noteheads
  'noteheadDoubleWhole',
  'noteheadWhole',
  'noteheadHalf',
  'noteheadBlack',
  // Flags
  'flag8thUp',
  'flag8thDown',
  'flag16thUp',
  'flag16thDown',
  'flag32ndUp',
  'flag32ndDown',
  'flag64thUp',
  'flag64thDown',
  // Accidentals
  'accidentalFlat',
  'accidentalNatural',
  'accidentalSharp',
  'accidentalDoubleSharp',
  'accidentalDoubleFlat',
  // Rests
  'restDoubleWhole',
  'restWhole',
  'restHalf',
  'restQuarter',
  'rest8th',
  'rest16th',
  'rest32nd',
  'rest64th',
  // Dots
  'augmentationDot',
  // Articulations
  'articAccentAbove',
  'articAccentBelow',
  'articStaccatoAbove',
  'articStaccatoBelow',
  'articTenutoAbove',
  'articTenutoBelow',
  'articStaccatissimoAbove',
  'articStaccatissimoBelow',
  'articMarcatoAbove',
  'articMarcatoBelow',
  // Holds
  'fermataAbove',
  'fermataBelow',
  // Dynamics
  'dynamicPPP',
  'dynamicPP',
  'dynamicPiano',
  'dynamicMP',
  'dynamicMF',
  'dynamicForte',
  'dynamicFF',
  'dynamicFFF',
  'dynamicSforzato',
  'dynamicFortePiano',
  // Navigation
  'segno',
  'coda',
];

const metadata = JSON.parse(readFileSync(join(root, 'assets/bravura_metadata.json'), 'utf8'));
const smufl = JSON.parse(readFileSync(join(root, 'assets/glyphnames.json'), 'utf8'));

const missing = glyphNames.filter(
  (name) => !smufl[name] || !metadata.glyphBBoxes[name] || !smufl[name].codepoint,
);

if (missing.length) {
  console.error(`Glyphs missing from the vendored metadata: ${missing.join(', ')}`);
  process.exit(1);
}

const escapeCodepoint = (codepoint) => {
  const hex = codepoint.replace(/^U\+/, '');

  return `'\\u{${hex}}'`;
};

const formatPair = ([x, y]) => `[${x}, ${y}]`;

const glyphEntries = glyphNames.map((name) => {
  const { codepoint } = smufl[name];
  const { bBoxNE, bBoxSW } = metadata.glyphBBoxes[name];
  const anchors = metadata.glyphsWithAnchors[name];

  const anchorLines = anchors
    ? Object.entries(anchors)
        .map(([anchor, pair]) => `      ${anchor}: ${formatPair(pair)},`)
        .join('\n')
    : null;

  return [
    `  ${name}: {`,
    `    codepoint: ${escapeCodepoint(codepoint)},`,
    `    bBoxNE: ${formatPair(bBoxNE)},`,
    `    bBoxSW: ${formatPair(bBoxSW)},`,
    ...(anchorLines ? [`    anchors: {\n${anchorLines}\n    },`] : []),
    `  },`,
  ].join('\n');
});

const defaults = Object.entries(metadata.engravingDefaults)
  .map(([key, value]) => `  ${key}: ${JSON.stringify(value)},`)
  .join('\n');

const output = `/**
 * GENERATED FILE — do not edit by hand.
 *
 * Extracted from Bravura ${metadata.fontVersion} metadata and the SMuFL
 * glyphnames table by scripts/generate-bravura.mjs. All coordinates are in
 * staff spaces with y increasing upward (the SMuFL convention); the rendering
 * side flips y. Bravura is licensed under the SIL Open Font License — see
 * assets/OFL.txt.
 */

/**
 * A point in SMuFL glyph metadata coordinates: staff spaces relative to the
 * glyph origin, y up.
 */
export type GlyphPoint = readonly [number, number];

/**
 * One glyph's codepoint, bounding box (northeast and southwest corners), and
 * any attachment anchors (e.g. stem attachment points on noteheads).
 */
export type GlyphData = {
  codepoint: string;
  bBoxNE: GlyphPoint;
  bBoxSW: GlyphPoint;
  anchors?: Readonly<Record<string, GlyphPoint>>;
};

/**
 * Bravura's recommended engraving dimensions, in staff spaces.
 */
export const engravingDefaults = {
${defaults}
} as const;

export const glyphs = {
${glyphEntries.join('\n')}
} as const satisfies Record<string, GlyphData>;

/**
 * The name of every glyph the engraving pipeline may reference.
 */
export type GlyphName = keyof typeof glyphs;
`;

writeFileSync(join(root, 'src/Bravura.ts'), output);
console.log(`Wrote src/Bravura.ts with ${glyphNames.length} glyphs`);
