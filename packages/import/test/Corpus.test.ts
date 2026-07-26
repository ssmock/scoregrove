import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { Clef } from '@scoregrove/domain/Clef';
import { Result } from '@scoregrove/domain/Result';
import { Duration, NoteValue } from '@scoregrove/domain/Duration';
import type { Pitch } from '@scoregrove/domain/Pitch';
import { DivisionsToDuration } from '../src/DivisionsToDuration';
import { PartwiseToTimewise } from '../src/PartwiseToTimewise';
import { Coverage } from '../src/Coverage';
import { NotationReading } from '../src/NotationReading';
import { PitchReading } from '../src/PitchReading';
import { Reporting } from '../src/Reporting';
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

  it('loses nothing the file contains', () => {
    // The whole point of the exercise: every element name in the corpus is now
    // either carried by the model, pending a module, or dropped by a decision
    // with a reason. Nothing is unrepresentable.
    expect(audit.unrepresented).toEqual([]);
  });

  it('still has work pending, and says which', () => {
    expect(audit.pending).toContain('direction');
    expect(audit.pending).toContain('barline');
    expect(audit.pending).toContain('backup');
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
