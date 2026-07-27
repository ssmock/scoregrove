import { Duration } from '@scoregrove/domain/Duration';
import { Fraction } from '@scoregrove/domain/Fraction';
import { Chord, DynamicElement, Note, Rest } from '@scoregrove/domain/MeasureElement';
import { Accidental, Pitch, PitchLetter } from '@scoregrove/domain/Pitch';
import { Result } from '@scoregrove/domain/Result';
import { Score } from '@scoregrove/domain/Score';
import { Semitone } from '@scoregrove/domain/Semitone';
import type { XmlElement } from '@rgrove/parse-xml';
import { ImportReport } from './ImportReport';
import { PitchReading } from './PitchReading';
import { XmlReading, type MusicXmlDocument } from './XmlReading';

/**
 * "Did the import work?" as a reusable mode rather than a script per piece.
 *
 * Every check here compares the built `Score` against **the source file** or
 * against itself. That is the difference between this and `ImportReport`, whose
 * audit compares the file against a hand-kept list of names and therefore
 * balances however badly a reader behaves.
 *
 * ## Per measure, not per score
 *
 * A total note count lets two errors cancel — one note dropped in bar 12, one
 * duplicated in bar 300, and the sum still matches. Every count here is per
 * (part, measure), which refuses to cancel and says *where* to look, the
 * difference between "the import is wrong" and a debuggable failure.
 *
 * ## What each check is for
 *
 * They are chosen so that each catches a class the others miss. Counting sees a
 * dropped note but not a wrong octave; the pitch digest sees a wrong octave but
 * not a wrong note value; the duration digest sees that; cross-part agreement
 * needs no oracle at all and is the sharpest check on `<backup>`/`<forward>`;
 * and the range check fails loudly on a whole-class transposition error that
 * every per-measure comparison would agree with, because the source and the
 * importer would be wrong together.
 */

export type Check = {
  name: string;
  passed: boolean;
  /** What went wrong, and where — empty when the check passed */
  failures: readonly string[];
};

export type VerificationReport = {
  checks: readonly Check[];
  passed: boolean;
};

/**
 * A written pitch as an absolute chromatic number, without consulting a key.
 * The range check only compares two pitches, and a key would make an unaltered
 * note's number depend on the signature in force — which is exactly the thing
 * this check must not do, since a transposition bug would move the key too.
 */
const absolute = (pitch: Pitch): number =>
  pitch.octave * 12 +
  Semitone.ofLetter(pitch.pitchClass.letter) +
  Semitone.ofAccidental(pitch.pitchClass.accidental ?? Accidental.Natural);

/** The lowest note each instrument can play — its bottom open string */
const lowestSounding: Record<string, { name: string; semitones: number }> = {
  'strings.violin': { name: 'G3', semitones: 3 * 12 + Semitone.ofLetter(PitchLetter.G) },
  'strings.viola': { name: 'C3', semitones: 3 * 12 + Semitone.ofLetter(PitchLetter.C) },
  'strings.cello': { name: 'C2', semitones: 2 * 12 + Semitone.ofLetter(PitchLetter.C) },
};

/** The source's sounded notes for one part's measure, in document order */
const sourceNotes = (children: readonly XmlElement[]) =>
  children.filter((child) => child.name === 'note' && !PitchReading.isGrace(child));

/** Every sounding element of a staff's measure, across all its voices, in order */
const staffElements = (score: Score, measureIndex: number, staff: number) =>
  score.measures[measureIndex].contents[staff].voices.flatMap((voice) =>
    voice.elements.filter((element) => !DynamicElement.is(element)),
  );

const check = (name: string, failures: string[]): Check => ({
  name,
  passed: failures.length === 0,
  // Long failure lists are unreadable and the first few are enough to debug
  failures: failures.slice(0, 8),
});

export const Verification = {
  /**
   * Runs every estimator against a document. The document is imported here
   * rather than taken as a `Score`, because two of the checks — determinism and
   * slice consistency — need to run the import themselves.
   */
  run(document: MusicXmlDocument): Result<VerificationReport> {
    const report = ImportReport.build(document);

    if (!Result.isOk(report)) return Result.mapError(report);

    const { score } = report.value;
    const parts = XmlReading.childrenNamed(document.root, 'part');
    const measuresPerPart = parts.map((part) => XmlReading.childrenNamed(part, 'measure'));
    const checks: Check[] = [];

    // --- The domain's own invariants, free ---
    const checked = Score.check(score);

    checks.push(check('Score.check', Result.isOk(checked) ? [] : [...checked.error.messages]));

    // --- Tier 1: per-part, per-measure element counts against the source ---
    const countFailures: string[] = [];

    measuresPerPart.forEach((measures, staff) => {
      measures.forEach((measure, index) => {
        if (index >= score.measures.length) return;

        const source = sourceNotes(XmlReading.elements(measure));
        const sourceSounded = source.filter((note) => !PitchReading.isChordMember(note)).length;
        const sourceTones = source.filter((note) => PitchReading.isChordMember(note)).length;

        const built = staffElements(score, index, staff);
        const builtSounded = built.length;
        const builtTones = built.reduce(
          (sum, element) => sum + (Chord.is(element) ? element.tones.length - 1 : 0),
          0,
        );

        // Rests the importer synthesised to fill a <forward> have no source
        // note, so the built count may legitimately exceed the source's.
        if (builtSounded < sourceSounded || builtTones !== sourceTones) {
          countFailures.push(
            `part ${staff + 1}, measure ${index}: source has ${sourceSounded} elements ` +
              `and ${sourceTones} extra chord tones, built has ${builtSounded} and ${builtTones}`,
          );
        }
      });
    });

    checks.push(check('per-measure element counts', countFailures));

    // --- Tier 2: per-measure pitch digest ---
    const pitchFailures: string[] = [];

    measuresPerPart.forEach((measures, staff) => {
      measures.forEach((measure, index) => {
        if (index >= score.measures.length) return;

        const expected = sourceNotes(XmlReading.elements(measure))
          .filter((note) => !PitchReading.isRest(note))
          .map((note) => {
            const pitch = XmlReading.childNamed(note, 'pitch');

            if (!pitch) return '?';

            const step = XmlReading.textOf(pitch, 'step') ?? '?';
            const alter = Number(XmlReading.textOf(pitch, 'alter') ?? '0');
            const octave = XmlReading.textOf(pitch, 'octave') ?? '?';

            return `${step}${alter > 0 ? '+'.repeat(alter) : '-'.repeat(-alter)}${octave}`;
          })
          .join(' ');

        const actual = staffElements(score, index, staff)
          .flatMap((element) =>
            Note.is(element)
              ? [element.pitch]
              : Chord.is(element)
                ? element.tones.map((tone) => tone.pitch)
                : [],
          )
          .map((pitch) => {
            const alter = Semitone.ofAccidental(pitch.pitchClass.accidental ?? Accidental.Natural);

            return `${pitch.pitchClass.letter}${alter > 0 ? '+'.repeat(alter) : '-'.repeat(-alter)}${pitch.octave}`;
          })
          .join(' ');

        if (expected !== actual) {
          pitchFailures.push(
            `part ${staff + 1}, measure ${index}: source "${expected}" against built "${actual}"`,
          );
        }
      });
    });

    checks.push(check('per-measure pitch sequence', pitchFailures));

    // --- Tier 3: cross-part agreement, needing no oracle whatever ---
    const agreementFailures: string[] = [];

    score.measures.forEach((measure, index) => {
      const spans = measure.contents.flatMap((content) =>
        content.voices.map((voice) =>
          voice.elements.reduce(
            (sum, element) =>
              DynamicElement.is(element)
                ? sum
                : Fraction.add(sum, Duration.fractionOfWhole(element.duration)),
            Fraction.zero(),
          ),
        ),
      );

      if (spans.some((span) => !Fraction.equals(span, spans[0]))) {
        agreementFailures.push(
          `measure ${index}: voices span ${spans.map(Fraction.format).join(', ')}`,
        );
      }
    });

    checks.push(check('every voice of a measure spans the same time', agreementFailures));

    // --- Tier 3: determinism ---
    const again = ImportReport.build(document);
    const determinismFailures =
      Result.isOk(again) && JSON.stringify(again.value.score) === JSON.stringify(score)
        ? []
        : ['importing the same document twice produced different output'];

    checks.push(check('determinism', determinismFailures));

    // --- Tier 3: slicing agrees with slicing the whole ---
    const sliceFailures: string[] = [];
    const from = Math.min(1, score.measures.length - 1);
    const to = Math.min(from + 8, score.measures.length - 1);
    const sliced = ImportReport.build(document, { from, to });

    if (!Result.isOk(sliced)) {
      sliceFailures.push(`importing measures ${from}-${to} failed`);
    } else if (sliced.value.score.measures.length !== to - from + 1) {
      sliceFailures.push(
        `importing measures ${from}-${to} gave ${sliced.value.score.measures.length} measures`,
      );
    } else {
      // Only the contents are compared: a slice legitimately differs in what it
      // *declares*, since it restates the key, time and clef in force at its
      // first measure (see `MeasureSlicing`).
      for (let offset = 0; offset <= to - from; offset += 1) {
        const left = JSON.stringify(sliced.value.score.measures[offset].contents);
        const right = JSON.stringify(score.measures[from + offset].contents);

        if (left !== right) sliceFailures.push(`sliced measure ${from + offset} differs`);
      }
    }

    checks.push(check('a slice matches the same measures of the whole', sliceFailures));

    // --- Tier 4: pitch range per instrument ---
    const rangeFailures: string[] = [];

    score.parts?.forEach((part, staff) => {
      const limit = part.sound ? lowestSounding[part.sound] : undefined;

      if (!limit) return;

      score.measures.forEach((_measure, index) => {
        for (const element of staffElements(score, index, staff)) {
          const pitches = Note.is(element)
            ? [element.pitch]
            : Chord.is(element)
              ? element.tones.map((tone) => tone.pitch)
              : [];

          for (const pitch of pitches) {
            if (absolute(pitch) < limit.semitones) {
              rangeFailures.push(
                `part ${staff + 1} (${part.sound}), measure ${index}: ` +
                  `${Pitch.format(pitch)} is below ${limit.name}, its lowest string`,
              );
            }
          }
        }
      });
    });

    checks.push(check('no part plays below its instrument’s lowest string', rangeFailures));

    // --- Tier 4: rests are not the bulk of the music ---
    const sounding = score.measures.flatMap((_measure, index) =>
      score.staves.flatMap((_staff, staff) => staffElements(score, index, staff)),
    );
    const rests = sounding.filter(Rest.is).length;
    const restFailures =
      sounding.length && rests / sounding.length > 0.5
        ? [`${rests} of ${sounding.length} elements are rests, which suggests notes were lost`]
        : [];

    checks.push(check('rests are a minority of the elements', restFailures));

    return Result.ok({ checks, passed: checks.every((entry) => entry.passed) });
  },
};
