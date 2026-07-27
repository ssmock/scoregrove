import { describe, expect, it } from 'vitest';
import { Clef } from '@scoregrove/domain/Clef';
import { Result } from '@scoregrove/domain/Result';
import { PartwiseToTimewise, type TimewiseScore } from '../src/PartwiseToTimewise';
import { XmlReading } from '../src/XmlReading';

const build = (xml: string): Result<TimewiseScore> => {
  const document = XmlReading.parse(xml);

  if (!Result.isOk(document)) throw new Error(document.error.messages.join('; '));

  return PartwiseToTimewise.build(document.value);
};

const expectOk = (xml: string): TimewiseScore => {
  const result = build(xml);

  if (!Result.isOk(result)) throw new Error(`expected ok: ${result.error.messages.join('; ')}`);

  return result.value;
};

const expectInvalid = (xml: string) => {
  const result = build(xml);

  if (Result.isOk(result)) throw new Error('expected invalid');

  return result.error;
};

/** A score of `parts`, each an array of measure bodies */
const score = (parts: { id: string; name: string; measures: string[] }[]) => `
  <score-partwise version="4.0">
    <part-list>
      ${parts.map((p) => `<score-part id="${p.id}"><part-name>${p.name}</part-name></score-part>`).join('')}
    </part-list>
    ${parts
      .map(
        (p) =>
          `<part id="${p.id}">${p.measures
            .map((body, i) => `<measure number="${i + 1}">${body}</measure>`)
            .join('')}</part>`,
      )
      .join('')}
  </score-partwise>`;

const attributes = (inner: string) => `<attributes>${inner}</attributes>`;
const key = (fifths: number) => `<key><fifths>${fifths}</fifths></key>`;
const time = (beats: number, beatType: number, symbol?: string) =>
  `<time${symbol ? ` symbol="${symbol}"` : ''}><beats>${beats}</beats><beat-type>${beatType}</beat-type></time>`;
const note = '<note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration></note>';

describe('PartwiseToTimewise.build', () => {
  it('aligns the parts into one measure grid', () => {
    const built = expectOk(
      score([
        { id: 'P1', name: 'Violin', measures: [note, note, note] },
        { id: 'P2', name: 'Cello', measures: [note, note, note] },
      ]),
    );

    expect(built.measures).toHaveLength(3);
    expect(built.measures[0].contents).toHaveLength(2);
    expect(built.measures.map((m) => m.index)).toEqual([0, 1, 2]);
  });

  it('reads each part’s identity from the part list', () => {
    const built = expectOk(`
      <score-partwise version="4.0">
        <part-list>
          <score-part id="P1">
            <part-name>Violin 1</part-name>
            <part-abbreviation>Vln. I</part-abbreviation>
            <score-instrument id="P1-I1"><instrument-sound>strings.violin</instrument-sound></score-instrument>
          </score-part>
        </part-list>
        <part id="P1"><measure number="1">${note}</measure></part>
      </score-partwise>`);

    expect(built.parts[0]).toEqual({
      id: 'P1',
      name: 'Violin 1',
      abbreviation: 'Vln. I',
      instrumentSound: 'strings.violin',
    });
  });

  it('carries the source bar label without treating it as an index', () => {
    const built = expectOk(`
      <score-partwise version="4.0">
        <part-list><score-part id="P1"><part-name>V</part-name></score-part></part-list>
        <part id="P1"><measure number="0">${note}</measure><measure number="X1">${note}</measure></part>
      </score-partwise>`);

    expect(built.measures.map((m) => m.label)).toEqual(['0', 'X1']);
    expect(built.measures.map((m) => m.index)).toEqual([0, 1]);
  });

  it('hands on each measure’s children in document order, reading no notes', () => {
    const built = expectOk(
      score([
        {
          id: 'P1',
          name: 'V',
          measures: [`${note}<backup><duration>4</duration></backup>${note}`],
        },
      ]),
    );

    expect(built.measures[0].contents[0].map((e) => e.name)).toEqual(['note', 'backup', 'note']);
  });
});

describe('PartwiseToTimewise score-wide reconciliation', () => {
  it('takes an attribute every part agrees on, without complaint', () => {
    const both = attributes(key(1) + time(3, 4));
    const built = expectOk(
      score([
        { id: 'P1', name: 'Violin', measures: [both + note] },
        { id: 'P2', name: 'Cello', measures: [both + note] },
      ]),
    );

    expect(built.measures[0].key).toEqual({ fifths: 1 });
    expect(built.measures[0].time?.beats).toBe(3);
    expect(built.warnings.filter((w) => w.includes('disagree'))).toHaveLength(0);
  });

  it('takes an attribute only one part declares — the volta case', () => {
    // Voltas, Fine and the da capo appear on Violin I alone in the corpus.
    // Reading score-wide data from "part 1" happens to work there; demanding
    // agreement would not. Only a union does both.
    const built = expectOk(
      score([
        { id: 'P1', name: 'Violin', measures: [note] },
        { id: 'P2', name: 'Cello', measures: [attributes(key(2)) + note] },
      ]),
    );

    expect(built.measures[0].key).toEqual({ fifths: 2 });
    expect(built.warnings.filter((w) => w.includes('disagree'))).toHaveLength(0);
  });

  it('reports a genuine disagreement and names the parts, taking the first', () => {
    const built = expectOk(
      score([
        { id: 'P1', name: 'Violin', measures: [attributes(key(1)) + note] },
        { id: 'P2', name: 'Cello', measures: [attributes(key(-2)) + note] },
      ]),
    );

    const conflict = built.warnings.find((w) => w.includes('disagree'));

    expect(conflict).toContain('Violin');
    expect(conflict).toContain('Cello');
    expect(built.measures[0].key).toEqual({ fifths: 1 });
  });

  it('tracks divisions per part rather than reconciling it', () => {
    // Divisions never reaches a Score — it only converts durations — and
    // MusicXML lets parts differ, so treating it like key or time would be
    // wrong however similar it looks.
    const built = expectOk(
      score([
        {
          id: 'P1',
          name: 'Violin',
          measures: [attributes('<divisions>24</divisions>') + note, note],
        },
        {
          id: 'P2',
          name: 'Cello',
          measures: [attributes('<divisions>8</divisions>') + note, note],
        },
      ]),
    );

    expect(built.measures[0].divisions).toEqual([24, 8]);
    expect(built.warnings.filter((w) => w.includes('disagree'))).toHaveLength(0);
  });

  it('carries divisions forward into later measures that redeclare nothing', () => {
    const built = expectOk(
      score([
        { id: 'P1', name: 'V', measures: [attributes('<divisions>24</divisions>') + note, note] },
      ]),
    );

    expect(built.measures[1].divisions).toEqual([24]);
  });

  it('carries a key with no mode without inventing one', () => {
    // Three flats is E♭ major or C minor, and this file does not say. It used
    // to assume Major and warn, which named the Haydn finale — in C minor —
    // as E♭ major: right on the page, wrong in the model.
    const built = expectOk(
      score([{ id: 'P1', name: 'V', measures: [attributes(key(-3)) + note] }]),
    );

    expect(built.measures[0].key).toEqual({ fifths: -3 });
    expect(built.warnings.some((w) => w.includes('mode'))).toBe(false);
  });

  it('keeps the common and cut time symbols', () => {
    const built = expectOk(
      score([{ id: 'P1', name: 'V', measures: [attributes(time(2, 2, 'cut')) + note] }]),
    );

    expect(built.measures[0].time?.symbol).toBe('CutCommon');
  });
});

describe('PartwiseToTimewise clefs', () => {
  it('reads a clef per part, including tenor', () => {
    const built = expectOk(
      score([
        {
          id: 'P1',
          name: 'Violin',
          measures: [attributes('<clef><sign>G</sign><line>2</line></clef>') + note],
        },
        {
          id: 'P2',
          name: 'Cello',
          measures: [attributes('<clef><sign>C</sign><line>4</line></clef>') + note],
        },
      ]),
    );

    expect(built.measures[0].clefs).toEqual([Clef.Treble, Clef.Tenor]);
  });

  it('applies a mid-measure clef at the measure start and reports it', () => {
    // The cello does this once in the corpus: a clef change belongs where the
    // register changes, not at a barline. StaffContent.clef takes effect at the
    // measure start, so the notes still sound right and are merely drawn with
    // more ledger lines than the source intended.
    const built = expectOk(
      score([
        {
          id: 'P1',
          name: 'Cello',
          measures: [`${note}${attributes('<clef><sign>F</sign><line>4</line></clef>')}${note}`],
        },
      ]),
    );

    expect(built.measures[0].clefs).toEqual([Clef.Bass]);
    expect(built.warnings.some((w) => w.includes('mid-measure'))).toBe(true);
  });

  it('reports an unsupported clef rather than guessing at one', () => {
    const built = expectOk(
      score([
        {
          id: 'P1',
          name: 'V',
          measures: [attributes('<clef><sign>TAB</sign><line>5</line></clef>') + note],
        },
      ]),
    );

    expect(built.measures[0].clefs).toEqual([undefined]);
    expect(built.warnings.some((w) => w.includes('Unsupported clef'))).toBe(true);
  });
});

describe('PartwiseToTimewise alignment failures', () => {
  it('refuses parts with different measure counts', () => {
    const error = expectInvalid(
      score([
        { id: 'P1', name: 'Violin', measures: [note, note] },
        { id: 'P2', name: 'Cello', measures: [note] },
      ]),
    );

    expect(error.messages[0]).toContain('different measure counts');
  });

  it('refuses a score with no parts', () => {
    const error = expectInvalid('<score-partwise version="4.0"><part-list/></score-partwise>');

    expect(error.messages[0]).toContain('no <part> elements');
  });

  it('refuses a part with no measures', () => {
    const error = expectInvalid(
      '<score-partwise version="4.0"><part-list/><part id="P1"/></score-partwise>',
    );

    expect(error.messages[0]).toContain('no measures');
  });

  it('warns when the part list and the parts do not correspond', () => {
    const built = expectOk(`
      <score-partwise version="4.0">
        <part-list><score-part id="P1"><part-name>V</part-name></score-part></part-list>
        <part id="P1"><measure number="1">${note}</measure></part>
        <part id="P2"><measure number="1">${note}</measure></part>
      </score-partwise>`);

    expect(built.warnings.some((w) => w.includes('matching them by position'))).toBe(true);
  });
});
