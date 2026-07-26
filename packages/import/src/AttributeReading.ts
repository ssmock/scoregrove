import { Clef } from '@scoregrove/domain/Clef';
import { KeySignature, Mode } from '@scoregrove/domain/KeySignature';
import { Result } from '@scoregrove/domain/Result';
import { BeatUnit, TimeSignature, TimeSymbol } from '@scoregrove/domain/TimeSignature';
import type { XmlElement } from '@rgrove/parse-xml';
import type { Warn } from './Reporting';
import { XmlReading } from './XmlReading';

/**
 * MusicXML `<attributes>` children into domain values: divisions, key, time,
 * and clef. Small and pure, so the reconciliation in `PartwiseToTimewise` can
 * compare *domain* values rather than XML — whitespace and attribute order
 * then cannot masquerade as two parts disagreeing.
 */

/** `<clef><sign>/<line>` pairs we can represent, keyed "sign+line" */
const clefsBySignAndLine: Record<string, Clef> = {
  G2: Clef.Treble,
  F4: Clef.Bass,
  C3: Clef.Alto,
  C4: Clef.Tenor,
};

const beatUnitsByNumeral = new Map(
  BeatUnit.values.map((unit) => [BeatUnit.numeral(unit), unit] as const),
);

const timeSymbols: Record<string, TimeSymbol> = {
  common: TimeSymbol.Common,
  cut: TimeSymbol.CutCommon,
};

export const AttributeReading = {
  /**
   * `<divisions>` — how many units make a quarter note in this part. Never
   * reaches a `Score`; it exists only to convert durations, and MusicXML
   * permits parts to declare different values, so it is per-part state rather
   * than a score-wide attribute.
   */
  divisions(attributes: XmlElement, warn: Warn): number | undefined {
    const text = XmlReading.textOf(attributes, 'divisions');

    if (text === undefined) return undefined;

    const value = Number(text);

    if (!Number.isFinite(value) || value <= 0) {
      warn(`Ignoring a non-numeric <divisions> value "${text}"`);

      return undefined;
    }

    return value;
  },

  /**
   * `<key>` → `KeySignature`, via the tonic's place in the circle of fifths
   * (the domain's own ordering, rather than a second table here).
   *
   * `<mode>` is optional in MusicXML and **absent throughout this corpus**, so
   * Major is assumed and reported. That assumption is lossless for everything
   * downstream: a signature's printed accidentals and its implied pitches
   * depend only on the fifths count, so C minor and its relative E-flat major
   * engrave and sound identically. It would only show in a spelled-out key
   * name, which nothing renders today.
   */
  key(element: XmlElement, warn: Warn): Result<KeySignature> {
    const fifthsText = XmlReading.textOf(element, 'fifths');

    if (fifthsText === undefined) return Result.invalid('A <key> element has no <fifths>');

    const fifths = Number(fifthsText);

    if (!Number.isInteger(fifths) || Math.abs(fifths) > 7) {
      return Result.invalid(`Unsupported key signature: ${fifths} fifths`);
    }

    const modeText = XmlReading.textOf(element, 'mode');
    let mode: Mode = Mode.Major;

    if (modeText === undefined) {
      warn(`A <key> of ${fifths} fifths declares no <mode>; assuming Major`);
    } else if (modeText.toLowerCase() === 'minor') {
      mode = Mode.Minor;
    } else if (modeText.toLowerCase() !== 'major') {
      warn(`Unsupported key mode "${modeText}"; assuming Major`);
    }

    // Index 0 is the empty signature, 1–7 count sharps, 8–14 count flats.
    const index = fifths >= 0 ? fifths : 7 - fifths;
    const tonic = KeySignature.standardTonics(mode)[index];

    if (!tonic) return Result.invalid(`No standard tonic for ${fifths} fifths in ${mode}`);

    return KeySignature.create(tonic, mode);
  },

  /** `<time>` → `TimeSignature`, honoring the common/cut symbols the corpus uses */
  time(element: XmlElement, warn: Warn): Result<TimeSignature> {
    const beatsText = XmlReading.textOf(element, 'beats');
    const beatTypeText = XmlReading.textOf(element, 'beat-type');

    if (beatsText === undefined || beatTypeText === undefined) {
      return Result.invalid('A <time> element is missing <beats> or <beat-type>');
    }

    // "3+2/8" and friends are legal MusicXML; we have no composite meter.
    if (beatsText.includes('+')) {
      return Result.invalid(`Composite time signature "${beatsText}/${beatTypeText}"`);
    }

    const beatUnit = beatUnitsByNumeral.get(Number(beatTypeText));

    if (!beatUnit) return Result.invalid(`Unsupported beat unit "${beatTypeText}"`);

    const symbolText = XmlReading.attribute(element, 'symbol');
    let symbol = symbolText ? timeSymbols[symbolText] : undefined;

    if (symbolText && !symbol) {
      // "single-number", "note", "dotted-note", "normal" — printed forms we do
      // not have. The meter itself is unaffected, so keep it and say so.
      warn(`Ignoring unsupported time symbol "${symbolText}"`);
      symbol = undefined;
    }

    return TimeSignature.create(Number(beatsText), beatUnit, symbol);
  },

  /** `<clef>` → `Clef`; the four we support, by sign and line */
  clef(element: XmlElement, warn: Warn): Result<Clef> {
    const sign = XmlReading.textOf(element, 'sign');
    const line = XmlReading.textOf(element, 'line');

    if (sign === undefined) return Result.invalid('A <clef> element has no <sign>');

    const octaveChange = XmlReading.textOf(element, 'clef-octave-change');

    if (octaveChange !== undefined && octaveChange !== '0') {
      // An 8va/8vb clef sounds an octave away from where it reads; we have no
      // such clef, so the notes would sound in the wrong octave if we pretended.
      warn(`Ignoring <clef-octave-change>${octaveChange}</clef-octave-change>`);
    }

    const clef = clefsBySignAndLine[`${sign}${line ?? ''}`];

    if (!clef) return Result.invalid(`Unsupported clef: ${sign} on line ${line ?? '(none)'}`);

    return Result.ok(clef);
  },
};
