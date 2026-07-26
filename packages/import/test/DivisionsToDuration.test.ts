import { describe, expect, it } from 'vitest';
import { Duration, NoteValue, Tuplet } from '@scoregrove/domain/Duration';
import { Fraction } from '@scoregrove/domain/Fraction';
import { Result } from '@scoregrove/domain/Result';
import { DivisionsToDuration } from '../src/DivisionsToDuration';
import { Reporting } from '../src/Reporting';
import { XmlReading } from '../src/XmlReading';

/**
 * The `<note>` from a minimal document. It has to be a real one: `XmlReading`
 * refuses any root that is not `score-partwise`, so a bare `<note>` will not
 * parse — which is the validator behaving correctly, not an obstacle.
 */
const noteOf = (inner: string) => {
  const parsed = XmlReading.parse(
    '<score-partwise version="4.0"><part-list/><part id="P1">' +
      `<measure number="1"><note>${inner}</note></measure></part></score-partwise>`,
  );

  if (!Result.isOk(parsed)) throw new Error('bad test XML');

  const part = XmlReading.childNamed(parsed.value.root, 'part')!;
  const measure = XmlReading.childNamed(part, 'measure')!;

  return XmlReading.childNamed(measure, 'note')!;
};

const read = (inner: string, divisions = 24) => {
  const { warn, messages } = Reporting.collector();
  const result = DivisionsToDuration.read(noteOf(inner), divisions, 'here', warn);

  return { result, warnings: messages };
};

const expectDuration = (inner: string, divisions = 24): Duration => {
  const { result } = read(inner, divisions);

  if (!Result.isOk(result)) throw new Error(result.error.messages.join('; '));

  return result.value;
};

describe('DivisionsToDuration.wholeNotes', () => {
  it('reads divisions as a fraction of a whole note, not of a quarter', () => {
    // divisions counts units per quarter, so a whole note is four of them.
    expect(DivisionsToDuration.wholeNotes(96, 24)).toEqual(Fraction.of(1, 1));
    expect(DivisionsToDuration.wholeNotes(24, 24)).toEqual(Fraction.of(1, 4));
    expect(DivisionsToDuration.wholeNotes(3, 24)).toEqual(Fraction.of(1, 32));
  });
});

describe('DivisionsToDuration.read from the written form', () => {
  it('reads a plain note type', () => {
    expect(expectDuration('<type>quarter</type><duration>24</duration>')).toEqual(
      Duration.of(NoteValue.Quarter),
    );
  });

  it('reads augmentation dots', () => {
    expect(expectDuration('<type>half</type><dot/><duration>72</duration>')).toEqual(
      Duration.of(NoteValue.Half, { dots: 1 }),
    );

    expect(expectDuration('<type>half</type><dot/><dot/><duration>84</duration>')).toEqual(
      Duration.of(NoteValue.Half, { dots: 2 }),
    );
  });

  it('reads a tuplet from time-modification', () => {
    // A triplet eighth is written as an eighth in the space of two: 1/8 × 2/3.
    const duration = expectDuration(
      '<type>eighth</type><duration>8</duration>' +
        '<time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes></time-modification>',
    );

    expect(duration).toEqual(Duration.of(NoteValue.Eighth, { tuplet: Tuplet.triplet() }));
    expect(Duration.fractionOfWhole(duration)).toEqual(Fraction.of(1, 12));
  });

  it('covers every note type the corpus uses', () => {
    const types: [string, NoteValue][] = [
      ['whole', NoteValue.Whole],
      ['half', NoteValue.Half],
      ['quarter', NoteValue.Quarter],
      ['eighth', NoteValue.Eighth],
      ['16th', NoteValue.Sixteenth],
      ['32nd', NoteValue.ThirtySecond],
    ];

    for (const [type, noteValue] of types) {
      expect(expectDuration(`<type>${type}</type>`).noteValue).toBe(noteValue);
    }
  });

  it('reports an unsupported note type rather than guessing', () => {
    const { result } = read('<type>1024th</type><duration>1</duration>');

    expect(Result.isOk(result)).toBe(false);
  });
});

describe('DivisionsToDuration.read cross-checking written against sounded', () => {
  it('stays quiet when the two agree', () => {
    expect(read('<type>quarter</type><duration>24</duration>').warnings).toEqual([]);
  });

  it('warns when the written value does not last what <duration> claims', () => {
    // The check that catches both a self-contradictory file and a misreading
    // on our side — the two are indistinguishable from here, and both matter.
    const { warnings } = read('<type>quarter</type><duration>36</duration>');

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('should last');
    expect(warnings[0]).toContain('36');
  });

  it('checks tuplets exactly, without rounding to whole divisions', () => {
    // A triplet eighth at divisions 24 is 8 divisions exactly; at divisions 16
    // it would be 16/3, which is not an integer — so the comparison is done in
    // fractions rather than rounded into agreement.
    const triplet =
      '<type>eighth</type><time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes></time-modification>';

    expect(read(`${triplet}<duration>8</duration>`, 24).warnings).toEqual([]);
    expect(read(`${triplet}<duration>5</duration>`, 16).warnings).toHaveLength(1);
  });

  it('exempts grace notes, which carry no duration to check against', () => {
    const { warnings } = read('<grace/><type>eighth</type>');

    expect(warnings).toEqual([]);
  });
});

describe('DivisionsToDuration.read from the sounded form', () => {
  it('recovers a whole-measure rest in 4/4', () => {
    // 160 notes in the corpus are <rest measure="yes"/> with no <type>: they
    // state only how long they last.
    expect(expectDuration('<rest measure="yes"/><duration>96</duration>')).toEqual(
      Duration.of(NoteValue.Whole),
    );
  });

  it('recovers a whole-measure rest in 3/4 as a dotted half', () => {
    expect(expectDuration('<rest measure="yes"/><duration>72</duration>')).toEqual(
      Duration.of(NoteValue.Half, { dots: 1 }),
    );
  });

  it('refuses a length no written value can express, rather than rounding', () => {
    // Five divisions of twenty-four is 5/96 of a whole note — no note value,
    // dotted or otherwise, is that long.
    const { result } = read('<rest measure="yes"/><duration>5</duration>');

    if (Result.isOk(result)) throw new Error('expected invalid');

    expect(result.error.messages[0]).toContain('No written note value spans');
  });

  it('refuses a note with neither a type nor a duration', () => {
    const { result } = read('<rest/>');

    if (Result.isOk(result)) throw new Error('expected invalid');

    expect(result.error.messages[0]).toContain('neither');
  });
});

describe('DivisionsToDuration.fromWholeNotes', () => {
  it('prefers the plain value over a dotted shorter one', () => {
    // A half note is 1/2; so is a dotted... nothing. But the search order still
    // matters for values two spellings could reach, so pin the longest-first rule.
    const half = DivisionsToDuration.fromWholeNotes(Fraction.of(1, 2));

    expect(Result.isOk(half) && half.value).toEqual(Duration.of(NoteValue.Half));
  });

  it('round-trips every representable written duration', () => {
    // The inverse must agree with the forward direction for everything the
    // domain can express, or a typeless element could come back as a different
    // note than it went in as.
    for (const noteValue of NoteValue.values) {
      for (const dots of [undefined, 1, 2] as const) {
        const duration = Duration.of(noteValue, dots ? { dots } : {});
        const recovered = DivisionsToDuration.fromWholeNotes(Duration.fractionOfWhole(duration));

        expect(Result.isOk(recovered) && Duration.equals(recovered.value, duration)).toBe(true);
      }
    }
  });
});
