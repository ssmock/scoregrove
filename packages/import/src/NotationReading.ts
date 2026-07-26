import { NoteValue } from '@scoregrove/domain/Duration';
import { NoteheadStyle, TieRole } from '@scoregrove/domain/MeasureElement';
import { NonEmptyArray } from '@scoregrove/domain/NonEmptyArray';
import {
  Articulation,
  GraceNote,
  GraceStyle,
  Ornament,
  type Notations,
} from '@scoregrove/domain/Notations';
import { Result } from '@scoregrove/domain/Result';
import type { XmlElement } from '@rgrove/parse-xml';
import { PitchReading } from './PitchReading';
import type { Warn } from './Reporting';
import { XmlReading } from './XmlReading';

/**
 * What hangs off a `<note>`: its tie, and the `<notations>` our domain models
 * — articulations, slurs, fermatas — plus the conversion of a grace `<note>`
 * into the `GraceNote` its principal carries.
 *
 * ## What is deliberately not read
 *
 * `<tuplet>` marks (818 of them) are *redundant* rather than unsupported.
 * They bracket a tuplet for printing, but `<time-modification>` already told
 * `DivisionsToDuration` the ratio, and engraving derives the bracket from runs
 * of equal ratios. Reading both would risk two sources of truth disagreeing.
 *
 * `<ornaments>` are read into the domain's `Ornament` vocabulary — 52 trills
 * and 13 turns here. Ornaments outside that vocabulary (mordents, the inverted
 * turn) are reported rather than dropped, and adding one is a member plus a
 * SMuFL glyph.
 *
 * ## Slur numbering is lost, and says so
 *
 * MusicXML numbers overlapping slurs; `SlurRole` is only Begin/End/Both, so
 * which start pairs with which stop cannot be represented. That costs nothing
 * for the 1,200 slurs numbered 1, and is reported for the 8 numbered 2 — the
 * only places in the work where two slurs are open at once.
 */

const articulationsByTag: Record<string, Articulation> = {
  staccato: Articulation.Staccato,
  staccatissimo: Articulation.Staccatissimo,
  tenuto: Articulation.Tenuto,
  accent: Articulation.Accent,
  'strong-accent': Articulation.Marcato,
};

/** The ornaments the domain models — `<trill-mark>` and `<turn>` in this corpus */
const ornamentsByTag: Record<string, Ornament> = {
  'trill-mark': Ornament.Trill,
  turn: Ornament.Turn,
};

/**
 * MusicXML marks a start and a stop separately; a note carrying both is the
 * middle of a chain. `TieRole` and `SlurRole` are the same three names, so one
 * function serves both — they mean different things but share a shape.
 */
const roleOf = (starts: boolean, stops: boolean): TieRole | undefined => {
  if (starts && stops) return TieRole.Both;
  if (starts) return TieRole.Begin;
  if (stops) return TieRole.End;

  return undefined;
};

const hasType = (elements: readonly XmlElement[], type: string): boolean =>
  elements.some((element) => XmlReading.attribute(element, 'type') === type);

export const NotationReading = {
  /**
   * The note's tie, read from `<tie>` — the *sounding* tie. Its printed
   * counterpart `<tied>` lives under `<notations>` and carries the same
   * information; both appear 175 times here, and reading one avoids two
   * sources of truth.
   */
  tie(note: XmlElement): TieRole | undefined {
    const ties = XmlReading.childrenNamed(note, 'tie');

    return roleOf(hasType(ties, 'start'), hasType(ties, 'stop'));
  },

  /**
   * The notations our domain models. Lyrics are not read here — this corpus
   * has none, and a syllable belongs to a voice's text rather than to the
   * notehead's decorations.
   */
  notations(
    note: XmlElement,
    where: string,
    warn: Warn,
    options: {
      /**
       * Set when the immediately preceding grace notes carry a slur to this
       * one. That slur's `stop` lands here, and `GraceNote.slurred` already
       * represents it, so it must be consumed rather than read as a phrase
       * slur ending — otherwise this note ends a slur it never began.
       */
      endsGraceSlur?: boolean;
    } = {},
  ): Notations {
    // A note may carry **several** `<notations>` blocks, and they are additive
    // — 155 notes here have two, with 25 staccatos living only in the second.
    // Reading just the first silently loses them, which is exactly the failure
    // this importer is not allowed to have.
    const blocks = XmlReading.childrenNamed(note, 'notations');

    if (!blocks.length) return {};

    const childrenNamed = (name: string) =>
      blocks.flatMap((block) => XmlReading.childrenNamed(block, name));

    const result: Notations = {};

    const slurs = childrenNamed('slur');
    const numberOf = (element: XmlElement) => XmlReading.attribute(element, 'number') ?? '1';

    // Only the default-numbered slur is represented, and a numbered one is
    // dropped **whole — both ends**. `SlurRole` holds one slur per note, so a
    // second simultaneous slur cannot be carried; but dropping just one end
    // would leave the other unbalanced, and engraving pairs roles off a stack,
    // so a stray End steals the enclosing slur's endpoint and mis-draws a slur
    // we *could* have represented. Losing one slur beats corrupting two.
    const primary = slurs.filter((element) => numberOf(element) === '1');

    // The grace slur's stop is spoken for; drop one `stop` so a phrase slur
    // genuinely ending here is still read.
    const consumed = options.endsGraceSlur
      ? primary.findIndex((element) => XmlReading.attribute(element, 'type') === 'stop')
      : -1;
    const remaining = primary.filter((_element, index) => index !== consumed);
    const slur = roleOf(hasType(remaining, 'start'), hasType(remaining, 'stop'));

    if (slur) result.slur = slur;

    // A numbered slur ending a grace's slur is not a loss: `GraceNote.slurred`
    // already carries it, and only its redundant far end lands here.
    let graceStopConsumed = !options.endsGraceSlur;

    for (const dropped of slurs.filter((element) => numberOf(element) !== '1')) {
      if (!graceStopConsumed && XmlReading.attribute(dropped, 'type') === 'stop') {
        graceStopConsumed = true;
        continue;
      }

      warn(
        `${where}: a slur numbered ${numberOf(dropped)} is a second slur open at once, ` +
          'which is not representable; dropping it whole',
      );
    }

    if (childrenNamed('fermata').length) result.fermata = true;

    const found: Articulation[] = [];

    for (const block of childrenNamed('articulations')) {
      for (const child of XmlReading.elements(block)) {
        const articulation = articulationsByTag[child.name];

        if (articulation) found.push(articulation);
        else warn(`${where}: unsupported articulation <${child.name}>`);
      }
    }

    if (found.length) result.articulations = NonEmptyArray.of(found);

    const ornaments: Ornament[] = [];

    for (const block of childrenNamed('ornaments')) {
      for (const child of XmlReading.elements(block)) {
        const ornament = ornamentsByTag[child.name];

        if (ornament) ornaments.push(ornament);
        // Mordents and the inverted turn are deliberately outside the
        // vocabulary until a piece asks for them; anything else here is
        // genuinely unrepresentable. Either way, say so rather than drop it.
        else warn(`${where}: unsupported ornament <${child.name}>`);
      }
    }

    if (ornaments.length) result.ornaments = NonEmptyArray.of(ornaments);

    return result;
  },

  /**
   * How a note's head is drawn. `<notehead>none</notehead>` appears 14 times
   * here — an invisible head holding a duration without printing a note.
   */
  notehead(note: XmlElement, where: string, warn: Warn): NoteheadStyle | undefined {
    const text = XmlReading.textOf(note, 'notehead');

    if (text === undefined) return undefined;

    if (text === 'none') return NoteheadStyle.None;
    if (text === 'normal') return NoteheadStyle.Normal;

    // X, diamond, slash and the rest wait on the unpitched/percussion design
    // TODO-more.md calls for; naming them here would pre-empt it.
    warn(`${where}: unsupported notehead style "${text}"`);

    return undefined;
  },

  /**
   * A grace `<note>` as the `GraceNote` its principal carries. MusicXML writes
   * grace notes as separate notes *preceding* the one they decorate, and
   * `slash="yes"` is the acciaccatura — crushed in — against the appoggiatura
   * that leans on the beat.
   */
  graceNote(note: XmlElement, where: string, warn: Warn): Result<GraceNote> {
    const pitch = PitchReading.pitch(note, where, warn);

    if (!Result.isOk(pitch)) return Result.mapError(pitch);

    const grace = XmlReading.childNamed(note, 'grace');
    const style =
      grace && XmlReading.attribute(grace, 'slash') === 'yes'
        ? GraceStyle.Acciaccatura
        : GraceStyle.Appoggiatura;

    // A grace note's own <type> is its printed size, not measure time — it
    // occupies none. Eighth is the domain's default and the common engraving.
    const typeText = XmlReading.textOf(note, 'type');
    const noteValue =
      typeText === 'sixteenth' || typeText === '16th' ? NoteValue.Sixteenth : NoteValue.Eighth;

    // A grace slurred to its principal — 33 of the 45 here — is carried by
    // `GraceNote.slurred`. Its matching `stop` lands on the principal, and the
    // caller must suppress that (see `endsGraceSlur`): left in place it becomes
    // an End with no Begin, which engraving pops off its pairing stack and
    // charges to whatever phrase slur is open.
    let slurred = false;

    for (const block of XmlReading.childrenNamed(note, 'notations')) {
      for (const child of XmlReading.elements(block)) {
        if (child.name === 'slur' && XmlReading.attribute(child, 'type') === 'start') {
          slurred = true;
        } else {
          warn(`${where}: a grace note's <${child.name}> cannot be carried and is dropped`);
        }
      }
    }

    return Result.ok(GraceNote.of(pitch.value, style, noteValue, slurred));
  },
};
