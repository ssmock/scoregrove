/**
 * GENERATED FILE — do not edit by hand.
 *
 * Extracted from Bravura 1.392 metadata and the SMuFL
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
  arrowShaftThickness: 0.16,
  barlineSeparation: 0.4,
  beamSpacing: 0.25,
  beamThickness: 0.5,
  bracketThickness: 0.5,
  dashedBarlineDashLength: 0.5,
  dashedBarlineGapLength: 0.25,
  dashedBarlineThickness: 0.16,
  hBarThickness: 1,
  hairpinThickness: 0.16,
  legerLineExtension: 0.4,
  legerLineThickness: 0.16,
  lyricLineThickness: 0.16,
  octaveLineThickness: 0.16,
  pedalLineThickness: 0.16,
  repeatBarlineDotSeparation: 0.16,
  repeatEndingLineThickness: 0.16,
  slurEndpointThickness: 0.1,
  slurMidpointThickness: 0.22,
  staffLineThickness: 0.13,
  stemThickness: 0.12,
  subBracketThickness: 0.16,
  textEnclosureThickness: 0.16,
  textFontFamily: ['Academico', 'Century Schoolbook', 'Edwin', 'serif'],
  thickBarlineThickness: 0.5,
  thinBarlineThickness: 0.16,
  tieEndpointThickness: 0.1,
  tieMidpointThickness: 0.22,
  tupletBracketThickness: 0.16,
} as const;

export const glyphs = {
  gClef: {
    codepoint: '\u{E050}',
    bBoxNE: [2.684, 4.392],
    bBoxSW: [0, -2.632],
  },
  fClef: {
    codepoint: '\u{E062}',
    bBoxNE: [2.736, 1.048],
    bBoxSW: [-0.02, -2.54],
  },
  cClef: {
    codepoint: '\u{E05C}',
    bBoxNE: [2.796, 2.024],
    bBoxSW: [0, -2.024],
  },
  gClefChange: {
    codepoint: '\u{E07A}',
    bBoxNE: [1.76, 2.828],
    bBoxSW: [0, -1.82],
  },
  fClefChange: {
    codepoint: '\u{E07C}',
    bBoxNE: [1.852, 0.68],
    bBoxSW: [-0.06, -1.656],
  },
  cClefChange: {
    codepoint: '\u{E07B}',
    bBoxNE: [2.024, 1.328],
    bBoxSW: [0, -1.328],
  },
  timeSig0: {
    codepoint: '\u{E080}',
    bBoxNE: [1.8, 1.004],
    bBoxSW: [0.08, -1],
  },
  timeSig1: {
    codepoint: '\u{E081}',
    bBoxNE: [1.256, 1.004],
    bBoxSW: [0.08, -1],
  },
  timeSig2: {
    codepoint: '\u{E082}',
    bBoxNE: [1.704, 1.016],
    bBoxSW: [0.08, -1.028],
  },
  timeSig3: {
    codepoint: '\u{E083}',
    bBoxNE: [1.604, 0.996],
    bBoxSW: [0.08, -1.004],
  },
  timeSig4: {
    codepoint: '\u{E084}',
    bBoxNE: [1.8, 1.004],
    bBoxSW: [0.08, -1],
  },
  timeSig5: {
    codepoint: '\u{E085}',
    bBoxNE: [1.532, 0.984],
    bBoxSW: [0.08, -1.004],
  },
  timeSig6: {
    codepoint: '\u{E086}',
    bBoxNE: [1.656, 1.004],
    bBoxSW: [0.08, -0.996],
  },
  timeSig7: {
    codepoint: '\u{E087}',
    bBoxNE: [1.684, 0.996],
    bBoxSW: [0.08, -1],
  },
  timeSig8: {
    codepoint: '\u{E088}',
    bBoxNE: [1.664, 1.036],
    bBoxSW: [0.08, -1.036],
  },
  timeSig9: {
    codepoint: '\u{E089}',
    bBoxNE: [1.656, 1.004],
    bBoxSW: [0.08, -0.996],
  },
  timeSigCommon: {
    codepoint: '\u{E08A}',
    bBoxNE: [1.696, 1.004],
    bBoxSW: [0.02, -0.996],
  },
  timeSigCutCommon: {
    codepoint: '\u{E08B}',
    bBoxNE: [1.672, 1.444],
    bBoxSW: [0, -1.436],
  },
  noteheadDoubleWhole: {
    codepoint: '\u{E0A0}',
    bBoxNE: [2.396, 0.62],
    bBoxSW: [0, -0.62],
    anchors: {
      noteheadOrigin: [0.36, 0],
    },
  },
  noteheadWhole: {
    codepoint: '\u{E0A2}',
    bBoxNE: [1.688, 0.5],
    bBoxSW: [0, -0.5],
    anchors: {
      cutOutNW: [0.172, 0.332],
      cutOutSE: [1.532, -0.364],
    },
  },
  noteheadHalf: {
    codepoint: '\u{E0A3}',
    bBoxNE: [1.18, 0.5],
    bBoxSW: [0, -0.5],
    anchors: {
      cutOutNW: [0.204, 0.296],
      cutOutSE: [0.98, -0.3],
      splitStemDownNE: [0.956, -0.3],
      splitStemDownNW: [0.128, -0.428],
      splitStemUpSE: [1.108, 0.372],
      splitStemUpSW: [0.328, 0.38],
      stemDownNW: [0, -0.168],
      stemUpSE: [1.18, 0.168],
    },
  },
  noteheadBlack: {
    codepoint: '\u{E0A4}',
    bBoxNE: [1.18, 0.5],
    bBoxSW: [0, -0.5],
    anchors: {
      cutOutNW: [0.208, 0.3],
      cutOutSE: [0.94, -0.296],
      splitStemDownNE: [0.968, -0.248],
      splitStemDownNW: [0.12, -0.416],
      splitStemUpSE: [1.092, 0.392],
      splitStemUpSW: [0.312, 0.356],
      stemDownNW: [0, -0.168],
      stemUpSE: [1.18, 0.168],
    },
  },
  flag8thUp: {
    codepoint: '\u{E240}',
    bBoxNE: [1.056, 0.03521239682756091],
    bBoxSW: [0, -3.240768470618394],
    anchors: {
      graceNoteSlashNE: [1.284, -0.796],
      graceNoteSlashSW: [-0.644, -2.456],
      stemUpNW: [0, -0.04],
    },
  },
  flag8thDown: {
    codepoint: '\u{E241}',
    bBoxNE: [1.224, 3.232896633157715],
    bBoxSW: [0, -0.0575672],
    anchors: {
      graceNoteSlashNW: [-0.596, 2.168],
      graceNoteSlashSE: [1.328, 0.628],
      stemDownSW: [0, 0.132],
    },
  },
  flag16thUp: {
    codepoint: '\u{E242}',
    bBoxNE: [1.116, 0.008],
    bBoxSW: [0, -3.252],
    anchors: {
      stemUpNW: [0, -0.088],
    },
  },
  flag16thDown: {
    codepoint: '\u{E243}',
    bBoxNE: [1.1635806326044895, 3.2480256],
    bBoxSW: [-0.000019418183745617774, -0.03601094374150052],
    anchors: {
      stemDownSW: [0, 0.128],
    },
  },
  flag32ndUp: {
    codepoint: '\u{E244}',
    bBoxNE: [1.044, 0.596],
    bBoxSW: [0, -3.248],
    anchors: {
      stemUpNW: [0, 0.376],
    },
  },
  flag32ndDown: {
    codepoint: '\u{E245}',
    bBoxNE: [1.092, 3.248],
    bBoxSW: [0, -0.687477099907407],
    anchors: {
      stemDownSW: [0, -0.448],
    },
  },
  flag64thUp: {
    codepoint: '\u{E246}',
    bBoxNE: [1.044, 1.387108],
    bBoxSW: [0, -3.248],
    anchors: {
      stemUpNW: [0, 1.172],
    },
  },
  flag64thDown: {
    codepoint: '\u{E247}',
    bBoxNE: [1.092, 3.248],
    bBoxSW: [0, -1.5040263329569774],
    anchors: {
      stemDownSW: [0, -1.244],
    },
  },
  noteDoubleWhole: {
    codepoint: '\u{E1D0}',
    bBoxNE: [2.62, 0.68],
    bBoxSW: [0, -0.672],
  },
  noteWhole: {
    codepoint: '\u{E1D2}',
    bBoxNE: [1.836, 0.544],
    bBoxSW: [0, -0.548],
  },
  noteHalfUp: {
    codepoint: '\u{E1D3}',
    bBoxNE: [1.364, 3.5],
    bBoxSW: [0, -0.58],
  },
  noteQuarterUp: {
    codepoint: '\u{E1D5}',
    bBoxNE: [1.328, 3.5],
    bBoxSW: [0, -0.564],
  },
  note8thUp: {
    codepoint: '\u{E1D7}',
    bBoxNE: [2.264, 3.492],
    bBoxSW: [0, -0.552],
  },
  note16thUp: {
    codepoint: '\u{E1D9}',
    bBoxNE: [2.324, 3.492],
    bBoxSW: [0, -0.552],
  },
  note32ndUp: {
    codepoint: '\u{E1DB}',
    bBoxNE: [2.252, 4.092],
    bBoxSW: [0, -0.552],
  },
  note64thUp: {
    codepoint: '\u{E1DD}',
    bBoxNE: [2.252, 4.888],
    bBoxSW: [0, -0.552],
  },
  accidentalFlat: {
    codepoint: '\u{E260}',
    bBoxNE: [0.904, 1.756],
    bBoxSW: [0, -0.7],
    anchors: {
      cutOutNE: [0.252, 0.656],
      cutOutSE: [0.504, -0.476],
    },
  },
  accidentalNatural: {
    codepoint: '\u{E261}',
    bBoxNE: [0.672, 1.364],
    bBoxSW: [0, -1.34],
    anchors: {
      cutOutNE: [0.192, 0.776],
      cutOutSW: [0.476, -0.828],
    },
  },
  accidentalSharp: {
    codepoint: '\u{E262}',
    bBoxNE: [0.996, 1.4],
    bBoxSW: [0, -1.392],
    anchors: {
      cutOutNE: [0.84, 0.896],
      cutOutNW: [0.144, 0.568],
      cutOutSE: [0.84, -0.596],
      cutOutSW: [0.144, -0.896],
    },
  },
  accidentalDoubleSharp: {
    codepoint: '\u{E263}',
    bBoxNE: [0.988, 0.508],
    bBoxSW: [0, -0.5],
  },
  accidentalDoubleFlat: {
    codepoint: '\u{E264}',
    bBoxNE: [1.644, 1.748],
    bBoxSW: [0, -0.7],
    anchors: {
      cutOutNE: [0.988, 0.644],
      cutOutSE: [1.336, -0.396],
    },
  },
  restDoubleWhole: {
    codepoint: '\u{E4E2}',
    bBoxNE: [0.5, 1],
    bBoxSW: [0, 0],
  },
  restWhole: {
    codepoint: '\u{E4E3}',
    bBoxNE: [1.128, 0.036],
    bBoxSW: [0, -0.54],
  },
  restHalf: {
    codepoint: '\u{E4E4}',
    bBoxNE: [1.128, 0.568],
    bBoxSW: [0, -0.008],
  },
  restQuarter: {
    codepoint: '\u{E4E5}',
    bBoxNE: [1.08, 1.492],
    bBoxSW: [0.004, -1.5],
  },
  rest8th: {
    codepoint: '\u{E4E6}',
    bBoxNE: [0.988, 0.696],
    bBoxSW: [0, -1.004],
  },
  rest16th: {
    codepoint: '\u{E4E7}',
    bBoxNE: [1.28, 0.716],
    bBoxSW: [0, -2],
  },
  rest32nd: {
    codepoint: '\u{E4E8}',
    bBoxNE: [1.452, 1.704],
    bBoxSW: [0, -2],
  },
  rest64th: {
    codepoint: '\u{E4E9}',
    bBoxNE: [1.692, 1.72],
    bBoxSW: [0, -3.012],
  },
  augmentationDot: {
    codepoint: '\u{E1E7}',
    bBoxNE: [0.4, 0.2],
    bBoxSW: [0, -0.2],
  },
  articAccentAbove: {
    codepoint: '\u{E4A0}',
    bBoxNE: [1.356, 0.98],
    bBoxSW: [0, 0.004],
  },
  articAccentBelow: {
    codepoint: '\u{E4A1}',
    bBoxNE: [1.356, 0],
    bBoxSW: [0, -0.976],
  },
  articStaccatoAbove: {
    codepoint: '\u{E4A2}',
    bBoxNE: [0.336, 0.336],
    bBoxSW: [0, 0],
  },
  articStaccatoBelow: {
    codepoint: '\u{E4A3}',
    bBoxNE: [0.336, 0],
    bBoxSW: [0, -0.336],
  },
  articTenutoAbove: {
    codepoint: '\u{E4A4}',
    bBoxNE: [1.352, 0.192],
    bBoxSW: [-0.004, 0],
  },
  articTenutoBelow: {
    codepoint: '\u{E4A5}',
    bBoxNE: [1.352, 0],
    bBoxSW: [-0.004, -0.192],
  },
  articStaccatissimoAbove: {
    codepoint: '\u{E4A6}',
    bBoxNE: [0.4, 1.172],
    bBoxSW: [0.004, -0.008],
  },
  articStaccatissimoBelow: {
    codepoint: '\u{E4A7}',
    bBoxNE: [0.4, 0],
    bBoxSW: [0.004, -1.18],
  },
  articMarcatoAbove: {
    codepoint: '\u{E4AC}',
    bBoxNE: [0.94, 1.012],
    bBoxSW: [-0.004, -0.004],
  },
  articMarcatoBelow: {
    codepoint: '\u{E4AD}',
    bBoxNE: [0.94, 0],
    bBoxSW: [-0.004, -1.016],
  },
  fermataAbove: {
    codepoint: '\u{E4C0}',
    bBoxNE: [2.42, 1.316],
    bBoxSW: [0.012, -0.012],
  },
  fermataBelow: {
    codepoint: '\u{E4C1}',
    bBoxNE: [2.42, 0],
    bBoxSW: [0.012, -1.328],
  },
  dynamicPPP: {
    codepoint: '\u{E52A}',
    bBoxNE: [4.292, 1.096],
    bBoxSW: [-0.368, -0.568],
    anchors: {
      opticalCenter: [2.368, 0],
    },
  },
  dynamicPP: {
    codepoint: '\u{E52B}',
    bBoxNE: [2.912, 1.096],
    bBoxSW: [-0.328, -0.568],
    anchors: {
      opticalCenter: [1.708, 0],
    },
  },
  dynamicPiano: {
    codepoint: '\u{E520}',
    bBoxNE: [1.464, 1.096],
    bBoxSW: [-0.356, -0.568],
    anchors: {
      opticalCenter: [1.22, 0],
    },
  },
  dynamicMP: {
    codepoint: '\u{E52C}',
    bBoxNE: [3.3, 1.096],
    bBoxSW: [-0.08, -0.568],
    anchors: {
      opticalCenter: [1.848, 0],
    },
  },
  dynamicMF: {
    codepoint: '\u{E52D}',
    bBoxNE: [3.272, 1.724],
    bBoxSW: [-0.08, -0.66],
    anchors: {
      opticalCenter: [1.796, 0],
    },
  },
  dynamicForte: {
    codepoint: '\u{E522}',
    bBoxNE: [1.456, 1.776],
    bBoxSW: [-0.564, -0.608],
    anchors: {
      opticalCenter: [1.256, 0],
    },
  },
  dynamicFF: {
    codepoint: '\u{E52F}',
    bBoxNE: [2.44, 1.776],
    bBoxSW: [-0.54, -0.608],
    anchors: {
      opticalCenter: [1.852, 0],
    },
  },
  dynamicFFF: {
    codepoint: '\u{E530}',
    bBoxNE: [3.32, 1.776],
    bBoxSW: [-0.62, -0.608],
    anchors: {
      opticalCenter: [2.472, 0],
    },
  },
  dynamicSforzato: {
    codepoint: '\u{E539}',
    bBoxNE: [2.932, 1.776],
    bBoxSW: [0, -0.608],
    anchors: {
      opticalCenter: [1.76, 0],
    },
  },
  dynamicFortePiano: {
    codepoint: '\u{E534}',
    bBoxNE: [2.476, 1.776],
    bBoxSW: [-0.564, -0.608],
    anchors: {
      opticalCenter: [1.5, 0],
    },
  },
  segno: {
    codepoint: '\u{E047}',
    bBoxNE: [2.2, 3.036],
    bBoxSW: [0.016, -0.108],
  },
  coda: {
    codepoint: '\u{E048}',
    bBoxNE: [3.82, 3.592],
    bBoxSW: [-0.016, -0.632],
  },
} as const satisfies Record<string, GlyphData>;

/**
 * The name of every glyph the engraving pipeline may reference.
 */
export type GlyphName = keyof typeof glyphs;
