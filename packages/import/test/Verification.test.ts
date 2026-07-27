import { describe, expect, it } from 'vitest';
import { Result } from '@scoregrove/domain/Result';
import { Verification } from '../src/Verification';
import { XmlReading } from '../src/XmlReading';

/**
 * A check that cannot fail is worth nothing, so each of these breaks the score
 * in one specific way and asserts that the check aimed at that class — and
 * ideally only that one — notices.
 */

const note = (step: string, octave: number, extra = '') =>
  `<note><pitch><step>${step}</step><octave>${octave}</octave></pitch>` +
  `<duration>96</duration><type>whole</type>${extra}</note>`;

/** Two parts of one whole-note measure each, which every check should pass */
const document = (violin = note('A', 4), cello = note('C', 3)) =>
  `<score-partwise version="4.0">
    <part-list>
      <score-part id="P1"><part-name>Violin</part-name>
        <score-instrument id="I1"><instrument-sound>strings.violin</instrument-sound></score-instrument>
      </score-part>
      <score-part id="P2"><part-name>Cello</part-name>
        <score-instrument id="I2"><instrument-sound>strings.cello</instrument-sound></score-instrument>
      </score-part>
    </part-list>
    <part id="P1"><measure number="1">
      <attributes><divisions>24</divisions><key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef></attributes>
      ${violin}
    </measure></part>
    <part id="P2"><measure number="1">
      <attributes><divisions>24</divisions><key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>F</sign><line>4</line></clef></attributes>
      ${cello}
    </measure></part>
  </score-partwise>`;

const verify = (xml: string) => {
  const parsed = XmlReading.parse(xml);

  if (!Result.isOk(parsed)) throw new Error(parsed.error.messages.join('; '));

  const report = Verification.run(parsed.value);

  if (!Result.isOk(report)) throw new Error(report.error.messages.join('; '));

  return report.value;
};

const failing = (xml: string) =>
  verify(xml)
    .checks.filter((check) => !check.passed)
    .map((check) => check.name);

describe('Verification', () => {
  it('passes a score with nothing wrong with it', () => {
    const report = verify(document());

    expect(report.passed).toBe(true);
    expect(report.checks.every((check) => check.passed)).toBe(true);
  });

  it('catches a part playing below its instrument’s lowest string', () => {
    // A violin cannot sound below G3, so a C3 there means a transposition or
    // octave bug — the one class every per-measure comparison agrees with,
    // because the source and the importer would be wrong together.
    const names = failing(document(note('C', 3)));

    expect(names).toContain('no part plays below its instrument’s lowest string');
  });

  it('catches a measure whose parts do not span the same time', () => {
    // Half a bar in the cello against a whole in the violin
    const short =
      '<note><pitch><step>C</step><octave>3</octave></pitch>' +
      '<duration>48</duration><type>half</type></note>';

    expect(failing(document(note('A', 4), short))).toContain(
      'every voice of a measure spans the same time',
    );
  });

  it('reports where a failure is, not just that there was one', () => {
    const report = verify(document(note('C', 3)));
    const range = report.checks.find(
      (check) => check.name === 'no part plays below its instrument’s lowest string',
    );

    expect(range?.failures[0]).toContain('measure 0');
    expect(range?.failures[0]).toContain('C3');
  });
});
