import { describe, expect, it } from 'vitest';
import { Duration, NoteValue } from '@scoregrove/domain/Duration';
import { Chord, Note, Rest } from '@scoregrove/domain/MeasureElement';
import { Result } from '@scoregrove/domain/Result';
import { Reporting } from '../src/Reporting';
import { VoiceBuilding } from '../src/VoiceBuilding';
import { XmlReading } from '../src/XmlReading';

/**
 * Focused fixtures for the walk itself. The corpus exercises it at scale in
 * `Corpus.test.ts`; these pin the cursor arithmetic, where a hand-written
 * measure can state exactly one thing at a time.
 */

/** Wraps measure children in a parsable document and hands back the children */
const childrenOf = (inner: string) => {
  const document = XmlReading.parse(
    `<score-partwise version="4.0"><part id="P1"><measure number="1">${inner}</measure></part></score-partwise>`,
  );

  if (!Result.isOk(document)) throw new Error(document.error.messages.join('; '));

  const part = XmlReading.childNamed(document.value.root, 'part')!;
  const measure = XmlReading.childNamed(part, 'measure')!;

  return XmlReading.elements(measure);
};

const note = (step: string, octave: number, type: string, duration: number, extra = '') =>
  `<note><pitch><step>${step}</step><octave>${octave}</octave></pitch>` +
  `<duration>${duration}</duration><type>${type}</type>${extra}</note>`;

const rest = (type: string, duration: number, voice = '1') =>
  `<note><rest/><duration>${duration}</duration><type>${type}</type><voice>${voice}</voice></note>`;

const build = (inner: string, divisions = 24) => {
  const collector = Reporting.collector();
  const result = VoiceBuilding.staffContent(childrenOf(inner), divisions, 'm1', collector.warn);

  return { result, warnings: collector.messages };
};

const expectOk = (inner: string, divisions = 24) => {
  const { result, warnings } = build(inner, divisions);

  if (!Result.isOk(result)) throw new Error(result.error.messages.join('; '));

  return { content: result.value, warnings };
};

describe('VoiceBuilding', () => {
  it('reads a single voice in document order', () => {
    const { content, warnings } = expectOk(
      note('C', 5, 'quarter', 24) + note('D', 5, 'half', 48) + rest('quarter', 24),
    );

    expect(content.voices).toHaveLength(1);
    expect(content.voices[0].elements.map((element) => element.kind)).toEqual([
      'note',
      'note',
      'rest',
    ]);
    expect(warnings).toEqual([]);
  });

  it('groups <chord/> notes into one element without advancing the cursor', () => {
    const { content, warnings } = expectOk(
      note('C', 5, 'half', 48) +
        note('E', 5, 'half', 48, '<chord/>') +
        note('G', 5, 'half', 48, '<chord/>') +
        note('B', 4, 'half', 48),
    );

    const [first, second] = content.voices[0].elements;

    expect(Chord.is(first)).toBe(true);
    expect(Chord.is(first) && first.tones).toHaveLength(3);
    expect(Note.is(second)).toBe(true);
    expect(warnings).toEqual([]);
  });

  it('separates voices and does not interleave them', () => {
    const { content } = expectOk(
      `<note><pitch><step>C</step><octave>5</octave></pitch><duration>96</duration><type>whole</type><voice>1</voice></note>` +
        `<backup><duration>96</duration></backup>` +
        rest('whole', 96, '2'),
    );

    expect(content.voices).toHaveLength(2);
    expect(content.voices[0].elements).toHaveLength(1);
    expect(content.voices[1].elements).toHaveLength(1);
    expect(Note.is(content.voices[0].elements[0])).toBe(true);
    expect(Rest.is(content.voices[1].elements[0])).toBe(true);
  });

  it('pads a voice that ends early to the measure extent — the trailing <forward>', () => {
    // Exactly the corpus's shape at measure 131: voice 1 fills the bar, voice 2
    // runs short and states the remainder as a <forward> rather than a rest.
    const { content, warnings } = expectOk(
      `<note><pitch><step>C</step><octave>5</octave></pitch><duration>96</duration><type>whole</type><voice>1</voice></note>` +
        `<backup><duration>96</duration></backup>` +
        rest('half', 48, '2') +
        `<note><pitch><step>A</step><octave>4</octave></pitch><duration>24</duration><type>quarter</type><voice>2</voice></note>` +
        `<forward><duration>24</duration></forward>`,
    );

    const second = content.voices[1].elements;

    expect(second).toHaveLength(3);
    expect(Rest.is(second[2])).toBe(true);
    expect(
      Rest.is(second[2]) && Duration.equals(second[2].duration, Duration.of(NoteValue.Quarter)),
    ).toBe(true);
    expect(warnings).toEqual([]);
  });

  it('fills a leading gap so a late-entering voice keeps its place', () => {
    const { content } = expectOk(
      `<note><pitch><step>C</step><octave>5</octave></pitch><duration>96</duration><type>whole</type><voice>1</voice></note>` +
        `<backup><duration>96</duration></backup>` +
        `<forward><duration>48</duration></forward>` +
        `<note><pitch><step>A</step><octave>4</octave></pitch><duration>48</duration><type>half</type><voice>2</voice></note>`,
    );

    const second = content.voices[1].elements;

    expect(second).toHaveLength(2);
    expect(Rest.is(second[0])).toBe(true);
    expect(Note.is(second[1])).toBe(true);
  });

  it('prefers a single dotted rest where one spans the gap exactly', () => {
    // 36 divisions at 24 per quarter is 3/8 of a whole — one dotted quarter,
    // not a quarter plus an eighth, because the candidates are tried longest first
    const { content, warnings } = expectOk(
      `<note><pitch><step>C</step><octave>5</octave></pitch><duration>96</duration><type>whole</type><voice>1</voice></note>` +
        `<backup><duration>96</duration></backup>` +
        `<forward><duration>36</duration></forward>` +
        `<note><pitch><step>A</step><octave>4</octave></pitch><duration>48</duration><type>half</type><voice>2</voice></note>` +
        `<note><pitch><step>B</step><octave>4</octave></pitch><duration>12</duration><type>eighth</type><voice>2</voice></note>`,
    );

    const rests = content.voices[1].elements.filter(Rest.is);

    expect(rests).toHaveLength(1);
    expect(Duration.equals(rests[0].duration, Duration.of(NoteValue.Quarter, { dots: 1 }))).toBe(
      true,
    );
    expect(warnings).toEqual([]);
  });

  it('decomposes a gap no single written value spans', () => {
    // 60 divisions is 5/8 of a whole, which no note value reaches: a half rest
    // then an eighth
    const { content, warnings } = expectOk(
      `<note><pitch><step>C</step><octave>5</octave></pitch><duration>96</duration><type>whole</type><voice>1</voice></note>` +
        `<backup><duration>96</duration></backup>` +
        `<forward><duration>60</duration></forward>` +
        `<note><pitch><step>A</step><octave>4</octave></pitch><duration>36</duration><type>quarter</type><dot/><voice>2</voice></note>`,
    );

    const rests = content.voices[1].elements.filter(Rest.is);

    expect(rests.map((element) => element.duration.noteValue)).toEqual([
      NoteValue.Half,
      NoteValue.Eighth,
    ]);
    expect(warnings).toEqual([]);
  });

  it('orders voices numerically however the file writes them', () => {
    // Voice 2 is written first here, but must not become the upper voice
    const { content } = expectOk(
      rest('whole', 96, '2') +
        `<backup><duration>96</duration></backup>` +
        `<note><pitch><step>C</step><octave>5</octave></pitch><duration>96</duration><type>whole</type><voice>1</voice></note>`,
    );

    expect(content.voices).toHaveLength(2);
    expect(Note.is(content.voices[0].elements[0])).toBe(true);
    expect(Rest.is(content.voices[1].elements[0])).toBe(true);
  });

  it('attaches grace notes to the principal that follows them', () => {
    const { content, warnings } = expectOk(
      `<note><grace slash="yes"/><pitch><step>B</step><octave>4</octave></pitch><type>eighth</type></note>` +
        note('C', 5, 'whole', 96),
    );

    const [element] = content.voices[0].elements;

    expect(Note.is(element) && element.graces).toHaveLength(1);
    expect(warnings).toEqual([]);
  });

  it('reports a grace note with nothing left to decorate', () => {
    const { warnings } = expectOk(
      note('C', 5, 'whole', 96) +
        `<note><grace/><pitch><step>B</step><octave>4</octave></pitch><type>eighth</type></note>`,
    );

    expect(warnings).toEqual(['m1: 1 grace note(s) end the measure with nothing to decorate']);
  });

  it('clamps a <backup> reaching before the measure start, and says so', () => {
    const { warnings } = expectOk(
      note('C', 5, 'quarter', 24) + `<backup><duration>96</duration></backup>` + rest('whole', 96),
    );

    expect(warnings).toContain('m1: a <backup> reaches before the measure start; clamping to it');
  });

  it('refuses a measure with nothing this staff can play', () => {
    const { result } = build('<barline location="right"/>');

    expect(Result.isOk(result)).toBe(false);
  });
});
