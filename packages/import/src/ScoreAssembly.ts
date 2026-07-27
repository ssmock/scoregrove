import { Duration } from '@scoregrove/domain/Duration';
import { Fraction } from '@scoregrove/domain/Fraction';
import { Measure, StaffContent, type Voice } from '@scoregrove/domain/Measure';
import { NavigationMark } from '@scoregrove/domain/Navigation';
import { DynamicElement } from '@scoregrove/domain/MeasureElement';
import { NonEmptyArray } from '@scoregrove/domain/NonEmptyArray';
import { NonEmptyString } from '@scoregrove/domain/NonEmptyString';
import { Part } from '@scoregrove/domain/Part';
import { Result } from '@scoregrove/domain/Result';
import { Score } from '@scoregrove/domain/Score';
import { Staff } from '@scoregrove/domain/Staff';
import { TimeSignature } from '@scoregrove/domain/TimeSignature';
import { PartwiseToTimewise, type TimewiseScore } from './PartwiseToTimewise';
import { Reporting } from './Reporting';
import { SpannerReconciliation } from './SpannerReconciliation';
import { SectionAndCapoSynthesis } from './SectionAndCapoSynthesis';
import { StructureReading } from './StructureReading';
import { VoiceBuilding } from './VoiceBuilding';
import { XmlReading, type MusicXmlDocument } from './XmlReading';

/**
 * The aligned grid plus the built staves into a `Score` — the step that makes
 * the importer's output a domain value rather than a pile of readers.
 *
 * Small, and deliberately so: everything hard has already happened. The grid is
 * reconciled, each staff's stream is walked, and what is left is deciding which
 * facts belong to the score and which to a measure.
 *
 * ## Where the initial key, time and clef go
 *
 * `Score` carries a key, a time and a staff's clef; `Measure` carries *changes*
 * to them. `PartwiseToTimewise` reports an attribute only where the file
 * declares one, so the split is positional: measure 0's declarations become the
 * score's, and every later declaration becomes a change on its measure. A file
 * that declares nothing at measure 0 is refused rather than defaulted, because
 * guessing C major would silently misspell every accidental in the piece.
 *
 * ## Why a short measure is marked `partial`
 *
 * A measure whose voices come up short of the time signature is flagged rather
 * than reported. That is the flag's meaning — the shortfall is deliberate — and
 * the alternative would warn 22 times about the pickup bars this work is built
 * from. It is safe to trust here because an actual *import* error does not look
 * like this: a dropped note shortens one voice against its neighbours, which
 * `VoiceBuilding`'s extent rule makes impossible, while a genuine pickup is
 * short in every voice at once. The check that would catch the error is
 * cross-voice agreement, and it runs regardless.
 */

export type AssembledScore = {
  score: Score;
  warnings: readonly string[];
};

/** A voice's written duration, which dynamics take no part in */
const voiceDuration = (voice: Voice): Fraction =>
  voice.elements.reduce(
    (sum, element) =>
      DynamicElement.is(element)
        ? sum
        : Fraction.add(sum, Duration.fractionOfWhole(element.duration)),
    Fraction.zero(),
  );

/** `<work-title>` and the composer from `<identification>`, when the file gives them */
const headerOf = (root: MusicXmlDocument['root']) => {
  const work = XmlReading.childNamed(root, 'work');
  const title = work ? XmlReading.textOf(work, 'work-title') : undefined;
  const identification = XmlReading.childNamed(root, 'identification');
  const composer = identification
    ? XmlReading.childrenNamed(identification, 'creator').find(
        (creator) => XmlReading.attribute(creator, 'type') === 'composer',
      )
    : undefined;

  return {
    ...(NonEmptyString.is(title) ? { title: NonEmptyString.of(title) } : {}),
    ...(composer && NonEmptyString.is(composer.text.trim())
      ? { composer: NonEmptyString.of(composer.text.trim()) }
      : {}),
  };
};

export const ScoreAssembly = {
  /** The work title and composer a document declares, for a caller assembling a slice */
  header: headerOf,

  /**
   * Builds a `Score` from an already-aligned grid. Separate from `build` so the
   * assembly can be tested against a grid made by hand, and so a caller that
   * has already transposed a document does not do it twice.
   */
  fromTimewise(
    timewise: TimewiseScore,
    header: { title?: NonEmptyString; composer?: NonEmptyString } = {},
  ): Result<AssembledScore> {
    const { warn, messages } = Reporting.collector();
    const [first] = timewise.measures;

    if (!first) return Result.invalid('The score contains no measures');

    if (!first.key || !first.time) {
      return Result.invalid(
        'The first measure declares no ' +
          [!first.key ? 'key' : undefined, !first.time ? 'time signature' : undefined]
            .filter(Boolean)
            .join(' and no ') +
          '; a score cannot be assembled without one, and defaulting would misspell the music',
      );
    }

    const staves = first.clefs.map((clef, partIndex) => {
      if (clef) return Staff.of(clef);

      warn(`Part ${partIndex + 1} declares no clef at the first measure; assuming treble`);

      return Staff.of('Treble');
    });

    if (!staves.length) return Result.invalid('The score contains no staves');

    const structures = StructureReading.balanceRepeats(
      StructureReading.of(timewise.measures, warn),
      warn,
    );
    const sections = SectionAndCapoSynthesis.of(timewise.measures, structures, warn);

    let time = first.time;
    const measures: Measure[] = [];

    for (const [position, source] of timewise.measures.entries()) {
      if (source.time) time = source.time;

      const contents: StaffContent[] = [];

      for (const [partIndex, children] of source.contents.entries()) {
        const divisions = source.divisions[partIndex];

        if (divisions === undefined) {
          return Result.invalid(
            `Measure ${source.index}, part ${partIndex + 1}: no <divisions> has been declared`,
          );
        }

        const content = VoiceBuilding.staffContent(
          children,
          divisions,
          `measure ${source.index}, part ${partIndex + 1}`,
          warn,
          // The grid's opening clefs are the score's; anything later is a
          // change here. Keyed on position rather than on the source's own
          // index, so a slice starting at measure 128 behaves like a whole
          // file rather than restating its inherited clef as a change.
          position === 0 ? {} : { clef: source.clefs[partIndex] },
        );

        if (!Result.isOk(content)) return Result.mapError(content);

        contents.push(content.value);
      }

      if (!NonEmptyArray.is(contents)) {
        return Result.invalid(`Measure ${source.index} has no staves`);
      }

      const capacity = TimeSignature.capacity(time);
      const partial = contents.some((content) =>
        content.voices.some((voice) => Fraction.compare(voiceDuration(voice), capacity) < 0),
      );

      const measure = Measure.create({
        contents,
        ...(NonEmptyString.is(source.label) ? { label: NonEmptyString.of(source.label) } : {}),
        ...(partial ? { partial: true } : {}),
        ...(source.key ? { key: source.key } : {}),
        ...(source.time ? { time: source.time } : {}),
        ...structures[position],
        ...(sections[position].newSection ? { newSection: sections[position].newSection } : {}),
        ...(sections[position].capo
          ? {
              marks: NonEmptyArray.of([...(structures[position].marks ?? []), NavigationMark.Capo]),
            }
          : {}),
      });

      if (!Result.isOk(measure)) return Result.mapError(measure);

      measures.push(measure.value);
    }

    // A spanner with only one end here — cut by a slice, or split across a
    // voice renumbering — cannot be paired by the model or drawn by the
    // engraver; see `SpannerReconciliation`.
    const reconciled = SpannerReconciliation.apply(measures, warn);

    if (!NonEmptyArray.is(reconciled)) return Result.invalid('The score contains no measures');

    const parts = timewise.parts.map((part) =>
      Part.of({
        ...(NonEmptyString.is(part.name) ? { name: NonEmptyString.of(part.name) } : {}),
        ...(NonEmptyString.is(part.abbreviation)
          ? { abbreviation: NonEmptyString.of(part.abbreviation) }
          : {}),
        ...(NonEmptyString.is(part.instrumentSound)
          ? { sound: NonEmptyString.of(part.instrumentSound) }
          : {}),
      }),
    );

    const score = Score.of({
      ...header,
      staves: NonEmptyArray.of(staves),
      ...(NonEmptyArray.is(parts) ? { parts } : {}),
      ...(timewise.groups.length ? { groups: timewise.groups } : {}),
      key: first.key,
      time: first.time,
      measures: reconciled,
    });

    return Result.ok({ score, warnings: [...timewise.warnings, ...messages] });
  },

  /** The whole path from a parsed document to a `Score` */
  build(document: MusicXmlDocument): Result<AssembledScore> {
    const timewise = PartwiseToTimewise.build(document);

    if (!Result.isOk(timewise)) return Result.mapError(timewise);

    return ScoreAssembly.fromTimewise(timewise.value, headerOf(document.root));
  },
};
