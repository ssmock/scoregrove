import { describe, expect, it } from 'vitest';
import { DynamicChange, DynamicMark } from '@scoregrove/domain/Dynamic';
import { DynamicElement, Note, Rest } from '@scoregrove/domain/MeasureElement';
import { Result } from '@scoregrove/domain/Result';
import { DirectionReading } from '../src/DirectionReading';
import { Reporting } from '../src/Reporting';
import { VoiceBuilding } from '../src/VoiceBuilding';
import { XmlReading } from '../src/XmlReading';

const measureChildren = (inner: string) => {
  const document = XmlReading.parse(
    `<score-partwise version="4.0"><part id="P1"><measure number="1">${inner}</measure></part></score-partwise>`,
  );

  if (!Result.isOk(document)) throw new Error(document.error.messages.join('; '));

  const part = XmlReading.childNamed(document.value.root, 'part')!;

  return XmlReading.elements(XmlReading.childNamed(part, 'measure')!);
};

const readDirection = (inner: string) => {
  const { warn, messages } = Reporting.collector();
  const direction = measureChildren(inner)[0];

  return { dynamics: DirectionReading.dynamics(direction, 'm1', warn), warnings: messages };
};

const direction = (typeInner: string) =>
  `<direction placement="below"><direction-type>${typeInner}</direction-type></direction>`;

describe('DirectionReading', () => {
  it('reads the marks this corpus uses', () => {
    expect(readDirection(direction('<dynamics><fz/></dynamics>')).dynamics).toEqual([
      DynamicMark.Forzando,
    ]);
    expect(readDirection(direction('<dynamics><p/></dynamics>')).dynamics).toEqual([
      DynamicMark.Piano,
    ]);
    expect(readDirection(direction('<dynamics><pp/></dynamics>')).dynamics).toEqual([
      DynamicMark.Pianissimo,
    ]);
  });

  it('keeps sfz and fz distinct, as the domain does', () => {
    expect(readDirection(direction('<dynamics><sfz/></dynamics>')).dynamics).toEqual([
      DynamicMark.Sforzando,
    ]);
    expect(readDirection(direction('<dynamics><fz/></dynamics>')).dynamics).toEqual([
      DynamicMark.Forzando,
    ]);
  });

  it('opens a hairpin but cannot close one', () => {
    const opened = readDirection(direction('<wedge type="crescendo"/>'));

    expect(opened.dynamics).toEqual([DynamicChange.Crescendo]);
    expect(opened.warnings).toEqual([]);

    const closed = readDirection(direction('<wedge type="stop"/>'));

    expect(closed.dynamics).toEqual([]);
    expect(closed.warnings).toEqual([
      'm1: a wedge ends here, which is not representable; the change runs to the next dynamic',
    ]);
  });

  it('keeps the loudness and reports the word when a block carries both', () => {
    // The corpus shape: `<p/>` alongside `<other-dynamics> dolce</other-dynamics>`
    const { dynamics, warnings } = readDirection(
      direction('<dynamics><p/><other-dynamics> dolce</other-dynamics></dynamics>'),
    );

    expect(dynamics).toEqual([DynamicMark.Piano]);
    expect(warnings).toEqual([
      'm1: <other-dynamics>dolce</other-dynamics> is expressive text, not a loudness; dropping it',
    ]);
  });

  it('leaves <words> to the readers that own them, without comment', () => {
    // `StructureReading` takes the tempo marks and `SectionAndCapoSynthesis`
    // the headings; both report what they cannot use, so warning here as well
    // would double-count text that is in fact read.
    const { dynamics, warnings } = readDirection(direction('<words>Allegro</words>'));

    expect(dynamics).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it('still reports a direction-type nobody reads', () => {
    const { warnings } = readDirection(direction('<rehearsal>A</rehearsal>'));

    expect(warnings).toEqual(['m1: <rehearsal> in a <direction> is not read yet']);
  });
});

describe('DirectionReading, placed by the walk', () => {
  const build = (inner: string) => {
    const { warn, messages } = Reporting.collector();
    const result = VoiceBuilding.staffContent(measureChildren(inner), 24, 'm1', warn);

    if (!Result.isOk(result)) throw new Error(result.error.messages.join('; '));

    return { content: result.value, warnings: messages };
  };

  it('places a dynamic before the note it takes effect at', () => {
    const { content } = build(
      direction('<dynamics><p/></dynamics>') +
        `<note><pitch><step>C</step><octave>5</octave></pitch><duration>96</duration><type>whole</type></note>`,
    );

    const [first, second] = content.voices[0].elements;

    expect(DynamicElement.is(first) && first.dynamic).toBe(DynamicMark.Piano);
    expect(Note.is(second)).toBe(true);
  });

  it('puts a dynamic in the voice being written, not always the first', () => {
    const { content } = build(
      `<note><pitch><step>C</step><octave>5</octave></pitch><duration>96</duration><type>whole</type><voice>1</voice></note>` +
        `<backup><duration>96</duration></backup>` +
        direction('<dynamics><ff/></dynamics>') +
        `<note><rest/><duration>96</duration><type>whole</type><voice>2</voice></note>`,
    );

    expect(content.voices[0].elements.some(DynamicElement.is)).toBe(false);
    expect(content.voices[1].elements.some(DynamicElement.is)).toBe(true);
  });

  it('lands a mid-measure dynamic after the rests that fill the time before it', () => {
    // The dynamic arrives at the cursor, so the voice must first be brought up
    // to that point — otherwise the mark would precede music that sounds earlier
    const { content } = build(
      `<note><pitch><step>C</step><octave>5</octave></pitch><duration>96</duration><type>whole</type><voice>1</voice></note>` +
        `<backup><duration>96</duration></backup>` +
        `<forward><duration>48</duration></forward>` +
        direction('<dynamics><f/></dynamics>') +
        `<note><pitch><step>A</step><octave>4</octave></pitch><duration>48</duration><type>half</type><voice>2</voice></note>`,
    );

    const second = content.voices[1].elements;

    expect(Rest.is(second[0])).toBe(true);
    expect(DynamicElement.is(second[1])).toBe(true);
    expect(Note.is(second[2])).toBe(true);
  });

  it('does not let a dynamic count towards the measure being full', () => {
    // `Measure.check` skips dynamics; the walk must not pad around them either
    const { content, warnings } = build(
      direction('<dynamics><p/></dynamics>') +
        `<note><pitch><step>C</step><octave>5</octave></pitch><duration>96</duration><type>whole</type></note>`,
    );

    expect(content.voices[0].elements).toHaveLength(2);
    expect(warnings).toEqual([]);
  });
});
