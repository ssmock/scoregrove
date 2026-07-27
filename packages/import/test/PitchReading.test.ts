import { describe, expect, it } from 'vitest';
import { KeySignature, Mode } from '@scoregrove/domain/KeySignature';
import { Accidental, Octave, Pitch, PitchClass, PitchLetter } from '@scoregrove/domain/Pitch';
import { Result } from '@scoregrove/domain/Result';
import { Semitone } from '@scoregrove/domain/Semitone';
import { PitchReading } from '../src/PitchReading';
import { Reporting } from '../src/Reporting';
import { XmlReading } from '../src/XmlReading';

/** The `<note>` elements of a minimal document */
const notesOf = (...inners: string[]) => {
  const parsed = XmlReading.parse(
    '<score-partwise version="4.0"><part-list/><part id="P1"><measure number="1">' +
      `${inners.map((inner) => `<note>${inner}</note>`).join('')}</measure></part></score-partwise>`,
  );

  if (!Result.isOk(parsed)) throw new Error('bad test XML');

  const part = XmlReading.childNamed(parsed.value.root, 'part')!;
  const measure = XmlReading.childNamed(part, 'measure')!;

  return XmlReading.childrenNamed(measure, 'note');
};

const read = (inner: string) => {
  const { warn, messages } = Reporting.collector();
  const result = PitchReading.pitch(notesOf(inner)[0], 'here', warn);

  return { result, warnings: messages };
};

const expectPitch = (inner: string): Pitch => {
  const { result } = read(inner);

  if (!Result.isOk(result)) throw new Error(result.error.messages.join('; '));

  return result.value;
};

const pitchXml = (step: string, octave: number, alter?: number) =>
  `<pitch><step>${step}</step>${alter === undefined ? '' : `<alter>${alter}</alter>`}<octave>${octave}</octave></pitch>`;

describe('PitchReading.pitch', () => {
  it('reads step and octave', () => {
    expect(expectPitch(pitchXml('C', 4))).toEqual(
      Pitch.of(PitchClass.of(PitchLetter.C), Octave.of(4)),
    );
  });

  it('reads sharps and flats from alter', () => {
    expect(expectPitch(pitchXml('F', 5, 1)).pitchClass.accidental).toBe(Accidental.Sharp);
    expect(expectPitch(pitchXml('B', 3, -1)).pitchClass.accidental).toBe(Accidental.Flat);
    expect(expectPitch(pitchXml('G', 4, 2)).pitchClass.accidental).toBe(Accidental.DoubleSharp);
    expect(expectPitch(pitchXml('A', 4, -2)).pitchClass.accidental).toBe(Accidental.DoubleFlat);
  });

  it('omits the accidental when the note is unaltered, leaving the key to decide', () => {
    // The domain's own convention: an absent accidental means "as the key
    // dictates", which is what an unaltered, unprinted note means.
    expect(expectPitch(pitchXml('F', 5)).pitchClass.accidental).toBeUndefined();
  });

  it('reads an explicit natural from the printed accidental alone', () => {
    // 313 notes in the corpus print an accidental with no <alter> at all, and
    // every one is a natural cancelling the key. Without this they would be
    // left to the key and sound the very note they exist to cancel.
    const pitch = expectPitch(`${pitchXml('B', 4)}<accidental>natural</accidental>`);

    expect(pitch.pitchClass.accidental).toBe(Accidental.Natural);
  });

  it('sounds a cancelling natural against the key it cancels', () => {
    // The behaviour the previous test protects, checked end to end: B in F
    // major sounds B-flat bare, and B-natural only with the explicit natural.
    const fMajor: KeySignature = KeySignature.of(-1, Mode.Major);
    const bare = expectPitch(pitchXml('B', 4));
    const cancelled = expectPitch(`${pitchXml('B', 4)}<accidental>natural</accidental>`);

    expect(Semitone.ofPitch(cancelled, fMajor) - Semitone.ofPitch(bare, fMajor)).toBe(1);
  });

  it('keeps a redundant accidental, which both pipelines treat as an override', () => {
    // An F-sharp in G major: the key already sharpens it, so the explicit
    // sharp must neither double-sharpen it nor change what prints.
    const gMajor: KeySignature = KeySignature.of(1, Mode.Major);
    const explicit = expectPitch(`${pitchXml('F', 5, 1)}<accidental>sharp</accidental>`);
    const bare = expectPitch(pitchXml('F', 5));

    expect(Semitone.ofPitch(explicit, gMajor)).toBe(Semitone.ofPitch(bare, gMajor));
  });

  it('warns when the sounding alteration and the printed accidental disagree', () => {
    const { warnings } = read(`${pitchXml('F', 5, 1)}<accidental>flat</accidental>`);

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('disagrees');
  });

  it('refuses a microtone rather than rounding it to a semitone', () => {
    const { result } = read(pitchXml('C', 4, 0.5));

    expect(Result.isOk(result)).toBe(false);
  });

  it('refuses an octave outside the usable range', () => {
    expect(Result.isOk(read(pitchXml('C', 12)).result)).toBe(false);
  });

  it('refuses unpitched notation by name rather than as a missing pitch', () => {
    const { result } = read('<unpitched><display-step>E</display-step></unpitched>');

    if (Result.isOk(result)) throw new Error('expected invalid');

    expect(result.error.messages[0]).toContain('unpitched');
  });
});

describe('PitchReading predicates and grouping', () => {
  it('tells rests, chord members and grace notes apart', () => {
    const [rest, chordMember, grace] = notesOf(
      '<rest/>',
      `<chord/>${pitchXml('E', 4)}`,
      `<grace/>${pitchXml('D', 5)}`,
    );

    expect(PitchReading.isRest(rest)).toBe(true);
    expect(PitchReading.isChordMember(chordMember)).toBe(true);
    expect(PitchReading.isGrace(grace)).toBe(true);
    expect(PitchReading.isRest(grace)).toBe(false);
  });

  it('groups a chord from the notes marked as sounding with the previous one', () => {
    const { warn } = Reporting.collector();
    const notes = notesOf(
      pitchXml('C', 4),
      `<chord/>${pitchXml('E', 4)}`,
      `<chord/>${pitchXml('G', 4)}`,
      pitchXml('D', 4),
    );

    const groups = PitchReading.chordGroups(notes, warn);

    expect(groups.map((group) => group.length)).toEqual([3, 1]);
  });

  it('leaves single notes as groups of one', () => {
    const { warn } = Reporting.collector();
    const groups = PitchReading.chordGroups(notesOf(pitchXml('C', 4), pitchXml('D', 4)), warn);

    expect(groups.map((group) => group.length)).toEqual([1, 1]);
  });

  it('reports a chord member with nothing to attach to', () => {
    const { warn, messages } = Reporting.collector();
    const groups = PitchReading.chordGroups(notesOf(`<chord/>${pitchXml('E', 4)}`), warn);

    expect(groups).toHaveLength(1);
    expect(messages[0]).toContain('no preceding note');
  });
});

describe('PitchReading.restPosition', () => {
  it('carries the staff row a rest was pinned to', () => {
    // Engraving still prints rests at their standard rows, so this is held
    // without yet being drawn — but the choice is the writer's, made to clear
    // another voice, and cannot be re-derived once discarded.
    const { warn, messages } = Reporting.collector();
    const [note] = notesOf(
      '<rest><display-step>C</display-step><display-octave>5</display-octave></rest>',
    );

    expect(PitchReading.restPosition(note, 'here', warn)).toEqual(
      Pitch.of(PitchClass.of(PitchLetter.C), Octave.of(5)),
    );
    expect(messages).toEqual([]);
  });

  it('is absent for an ordinary rest', () => {
    const { warn, messages } = Reporting.collector();

    expect(PitchReading.restPosition(notesOf('<rest/>')[0], 'here', warn)).toBeUndefined();
    expect(messages).toEqual([]);
  });

  it('is absent for a note that is not a rest', () => {
    const { warn } = Reporting.collector();

    expect(PitchReading.restPosition(notesOf(pitchXml('C', 4))[0], 'here', warn)).toBeUndefined();
  });

  it('reports an unusable position rather than guessing a row', () => {
    const { warn, messages } = Reporting.collector();
    const [note] = notesOf(
      '<rest><display-step>H</display-step><display-octave>5</display-octave></rest>',
    );

    expect(PitchReading.restPosition(note, 'here', warn)).toBeUndefined();
    expect(messages[0]).toContain('unusable rest position');
  });
});
