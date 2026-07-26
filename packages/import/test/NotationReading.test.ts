import { describe, expect, it } from 'vitest';
import { NoteValue } from '@scoregrove/domain/Duration';
import { TieRole } from '@scoregrove/domain/MeasureElement';
import { Articulation, GraceStyle, Ornament, SlurRole } from '@scoregrove/domain/Notations';
import { Result } from '@scoregrove/domain/Result';
import { NotationReading } from '../src/NotationReading';
import { Reporting } from '../src/Reporting';
import { XmlReading } from '../src/XmlReading';

const noteOf = (inner: string) => {
  const parsed = XmlReading.parse(
    '<score-partwise version="4.0"><part-list/><part id="P1"><measure number="1">' +
      `<note>${inner}</note></measure></part></score-partwise>`,
  );

  if (!Result.isOk(parsed)) throw new Error('bad test XML');

  const part = XmlReading.childNamed(parsed.value.root, 'part')!;

  return XmlReading.childNamed(XmlReading.childNamed(part, 'measure')!, 'note')!;
};

const readNotations = (inner: string) => {
  const { warn, messages } = Reporting.collector();

  return { notations: NotationReading.notations(noteOf(inner), 'here', warn), warnings: messages };
};

const pitch = '<pitch><step>C</step><octave>4</octave></pitch>';

describe('NotationReading.tie', () => {
  it('reads a tie start, stop, and a note that is both', () => {
    expect(NotationReading.tie(noteOf('<tie type="start"/>'))).toBe(TieRole.Begin);
    expect(NotationReading.tie(noteOf('<tie type="stop"/>'))).toBe(TieRole.End);
    expect(NotationReading.tie(noteOf('<tie type="stop"/><tie type="start"/>'))).toBe(TieRole.Both);
  });

  it('leaves an untied note without a role', () => {
    expect(NotationReading.tie(noteOf(pitch))).toBeUndefined();
  });
});

describe('NotationReading.notations', () => {
  it('is empty when the note carries no notations', () => {
    expect(readNotations(pitch).notations).toEqual({});
  });

  it('reads slur roles, including a note that ends one phrase and begins the next', () => {
    expect(
      readNotations('<notations><slur type="start" number="1"/></notations>').notations.slur,
    ).toBe(SlurRole.Begin);

    expect(
      readNotations(
        '<notations><slur type="stop" number="1"/><slur type="start" number="1"/></notations>',
      ).notations.slur,
    ).toBe(SlurRole.Both);
  });

  it('stays quiet about slur numbering when only one slur is open', () => {
    // 1,200 of the corpus's 1,208 slur pairs are number 1 and lose nothing.
    expect(
      readNotations('<notations><slur type="start" number="1"/></notations>').warnings,
    ).toEqual([]);
  });

  it('drops a numbered slur whole rather than half of it', () => {
    // A stray End would be popped off engraving's pairing stack and steal the
    // enclosing slur's endpoint, mis-drawing a slur we could have represented.
    // Losing one slur beats corrupting two.
    const { notations, warnings } = readNotations(
      '<notations><slur type="stop" number="2"/></notations>',
    );

    expect(notations.slur).toBeUndefined();
    expect(warnings[0]).toContain('dropping it whole');
  });

  it('consumes the grace slur’s stop so the principal does not end a slur it never began', () => {
    // Without this the principal carries an End with no Begin, which engraving
    // pops off its pairing stack and charges to the enclosing phrase slur.
    const { warn } = Reporting.collector();
    const note = noteOf('<notations><slur type="stop" number="1"/></notations>');

    expect(
      NotationReading.notations(note, 'here', warn, { endsGraceSlur: true }).slur,
    ).toBeUndefined();
    expect(NotationReading.notations(note, 'here', warn).slur).toBe(SlurRole.End);
  });

  it('still reads a phrase slur ending on the same note as a grace slur', () => {
    const { warn } = Reporting.collector();
    const note = noteOf(
      '<notations><slur type="stop" number="1"/><slur type="stop" number="1"/></notations>',
    );

    expect(NotationReading.notations(note, 'here', warn, { endsGraceSlur: true }).slur).toBe(
      SlurRole.End,
    );
  });

  it('keeps the default-numbered slur when a second one overlaps it', () => {
    const { notations } = readNotations(
      '<notations><slur type="start" number="1"/><slur type="stop" number="2"/></notations>',
    );

    expect(notations.slur).toBe(SlurRole.Begin);
  });

  it('reads a fermata', () => {
    expect(readNotations('<notations><fermata/></notations>').notations.fermata).toBe(true);
  });

  it('reads the articulations the domain models', () => {
    const { notations } = readNotations(
      '<notations><articulations><staccato/><tenuto/></articulations></notations>',
    );

    expect(notations.articulations).toEqual([Articulation.Staccato, Articulation.Tenuto]);
  });

  it('maps strong-accent to marcato', () => {
    const { notations } = readNotations(
      '<notations><articulations><strong-accent/></articulations></notations>',
    );

    expect(notations.articulations).toEqual([Articulation.Marcato]);
  });

  it('reports an articulation the domain has no member for', () => {
    const { notations, warnings } = readNotations(
      '<notations><articulations><staccato/><spiccato/></articulations></notations>',
    );

    expect(notations.articulations).toEqual([Articulation.Staccato]);
    expect(warnings[0]).toContain('spiccato');
  });

  it('reads the ornaments the domain models', () => {
    const { notations, warnings } = readNotations(
      '<notations><ornaments><trill-mark/></ornaments></notations>',
    );

    expect(notations.ornaments).toEqual([Ornament.Trill]);
    expect(warnings).toEqual([]);
  });

  it('reads a turn', () => {
    const { notations } = readNotations('<notations><ornaments><turn/></ornaments></notations>');

    expect(notations.ornaments).toEqual([Ornament.Turn]);
  });

  it('reports an ornament outside the vocabulary rather than dropping it', () => {
    // Mordents and the inverted turn are standard but deliberately deferred
    // until a piece asks; either way the loss must be audible in the report.
    const { notations, warnings } = readNotations(
      '<notations><ornaments><trill-mark/><mordent/></ornaments></notations>',
    );

    expect(notations.ornaments).toEqual([Ornament.Trill]);
    expect(warnings[0]).toContain('mordent');
  });

  it('gathers across several notations blocks, which are additive', () => {
    // 155 notes in the corpus carry two <notations> elements, and 25 staccatos
    // live only in the second. Reading just the first dropped them silently —
    // found by the corpus articulation count coming up 25 short.
    const { notations } = readNotations(
      '<notations><slur type="start"/></notations>' +
        '<notations><articulations><staccato/></articulations></notations>',
    );

    expect(notations.slur).toBe(SlurRole.Begin);
    expect(notations.articulations).toEqual([Articulation.Staccato]);
  });

  it('ignores tuplet brackets, which time-modification already told us', () => {
    // Redundant rather than unsupported: reading both would give the tuplet
    // two sources of truth that could disagree.
    const { notations, warnings } = readNotations('<notations><tuplet type="start"/></notations>');

    expect(notations).toEqual({});
    expect(warnings).toEqual([]);
  });
});

describe('NotationReading.graceNote', () => {
  const graceOf = (inner: string) => {
    const { warn, messages } = Reporting.collector();
    const result = NotationReading.graceNote(noteOf(inner), 'here', warn);

    if (!Result.isOk(result)) throw new Error(result.error.messages.join('; '));

    return { grace: result.value, warnings: messages };
  };

  it('reads a slashed grace as an acciaccatura', () => {
    // 25 of the corpus's 45 grace notes are slashed.
    expect(graceOf(`<grace slash="yes"/>${pitch}`).grace.style).toBe(GraceStyle.Acciaccatura);
  });

  it('reads an unslashed grace as an appoggiatura', () => {
    expect(graceOf(`<grace/>${pitch}`).grace.style).toBe(GraceStyle.Appoggiatura);
  });

  it('carries the grace note’s pitch', () => {
    expect(graceOf(`<grace/>${pitch}`).grace.pitch.pitchClass.letter).toBe('C');
  });

  it('takes its printed size from type, defaulting to an eighth', () => {
    expect(graceOf(`<grace/>${pitch}`).grace.noteValue).toBe(NoteValue.Eighth);
    expect(graceOf(`<grace/>${pitch}<type>16th</type>`).grace.noteValue).toBe(NoteValue.Sixteenth);
  });

  it('carries a slur to its principal as a flag, not a role', () => {
    // A grace slur has one possible shape — grace to principal — so both ends
    // are implied and there is nothing to number or pair.
    const { grace, warnings } = graceOf(
      `<grace/>${pitch}<notations><slur type="start"/></notations>`,
    );

    expect(grace.slurred).toBe(true);
    expect(warnings).toEqual([]);
  });

  it('leaves an unslurred grace unflagged', () => {
    expect(graceOf(`<grace/>${pitch}`).grace.slurred).toBeUndefined();
  });

  it('still reports anything else a grace cannot carry', () => {
    const { warnings } = graceOf(
      `<grace/>${pitch}<notations><articulations><staccato/></articulations></notations>`,
    );

    expect(warnings[0]).toContain('cannot be carried');
  });

  it('fails on a grace note with no readable pitch, rather than inventing one', () => {
    const { warn } = Reporting.collector();
    const result = NotationReading.graceNote(noteOf('<grace/>'), 'here', warn);

    expect(Result.isOk(result)).toBe(false);
  });
});
