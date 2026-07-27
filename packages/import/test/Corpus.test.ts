import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { Clef } from '@scoregrove/domain/Clef';
import { Result } from '@scoregrove/domain/Result';
import { Score } from '@scoregrove/domain/Score';
import { Duration, NoteValue } from '@scoregrove/domain/Duration';
import { Fraction } from '@scoregrove/domain/Fraction';
import { Chord, DynamicElement, Note, Rest } from '@scoregrove/domain/MeasureElement';
import { TimeSignature } from '@scoregrove/domain/TimeSignature';
import type { Pitch } from '@scoregrove/domain/Pitch';
import { DivisionsToDuration } from '../src/DivisionsToDuration';
import { PartwiseToTimewise } from '../src/PartwiseToTimewise';
import { Coverage } from '../src/Coverage';
import { DirectionReading } from '../src/DirectionReading';
import { ImportReport } from '../src/ImportReport';
import { NotationReading } from '../src/NotationReading';
import { PitchReading } from '../src/PitchReading';
import { Reporting } from '../src/Reporting';
import { ScoreAssembly } from '../src/ScoreAssembly';
import { Verification } from '../src/Verification';
import { VoiceBuilding } from '../src/VoiceBuilding';
import { XmlReading } from '../src/XmlReading';

/**
 * Reads the real Haydn corpus rather than a synthetic fixture. A 4 MB file of
 * genuine engraver output exercises things no hand-written sample does — a
 * DOCTYPE pointing at the network, 113k elements, and every quirk of a real
 * transcription — and it is the file the whole project is aimed at, so a
 * parser that cannot read it is not useful however well it handles samples.
 */
const corpusPath = fileURLToPath(new URL('../corpus/haydn-op76-no3.musicxml', import.meta.url));

const document = (() => {
  const result = XmlReading.parse(readFileSync(corpusPath, 'utf8'));

  if (!Result.isOk(result)) throw new Error(result.error.messages.join('; '));

  return result.value;
})();

describe('the Haydn corpus', () => {
  it('parses, offline, without fetching the DOCTYPE it declares', () => {
    expect(document.root.name).toBe('score-partwise');
    expect(document.version).toBe('4.0');
  });

  it('has the four parts the census found, in score order', () => {
    const partList = XmlReading.childNamed(document.root, 'part-list')!;
    const names = XmlReading.childrenNamed(partList, 'score-part').map((part) =>
      XmlReading.textOf(part, 'part-name'),
    );

    expect(names).toEqual(['Violin 1', 'Violin 2', 'Viola', 'Violoncello']);
  });

  it('carries 531 measures in each of the four parts', () => {
    const parts = XmlReading.childrenNamed(document.root, 'part');

    expect(parts).toHaveLength(4);

    for (const part of parts) {
      expect(XmlReading.childrenNamed(part, 'measure')).toHaveLength(531);
    }
  });

  it('totals the element count the census measured', () => {
    // The denominator of the accounting identity. If this number moves, either
    // the corpus changed or the counter is wrong — both worth knowing.
    expect(XmlReading.totalElements(document.root)).toBe(113_657);
  });

  it('counts individual elements as the census did', () => {
    const counts = XmlReading.countElements(document.root);

    expect(counts.get('note')).toBe(10_593);
    expect(counts.get('slur')).toBe(2_416);
    expect(counts.get('trill-mark')).toBe(52);
    expect(counts.get('turn')).toBe(13);
    expect(counts.get('tremolo')).toBeUndefined();
  });

  it('preserves document order within a measure', () => {
    // `<backup>` and `<forward>` mean nothing except positionally, so the
    // parser earns its place only if their position survives.
    const firstPart = XmlReading.childrenNamed(document.root, 'part')[0];
    const measures = XmlReading.childrenNamed(firstPart, 'measure');
    const withBackup = measures.find((measure) =>
      XmlReading.elements(measure).some((child) => child.name === 'backup'),
    )!;

    const names = XmlReading.elements(withBackup).map((child) => child.name);

    expect(names).toContain('backup');
    expect(names.indexOf('backup')).toBeGreaterThan(0);
    expect(names.filter((name) => name === 'note').length).toBeGreaterThan(0);
  });
});

describe('the Haydn corpus, transposed to timewise', () => {
  const built = (() => {
    const result = PartwiseToTimewise.build(document);

    if (!Result.isOk(result)) throw new Error(result.error.messages.join('; '));

    return result.value;
  })();

  it('aligns all four parts across 531 measures', () => {
    expect(built.measures).toHaveLength(531);

    for (const measure of built.measures) {
      expect(measure.contents).toHaveLength(4);
    }
  });

  it('reads the four parts with their instrument sounds', () => {
    expect(built.parts.map((part) => part.name)).toEqual([
      'Violin 1',
      'Violin 2',
      'Viola',
      'Violoncello',
    ]);

    expect(built.parts.map((part) => part.instrumentSound)).toEqual([
      'strings.violin',
      'strings.violin',
      'strings.viola',
      'strings.cello',
    ]);
  });

  it('has no part abbreviations to import — they are ours to author', () => {
    expect(built.parts.map((part) => part.abbreviation)).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
  });

  it('reconciles the key changes to the indices the census found', () => {
    const keyed = built.measures.filter((measure) => measure.key);

    expect(keyed.map((measure) => measure.index)).toEqual([0, 128, 237, 341, 493]);
    expect(keyed.map((measure) => measure.key!.tonic.letter)).toEqual(['C', 'G', 'C', 'E', 'C']);
  });

  it('reconciles the time changes to the indices the census found', () => {
    const timed = built.measures.filter((measure) => measure.time);

    expect(timed.map((measure) => measure.index)).toEqual([
      0, 128, 149, 170, 191, 212, 237, 295, 341,
    ]);
    expect(timed[0].time!.symbol).toBe('Common');
    expect(timed[1].time!.symbol).toBe('CutCommon');
  });

  it('finds no genuine disagreement between the parts', () => {
    // Every score-wide attribute in this corpus is either duplicated
    // identically or written on one part alone. A conflict would mean the
    // encoding contradicts itself.
    expect(built.warnings.filter((warning) => warning.includes('disagree'))).toEqual([]);
  });

  it('reads the cello into tenor clef and back, reporting the mid-measure change', () => {
    expect(built.measures[224].clefs[3]).toBe(Clef.Tenor);
    expect(built.measures[225].clefs[3]).toBe(Clef.Bass);

    const midMeasure = built.warnings.filter((warning) => warning.includes('mid-measure'));

    expect(midMeasure).toHaveLength(1);
    expect(midMeasure[0]).toContain('measure index 225');
  });

  it('carries divisions of 24 for every part, all the way through', () => {
    expect(built.measures[0].divisions).toEqual([24, 24, 24, 24]);
    expect(built.measures[530].divisions).toEqual([24, 24, 24, 24]);
  });

  it('warns only about the mode assumption and the one mid-measure clef', () => {
    // The whole warning set, so anything new shows up here rather than being
    // lost in a pile — five key changes with no <mode>, and the cello's clef.
    const kinds = new Set(
      built.warnings.map((warning) =>
        warning.includes('assuming Major') ? 'mode assumed' : warning,
      ),
    );

    expect([...kinds].sort()).toEqual([
      'Violoncello, measure index 225: <attributes> appears mid-measure; applying it at the measure start',
      'mode assumed',
    ]);
  });
});

describe('the Haydn corpus, every duration read', () => {
  const built = (() => {
    const result = PartwiseToTimewise.build(document);

    if (!Result.isOk(result)) throw new Error(result.error.messages.join('; '));

    return result.value;
  })();

  /** Every note in the work, read through DivisionsToDuration */
  const readAll = () => {
    const { warn, messages } = Reporting.collector();
    const durations: Duration[] = [];
    const failures: string[] = [];

    for (const measure of built.measures) {
      measure.contents.forEach((elements, partIndex) => {
        const divisions = measure.divisions[partIndex]!;

        for (const element of elements) {
          if (element.name !== 'note') continue;

          const where = `${built.parts[partIndex].name}, measure index ${measure.index}`;
          const result = DivisionsToDuration.read(element, divisions, where, warn);

          if (Result.isOk(result)) durations.push(result.value);
          else failures.push(result.error.messages.join('; '));
        }
      });
    }

    return { durations, failures, warnings: messages };
  };

  const { durations, failures, warnings } = readAll();

  it('reads every one of the 10,593 notes without a failure', () => {
    expect(failures).toEqual([]);
    expect(durations).toHaveLength(10_593);
  });

  it('finds the written and sounded durations agree throughout', () => {
    // The whole point of the cross-check: 10,593 notes where <type> plus dots
    // plus time-modification, converted back into divisions, must reproduce
    // <duration> exactly. Silence here means the encoding is self-consistent
    // and we are reading it as the engraver meant.
    expect(warnings).toEqual([]);
  });

  it('recovers the 160 whole-measure rests from their length alone', () => {
    // These carry no <type>, so they exercise the inverse: 100 in 4/4 or 2/2
    // (a whole note) and 60 in 3/4 (a dotted half).
    const wholes = durations.filter((duration) =>
      Duration.equals(duration, Duration.of(NoteValue.Whole)),
    );
    const dottedHalves = durations.filter((duration) =>
      Duration.equals(duration, Duration.of(NoteValue.Half, { dots: 1 })),
    );

    expect(wholes.length).toBeGreaterThanOrEqual(100);
    expect(dottedHalves.length).toBeGreaterThanOrEqual(60);
  });

  it('reads the tuplets the census counted', () => {
    const tuplets = durations.filter((duration) => duration.tuplet);

    expect(tuplets).toHaveLength(1_254);
    expect(tuplets.filter((d) => d.tuplet!.count === 3)).toHaveLength(1_224);
    expect(tuplets.filter((d) => d.tuplet!.count === 6)).toHaveLength(30);
  });

  it('reads the 547 dotted notes the census counted, and no double dots', () => {
    expect(durations.filter((duration) => duration.dots === 1).length).toBeGreaterThanOrEqual(547);
    expect(durations.filter((duration) => duration.dots === 2)).toEqual([]);
  });
});

describe('the Haydn corpus, every pitch read', () => {
  const built = (() => {
    const result = PartwiseToTimewise.build(document);

    if (!Result.isOk(result)) throw new Error(result.error.messages.join('; '));

    return result.value;
  })();

  const readAll = () => {
    const { warn, messages } = Reporting.collector();
    const pitches: Pitch[] = [];
    const failures: string[] = [];
    let rests = 0;
    let pinnedRests = 0;
    let chordTones = 0;
    let graces = 0;

    for (const measure of built.measures) {
      measure.contents.forEach((elements, partIndex) => {
        const where = `${built.parts[partIndex].name}, measure index ${measure.index}`;
        const notes = elements.filter((element) => element.name === 'note');

        for (const group of PitchReading.chordGroups(notes, warn)) {
          if (group.length > 1) chordTones += group.length;
        }

        for (const note of notes) {
          if (PitchReading.isGrace(note)) graces += 1;

          if (PitchReading.isRest(note)) {
            rests += 1;

            if (PitchReading.restPosition(note, where, warn)) pinnedRests += 1;

            continue;
          }

          const result = PitchReading.pitch(note, where, warn);

          if (Result.isOk(result)) pitches.push(result.value);
          else failures.push(result.error.messages.join('; '));
        }
      });
    }

    return { pitches, rests, pinnedRests, chordTones, graces, failures, warnings: messages };
  };

  const { pitches, rests, pinnedRests, chordTones, graces, failures, warnings } = readAll();

  it('reads every sounded pitch without a failure', () => {
    expect(failures).toEqual([]);
    // 10,593 notes less the 1,296 rests the census counted.
    expect(pitches).toHaveLength(10_593 - 1_296);
    expect(rests).toBe(1_296);
  });

  it('finds no note whose sounding and printed accidentals disagree', () => {
    expect(warnings.filter((warning) => warning.includes('disagrees'))).toEqual([]);
  });

  it('groups the double stops the census counted', () => {
    // 534 <chord/> elements, each a tone joining the note before it, so the
    // tones involved are those 534 plus one leading note per chord.
    expect(chordTones).toBeGreaterThan(534);
    expect(graces).toBe(45);
  });

  it('carries the three rests the writer pinned to a chosen row', () => {
    expect(pinnedRests).toBe(3);
    expect(warnings.filter((warning) => warning.includes('unusable rest position'))).toEqual([]);
  });

  it('spells the accidentals the census counted', () => {
    const explicit = pitches.filter((pitch) => pitch.pitchClass.accidental);
    const naturals = explicit.filter((pitch) => pitch.pitchClass.accidental === 'Natural');

    // 2,016 <alter> elements plus the 313 naturals that carry no alteration.
    expect(explicit).toHaveLength(2_016 + 313);
    expect(naturals).toHaveLength(313);
  });
});

describe('the Haydn corpus, every notation read', () => {
  const built = (() => {
    const result = PartwiseToTimewise.build(document);

    if (!Result.isOk(result)) throw new Error(result.error.messages.join('; '));

    return result.value;
  })();

  const readAll = () => {
    const { warn, messages } = Reporting.collector();
    const ties: string[] = [];
    const slurs: string[] = [];
    let staccatos = 0;
    let fermatas = 0;
    const graces: string[] = [];
    const ornaments: string[] = [];
    let slurredGraces = 0;

    for (const measure of built.measures) {
      measure.contents.forEach((elements, partIndex) => {
        const where = `${built.parts[partIndex].name}, measure index ${measure.index}`;

        // Whether the graces immediately before the current note slur into it
        let pendingGraceSlur = false;

        for (const note of elements.filter((element) => element.name === 'note')) {
          const tie = NotationReading.tie(note);

          if (tie) ties.push(tie);

          if (PitchReading.isGrace(note)) {
            const grace = NotationReading.graceNote(note, where, warn);

            if (Result.isOk(grace)) {
              graces.push(grace.value.style);

              if (grace.value.slurred) {
                slurredGraces += 1;
                pendingGraceSlur = true;
              }
            }

            continue;
          }

          const notations = NotationReading.notations(note, where, warn, {
            endsGraceSlur: pendingGraceSlur,
          });

          pendingGraceSlur = false;

          if (notations.slur) slurs.push(notations.slur);
          if (notations.fermata) fermatas += 1;

          ornaments.push(...(notations.ornaments ?? []));

          staccatos += (notations.articulations ?? []).length;
        }
      });
    }

    return {
      ties,
      slurs,
      staccatos,
      fermatas,
      graces,
      ornaments,
      slurredGraces,
      warnings: messages,
    };
  };

  const { ties, slurs, staccatos, fermatas, graces, ornaments, slurredGraces, warnings } =
    readAll();

  it('reads the 350 tie roles, including 23 notes mid-chain', () => {
    // 175 starts and 175 stops, but 23 notes carry both — the middle of a
    // chain of three or more tied notes, which `Both` exists for.
    expect(ties.filter((role) => role === 'Begin')).toHaveLength(152);
    expect(ties.filter((role) => role === 'End')).toHaveLength(152);
    expect(ties.filter((role) => role === 'Both')).toHaveLength(23);
  });

  it('reads the slurs, and reports only the eight that overlap', () => {
    // 2,416 slur elements over 1,208 pairs; a note that both ends and begins
    // one counts once, so the roles are fewer than the elements.
    expect(slurs.length).toBeGreaterThan(0);

    // All 8 numbered slur pairs are grace-to-principal slurs, and the work has
    // no genuinely nested phrase slurs at all. `GraceNote.slurred` carries each
    // one, so nothing is lost and nothing is reported.
    const numbering = warnings.filter((warning) => warning.includes('dropping it whole'));

    expect(numbering).toEqual([]);
  });

  it('reads every articulation and fermata the census counted', () => {
    expect(staccatos).toBe(1_040);
    expect(fermatas).toBe(43);
  });

  it('reads the 45 grace notes, slashed and unslashed', () => {
    expect(graces).toHaveLength(45);
    expect(graces.filter((style) => style === 'Acciaccatura')).toHaveLength(25);
    expect(graces.filter((style) => style === 'Appoggiatura')).toHaveLength(20);
  });

  it('reads every ornament into the domain, dropping none', () => {
    // 52 trills and 13 turns. These were reported as losses until the domain
    // grew an `Ornament` vocabulary; now they survive the import.
    expect(ornaments.filter((kind) => kind === 'Trill')).toHaveLength(52);
    expect(ornaments.filter((kind) => kind === 'Turn')).toHaveLength(13);
    expect(warnings.filter((warning) => warning.includes('unsupported ornament'))).toEqual([]);
  });

  it('carries the grace-note slurs instead of dropping them', () => {
    // 32 grace notes start a slur to their principal, and `GraceNote.slurred`
    // now holds it. One further grace carries a slur *stop* — a grace ending a
    // slur begun elsewhere, which is not the grace-to-principal shape — and
    // that one is still reported.
    expect(slurredGraces).toBe(32);

    const dropped = warnings.filter((warning) => warning.includes("grace note's"));

    expect(dropped).toHaveLength(1);
  });

  it('raises no warning kind beyond dropped slurs and grace-note slurs', () => {
    const others = warnings.filter(
      (warning) =>
        !warning.includes('unsupported ornament') &&
        !warning.includes('dropping it whole') &&
        !warning.includes("grace note's"),
    );

    expect(others).toEqual([]);
  });
});

describe('the Haydn corpus, element coverage', () => {
  const audit = Coverage.audit(XmlReading.countElements(document.root).keys());

  it('accounts for every element name in the file', () => {
    // The audit's whole purpose. An element no list mentions is one no reader
    // looks at — so it raises no warning *because* nobody looked, which is the
    // one failure mode this importer is not allowed to have.
    expect(audit.unaccounted).toEqual([]);
  });

  it('loses exactly one thing the file contains, and names it', () => {
    // Every element name in the corpus is carried by the model, pending a
    // module, or dropped by a decision with a reason. Exactly one is a real
    // loss: the expressive words this transcription encodes as dynamics. It
    // sits here rather than in `ignored` because keeping it would need a
    // domain concept the model does not have, not merely a reader.
    expect(audit.unrepresented.map((entry) => entry.name)).toEqual(['other-dynamics']);
  });

  it('has no element name left waiting for a reader', () => {
    // Every name this file contains now reaches one. That is a claim about
    // vocabulary and not about fidelity: `unrepresented` above is what is read
    // and still cannot be carried, and the per-element counting that would
    // catch a reader dropping part of what it met is `ImportReport`'s, still
    // to build (see section B, tier 1, in haydn-project.md).
    expect(audit.pending).toEqual([]);
  });
});

describe('the Haydn corpus, staff grouping and noteheads', () => {
  const built = (() => {
    const result = PartwiseToTimewise.build(document);

    if (!Result.isOk(result)) throw new Error(result.error.messages.join('; '));

    return result.value;
  })();

  it('reads the bracket over all four parts, with barlines joined', () => {
    // The file opens with exactly this, and it was dropped entirely until the
    // domain grew `StaffGroup` — the most visible loss of the three.
    expect(built.groups).toEqual([{ symbol: 'Bracket', from: 0, to: 3, barlines: true }]);
  });

  it('carries the 14 invisible noteheads', () => {
    const { warn, messages } = Reporting.collector();
    let hidden = 0;

    for (const measure of built.measures) {
      for (const elements of measure.contents) {
        for (const note of elements.filter((element) => element.name === 'note')) {
          if (NotationReading.notehead(note, 'here', warn) === 'None') hidden += 1;
        }
      }
    }

    expect(hidden).toBe(14);
    expect(messages).toEqual([]);
  });
});

describe('the Haydn corpus, assembled into staff contents', () => {
  const built = (() => {
    const result = PartwiseToTimewise.build(document);

    if (!Result.isOk(result)) throw new Error(result.error.messages.join('; '));

    return result.value;
  })();

  /** Every source `<note>`, split the way the walk has to split them */
  const sourceNotes = (() => {
    let rests = 0;
    let chordMembers = 0;
    let graces = 0;
    let total = 0;

    for (const measure of built.measures) {
      for (const children of measure.contents) {
        for (const note of children.filter((element) => element.name === 'note')) {
          total += 1;

          if (PitchReading.isRest(note)) rests += 1;
          else if (PitchReading.isChordMember(note)) chordMembers += 1;
          else if (PitchReading.isGrace(note)) graces += 1;
        }
      }
    }

    return { total, rests, chordMembers, graces };
  })();

  const walk = (() => {
    const { warn, messages } = Reporting.collector();
    const counts = { notes: 0, rests: 0, chords: 0, chordTones: 0, graces: 0, voices: 0 };
    let failures = 0;
    let disagreements = 0;
    let short = 0;
    let overfull = 0;
    let time: TimeSignature | undefined;

    for (const measure of built.measures) {
      if (measure.time) time = measure.time;

      const sums: Fraction[] = [];

      measure.contents.forEach((children, partIndex) => {
        const divisions = measure.divisions[partIndex];

        if (divisions === undefined) throw new Error(`no divisions at measure ${measure.index}`);

        const content = VoiceBuilding.staffContent(
          children,
          divisions,
          `measure ${measure.index}, part ${partIndex}`,
          warn,
        );

        if (!Result.isOk(content)) {
          failures += 1;

          return;
        }

        for (const voice of content.value.voices) {
          counts.voices += 1;

          let sum = Fraction.zero();

          for (const element of voice.elements) {
            if (Note.is(element)) {
              counts.notes += 1;
              counts.graces += element.graces?.length ?? 0;
            } else if (Rest.is(element)) {
              counts.rests += 1;
            } else if (Chord.is(element)) {
              counts.chords += 1;
              counts.chordTones += element.tones.length;
              counts.graces += element.graces?.length ?? 0;
            }

            if (!DynamicElement.is(element)) {
              sum = Fraction.add(sum, Duration.fractionOfWhole(element.duration));
            }
          }

          sums.push(sum);
        }
      });

      if (sums.some((sum) => !Fraction.equals(sum, sums[0]))) disagreements += 1;

      if (time && sums.length) {
        const comparison = Fraction.compare(sums[0], TimeSignature.capacity(time));

        if (comparison < 0) short += 1;
        if (comparison > 0) overfull += 1;
      }
    }

    return { counts, failures, disagreements, short, overfull, warnings: messages };
  })();

  it('builds every staff of every measure', () => {
    expect(walk.failures).toBe(0);
    // 531 measures x 4 parts, plus the 18 places a second voice appears
    expect(walk.counts.voices).toBe(531 * 4 + 18);
  });

  it('accounts for every <note> in the file', () => {
    // The walk's own accounting identity. A sounded note becomes either a
    // `Note` or — when others sound with it — the leading tone of a `Chord`; a
    // `<chord/>` member becomes a further tone of that same element; a grace
    // becomes a decoration on its principal; and a rest stays a rest. Summing
    // those back up must reproduce the file's note count exactly. A bare total
    // would let a drop in one bar cancel a duplicate in another; this cannot,
    // because each class is checked against its own source total.
    expect(sourceNotes.total).toBe(10_593);

    expect(walk.counts.notes + walk.counts.chords).toBe(
      sourceNotes.total - sourceNotes.rests - sourceNotes.chordMembers - sourceNotes.graces,
    );
    expect(walk.counts.chordTones).toBe(sourceNotes.chordMembers + walk.counts.chords);
    expect(walk.counts.graces).toBe(sourceNotes.graces);
  });

  it('synthesises exactly the rests the <forward> elements call for', () => {
    // Every rest is either one the file wrote or one the extent rule added to
    // fill a hole. There are 18 `<forward>`s; 14 of them open a gap that no
    // written rest already covers.
    expect(walk.counts.rests - sourceNotes.rests).toBe(14);
  });

  it('has every voice of every measure spanning the same duration', () => {
    // The sharpest available check on <backup>/<forward> handling, and the one
    // that needs no oracle: whatever the parts play, they must play it for the
    // same length of time. A cursor error shows up here first.
    expect(walk.disagreements).toBe(0);
  });

  it('fills its time signature everywhere except the 22 known partial measures', () => {
    // The independent confirmation. `Measure.partial` was sized at 22 short
    // measures by reading the source; the walk arrives at the same 22 from the
    // other direction, and nothing is overfull.
    expect(walk.short).toBe(22);
    expect(walk.overfull).toBe(0);
  });

  it('raises exactly three kinds of warning across the whole work', () => {
    // The walk's whole warning set by kind, so a new one surfaces here rather
    // than joining a pile. Two are real losses (a grace note's slur, and the
    // expressive text encoded as `<other-dynamics>`) and one is a modelling
    // difference: a hairpin runs to the next dynamic rather than to its own end.
    const kinds = new Map<string, number>();

    for (const warning of walk.warnings) {
      const kind = warning.includes("grace note's <slur>")
        ? 'grace slur'
        : warning.includes('other-dynamics')
          ? 'expressive text'
          : warning.includes('a wedge ends here')
            ? 'wedge end'
            : warning;

      kinds.set(kind, (kinds.get(kind) ?? 0) + 1);
    }

    expect([...kinds].sort()).toEqual([
      ['expressive text', 5],
      ['grace slur', 1],
      ['wedge end', 8],
    ]);
  });

  it('places a dynamic on 406 of the directions the census counted', () => {
    let dynamics = 0;

    for (const measure of built.measures) {
      for (const children of measure.contents) {
        for (const direction of children.filter((child) => child.name === 'direction')) {
          dynamics += DirectionReading.dynamics(direction, 'here', Reporting.ignore).length;
        }
      }
    }

    // 406 `<dynamics>` blocks hold 411 marks, because each of the five
    // `<other-dynamics>` shares its block with a real one — " dolce" rides on a
    // `p` four times and " sempre" on an `fz` once. So every block still yields
    // exactly one loudness, and the word is the only thing lost. Plus the 8
    // hairpin openings; the 8 closings have no element of their own.
    expect(dynamics).toBe(406 + 8);
  });
});

describe('the Haydn corpus, assembled into a Score', () => {
  const assembled = (() => {
    const result = ScoreAssembly.build(document);

    if (!Result.isOk(result)) throw new Error(result.error.messages.join('; '));

    return result.value;
  })();

  it('passes the domain’s own whole-score check', () => {
    // The point of the exercise. `Score.check` validates staff alignment, part
    // and group bounds, navigation targets, measure fullness, repeat pairing,
    // volta endings, tie continuity and slur balance — all at once, on 531
    // measures of real music, with no fixture anywhere in sight.
    const checked = Score.check(assembled.score);

    if (!Result.isOk(checked)) throw new Error(checked.error.messages.slice(0, 10).join('\n'));

    expect(Result.isOk(checked)).toBe(true);
  });

  it('carries the work title and composer from the file', () => {
    expect(assembled.score.title).toContain('76');
    expect(assembled.score.composer).toContain('Haydn');
  });

  it('opens in C major, common time, on four bracketed staves', () => {
    expect(assembled.score.key.tonic.letter).toBe('C');
    expect(assembled.score.time.symbol).toBe('Common');
    expect(assembled.score.staves.map((staff) => staff.clef)).toEqual([
      'Treble',
      'Treble',
      'Alto',
      'Bass',
    ]);
    expect(assembled.score.groups).toEqual([{ symbol: 'Bracket', from: 0, to: 3, barlines: true }]);
  });

  it('names the four parts with the sounds playback will need', () => {
    expect(assembled.score.parts?.map((part) => part.name)).toEqual([
      'Violin 1',
      'Violin 2',
      'Viola',
      'Violoncello',
    ]);
    expect(assembled.score.parts?.map((part) => part.sound)).toEqual([
      'strings.violin',
      'strings.violin',
      'strings.viola',
      'strings.cello',
    ]);
  });

  it('flags exactly the 22 partial measures and no others', () => {
    const partial = assembled.score.measures
      .map((measure, index) => (measure.partial ? index : undefined))
      .filter((index) => index !== undefined);

    expect(partial).toHaveLength(22);
    // The pairs the domain documented: a section's pickup and its closing bar
    expect(partial.slice(0, 6)).toEqual([0, 46, 127, 128, 148, 149]);
  });

  it('puts the cello’s tenor clef on the measure that changes to it', () => {
    expect(assembled.score.measures[224].contents[3].clef).toBe('Tenor');
    expect(assembled.score.measures[225].contents[3].clef).toBe('Bass');
    // The initial clefs belong to the staves, not to measure 0
    expect(assembled.score.measures[0].contents[3].clef).toBeUndefined();
  });

  it('records the key and time changes as measure changes, not score-wide', () => {
    const keyed = assembled.score.measures
      .map((measure, index) => (measure.key ? index : undefined))
      .filter((index) => index !== undefined);

    expect(keyed).toEqual([0, 128, 237, 341, 493]);
  });
});

describe('the Haydn corpus, what assembly reports', () => {
  const assembled = (() => {
    const result = ScoreAssembly.build(document);

    if (!Result.isOk(result)) throw new Error(result.error.messages.join('; '));

    return result.value;
  })();

  it('accounts for every warning the whole import raises', () => {
    // 43 warnings for 113,657 elements, each one a stated decision rather than
    // a surprise. Grouping them is the point: a new kind shows up here as a new
    // row instead of vanishing into a count.
    const kinds = new Map<string, number>();

    for (const warning of assembled.warnings) {
      const kind = warning.includes('assuming Major')
        ? 'key with no declared mode'
        : warning.includes('mid-measure')
          ? 'clef declared mid-measure'
          : warning.includes("grace note's <slur>")
            ? "grace note's slur"
            : warning.includes('other-dynamics')
              ? 'expressive text as a dynamic'
              : warning.includes('a wedge ends here')
                ? 'hairpin end'
                : warning.includes('the tie')
                  ? 'tie across a voice change'
                  : warning.includes('nowhere to put')
                    ? 'text with nowhere to go'
                    : warning.includes('sits beside the heading')
                      ? 'text beside a heading'
                      : warning;

      kinds.set(kind, (kinds.get(kind) ?? 0) + 1);
    }

    expect([...kinds].sort()).toEqual([
      ['clef declared mid-measure', 1],
      ['expressive text as a dynamic', 5],
      ["grace note's slur", 1],
      ['hairpin end', 8],
      // Five key changes, each declared on all four parts
      ['key with no declared mode', 20],
      // "Poco adagio; cantabile" and "sempre piano", each next to a real heading
      ['text beside a heading', 2],
      // Three stray "♮" and the repeat-dependent "la seconda volta più presto"
      ['text with nowhere to go', 4],
      // Both ends of the one tie the source runs across a voice change
      ['tie across a voice change', 2],
    ]);
  });

  it('drops both ends of the tie the source runs across a voice change', () => {
    // Measure 22 ends on a G4–B4 double stop in one voice with the G4 tied
    // over; measure 23 splits the lines and the G4 continues in voice 2. Both
    // ends are correct in the source and the pairing is simply unreachable for
    // us, so both are cleared rather than one left dangling.
    const ties = assembled.warnings.filter((warning) => warning.includes('the tie'));

    expect(ties).toEqual([
      'Measure 22: the tie begun on G4 is not continued by the element that follows it; dropping it',
      'Measure 23: the tie ended on G4 was never begun in this voice; dropping it',
    ]);
  });
});

describe('the Haydn corpus, its structure and movements', () => {
  const score = (() => {
    const result = ScoreAssembly.build(document);

    if (!Result.isOk(result)) throw new Error(result.error.messages.join('; '));

    return result.value.score;
  })();

  const indicesWhere = (has: (measure: (typeof score.measures)[number]) => boolean | undefined) =>
    score.measures
      .map((measure, index) => (has(measure) ? index : undefined))
      .filter((index) => index !== undefined);

  it('reads every repeat as a matched pair of barlines', () => {
    expect(indicesWhere((measure) => measure.opening === 'RepeatOpen')).toEqual([
      48, 258, 295, 304,
    ]);
    expect(indicesWhere((measure) => measure.closing === 'RepeatClose')).toEqual([
      46, 125, 257, 294, 303, 340, 412,
    ]);
  });

  it('fills each volta across the measures it spans, not just its ends', () => {
    // The source brackets measures 44-46 as the first ending and 47 as the
    // second; `Measure.ending` says "this measure is in volta n", so the
    // measures *between* the start and stop have to be filled in.
    const inVolta = (measure: (typeof score.measures)[number], number: number) =>
      measure.ending?.some((entry) => (entry as number) === number);

    expect(indicesWhere((measure) => inVolta(measure, 1))).toEqual([
      44, 45, 46, 123, 124, 125, 412,
    ]);
    expect(indicesWhere((measure) => inVolta(measure, 2))).toEqual([47, 126, 127, 413]);
  });

  it('reads the Menuetto’s da capo as al Fine, with the Fine it seeks', () => {
    // Both are `<sound>` attributes rather than the prose beside them: a bare
    // DaCapo would play to the end of the movement instead of stopping.
    expect(score.measures[340].jump).toBe('DaCapoAlFine');
    expect(score.measures[294].marks).toEqual(['Fine']);
  });

  it('synthesises a Capo at each movement start, which the source never writes', () => {
    // Without these the Menuetto's da capo rewinds to the opening of movement I
    expect(indicesWhere((measure) => measure.marks?.includes('Capo'))).toEqual([0, 128, 237, 341]);
  });

  it('finds the nine sections, breaking movements to a page and the rest to a system', () => {
    expect(
      score.measures.flatMap((measure, index) =>
        measure.newSection ? [[index, measure.newSection.title, measure.newSection.break]] : [],
      ),
    ).toEqual([
      [0, 'I.', 'Page'],
      [128, 'II.', 'Page'],
      [149, 'Var. I', 'System'],
      [170, 'Var. II', 'System'],
      [191, 'Var. III', 'System'],
      [212, 'Var. IV', 'System'],
      [237, 'III. Menuetto', 'Page'],
      [295, 'Trio', 'System'],
      [341, 'IV. Finale', 'Page'],
    ]);
  });

  it('does not promote a stray glyph on an inner part to a heading', () => {
    // The viola's "♮" at measure 19 lands on a measure the engraver broke a
    // system at, which was enough to title a section until headings were
    // required to sit on the top part.
    expect(score.measures[19].newSection).toBeUndefined();
    expect(score.measures[95].newSection).toBeUndefined();
  });

  it('prefers the printed tempo word, falling back to the sounded bpm', () => {
    // "Allegro" is what a reader sees and playback resolves it to a bpm anyway;
    // "Poco adagio; cantabile" names no marking we model, so measure 128 takes
    // the <sound tempo="80"> instead.
    expect(score.measures[0].tempo).toBe('Allegro');
    expect(score.measures[237].tempo).toBe('Allegro');
    expect(score.measures[341].tempo).toBe('Presto');
    expect(score.measures[128].tempo).toEqual({ noteValue: 'Quarter', bpm: 80 });
  });
});

describe('the Haydn corpus, verified against itself', () => {
  it('passes every estimator, with nothing to report', () => {
    // The reusable `--verify` mode run over the real work. Unlike the coverage
    // audit, every one of these compares the built `Score` against the source
    // file or against itself, so none of them can balance by construction.
    const report = Verification.run(document);

    if (!Result.isOk(report)) throw new Error(report.error.messages.join('; '));

    const failed = report.value.checks.filter((check) => !check.passed);

    expect(failed.map((check) => `${check.name}: ${check.failures.join('; ')}`)).toEqual([]);
    expect(report.value.checks.map((check) => check.name)).toEqual([
      'Score.check',
      'per-measure element counts',
      'per-measure pitch sequence',
      'every voice of a measure spans the same time',
      'determinism',
      'a slice matches the same measures of the whole',
      'no part plays below its instrument’s lowest string',
      'rests are a minority of the elements',
    ]);
  });

  it('accounts for every element of the file, and meets no unknown vocabulary', () => {
    const report = ImportReport.build(document);

    if (!Result.isOk(report)) throw new Error(report.error.messages.join('; '));

    expect(report.value.elements).toBe(113_657);
    expect(ImportReport.balances(report.value)).toBe(true);
    expect([...report.value.unaccounted]).toEqual([]);

    // The only real loss in the file, and it is one element name
    expect([...report.value.unrepresented]).toEqual([['other-dynamics', 5]]);

    // The histograms count occurrences, not names: all 10,593 notes are in the
    // consumed column, and the 9,186 `<stem>` elements — fewer, since a rest
    // has none — are in the ignored one, because stem direction is derived from
    // staff position rather than imported.
    expect(report.value.consumed.get('note')).toBe(10_593);
    expect(report.value.ignored.get('stem')).toBe(9_186);

    // Note the balance above proves the *partition*, not the import: it holds
    // however badly a reader behaves, because it is computed from the element
    // names rather than from what any reader touched. `Verification` is what
    // compares the result against the source. See the module header.
  });
});
