import { DynamicChange, DynamicMark, type Dynamic } from '@scoregrove/domain/Dynamic';
import type { XmlElement } from '@rgrove/parse-xml';
import type { Warn } from './Reporting';
import { XmlReading } from './XmlReading';

/**
 * `<direction>` into the dynamics it contributes to a voice.
 *
 * ## Why this is not measure-level, as the plan first had it
 *
 * A direction looks like a property of the measure — it is a sibling of the
 * notes, not a child of one — so the plan grouped it with tempo and rehearsal
 * text. That is right for what a direction *says* and wrong for where it
 * *goes*: our `DynamicElement` is a `MeasureElement`, sitting in a voice's
 * sequence at a position, because a dynamic takes effect at the note that
 * follows it and a hairpin runs until the next one. So the dynamics half of
 * `<direction>` belongs to the element builder's walk, and only the tempo and
 * section-title half is genuinely measure-level.
 *
 * `<wedge>` comes with the dynamics for the same reason, not with the words:
 * `DynamicChange` is a `Dynamic`, so a hairpin is an element in a voice like
 * any other mark.
 *
 * ## What the corpus holds
 *
 * 442 directions: 406 `<dynamics>`, 16 `<wedge>` (8 spans), and 20 `<words>`
 * that carry the movement titles, tempo marks and navigation text. The words
 * are `StructureReading`'s and `SectionAndCapoSynthesis`'s, and are passed over
 * here without comment because those readers report what they cannot use —
 * warning in both places would blame this one for text that is read.
 */

/**
 * MusicXML's dynamics elements against the marks we model. The absentees are
 * as telling as the entries: this corpus uses `fz` 149 times, more than any
 * other, which is why `DynamicMark.Forzando` exists as its own member rather
 * than as a mapping onto `sfz`.
 */
const marksByTag: Record<string, DynamicMark> = {
  ppp: DynamicMark.Pianississimo,
  pp: DynamicMark.Pianissimo,
  p: DynamicMark.Piano,
  mp: DynamicMark.MezzoPiano,
  mf: DynamicMark.MezzoForte,
  f: DynamicMark.Forte,
  ff: DynamicMark.Fortissimo,
  fff: DynamicMark.Fortississimo,
  sfz: DynamicMark.Sforzando,
  fz: DynamicMark.Forzando,
  fp: DynamicMark.Fortepiano,
};

const changesByWedge: Record<string, DynamicChange> = {
  crescendo: DynamicChange.Crescendo,
  diminuendo: DynamicChange.Diminuendo,
};

export const DirectionReading = {
  /**
   * The dynamics this direction places in the voice it sits in, in document
   * order. A direction carrying none — a tempo mark, a section title — yields
   * an empty list and reports what it was carrying.
   *
   * `<sound>` is deliberately not read here. It duplicates the printed dynamic
   * as a playback number on 406 of these directions, and its `fine`/`dacapo`
   * attributes are navigation; both belong to other readers, and taking the
   * loudness from it would give the same fact two sources of truth.
   */
  dynamics(direction: XmlElement, where: string, warn: Warn): Dynamic[] {
    const found: Dynamic[] = [];

    for (const type of XmlReading.childrenNamed(direction, 'direction-type')) {
      for (const child of XmlReading.elements(type)) {
        if (child.name === 'dynamics') {
          for (const mark of XmlReading.elements(child)) {
            const known = marksByTag[mark.name];

            if (known) {
              found.push(known);
              continue;
            }

            if (mark.name === 'other-dynamics') {
              // Expressive text encoded as a dynamic — " dolce" four times and
              // " sempre" once, both with the leading space the transcription
              // left in. Neither is a loudness and the domain has nowhere to
              // put a word, so the word is genuinely lost; but every one of
              // them shares its `<dynamics>` block with a real mark (" dolce"
              // on a `p`, " sempre" on an `fz`), so the loudness itself
              // survives and the loss is the annotation alone.
              warn(
                `${where}: <other-dynamics>${mark.text.trim()}</other-dynamics> is expressive text, not a loudness; dropping it`,
              );
              continue;
            }

            warn(`${where}: unsupported dynamic <${mark.name}>`);
          }

          continue;
        }

        if (child.name === 'wedge') {
          const type = XmlReading.attribute(child, 'type');
          const change = type === undefined ? undefined : changesByWedge[type];

          if (change) {
            found.push(change);
            continue;
          }

          // A hairpin's *end* has no representation: a change runs until the
          // next dynamic indication, which is usually where the wedge stopped
          // but need not be. Reported rather than assumed.
          if (type === 'stop') {
            warn(
              `${where}: a wedge ends here, which is not representable; the change runs to the next dynamic`,
            );
            continue;
          }

          warn(`${where}: unsupported wedge type "${type ?? ''}"`);

          continue;
        }

        // `<words>` belongs to `StructureReading` and `SectionAndCapoSynthesis`
        // — tempo marks, movement titles, variation headings — which report
        // whatever they cannot use. Warning here as well would double-count
        // text that is in fact read, and would blame the wrong reader for it.
        if (child.name === 'words') continue;

        warn(`${where}: <${child.name}> in a <direction> is not read yet`);
      }
    }

    return found;
  },
};
