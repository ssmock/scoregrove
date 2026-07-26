import { describe, expect, it } from 'vitest';
import { Result } from '@scoregrove/domain/Result';
import { XmlReading } from '../src/XmlReading';

const expectOk = <T>(result: Result<T>): T => {
  if (!Result.isOk(result))
    throw new Error(`expected ok, got: ${result.error.messages.join('; ')}`);

  return result.value;
};

const expectInvalid = <T>(result: Result<T>) => {
  if (Result.isOk(result)) throw new Error('expected invalid');

  return result.error;
};

const partwise = (body: string, attributes = ' version="4.0"') =>
  `<?xml version="1.0" encoding="UTF-8"?>
   <score-partwise${attributes}>${body}</score-partwise>`;

describe('XmlReading.parse', () => {
  it('accepts a partwise document and reports its version', () => {
    const document = expectOk(XmlReading.parse(partwise('<part-list/>')));

    expect(document.root.name).toBe('score-partwise');
    expect(document.version).toBe('4.0');
  });

  it('accepts a document with a DOCTYPE without fetching the external DTD', () => {
    // Every MusicXML file points its DOCTYPE at musicxml.org. Parsing must not
    // reach for it — a network round trip here would be both slow and an XXE
    // surface — so this passing offline is the assertion.
    const withDoctype = `<?xml version="1.0" encoding="UTF-8"?>
      <!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
      <score-partwise version="4.0"><part-list/></score-partwise>`;

    expect(expectOk(XmlReading.parse(withDoctype)).root.name).toBe('score-partwise');
  });

  it('accepts a document with no DOCTYPE at all', () => {
    // Deliberately permitted: 3.1 and later are commonly XSD-validated and
    // shipped without one, so requiring it would reject valid files.
    const document = expectOk(
      XmlReading.parse('<score-partwise version="4.0"><part-list/></score-partwise>'),
    );

    expect(document.version).toBe('4.0');
  });

  it('omits the version when the root does not declare one', () => {
    expect(expectOk(XmlReading.parse(partwise('<part-list/>', ''))).version).toBeUndefined();
  });

  it('refuses a timewise document outright rather than half-reading it', () => {
    const error = expectInvalid(
      XmlReading.parse('<score-timewise version="4.0"><measure/></score-timewise>'),
    );

    expect(error.messages[0]).toContain('score-timewise');
  });

  it('refuses a document that is not MusicXML at all', () => {
    const error = expectInvalid(XmlReading.parse('<html><body/></html>'));

    expect(error.messages[0]).toContain('score-partwise');
  });

  it('reports malformed XML rather than throwing', () => {
    const error = expectInvalid(XmlReading.parse('<score-partwise><part-list></score-partwise>'));

    expect(error.messages[0]).toContain('Malformed XML');
  });

  it('reports a document with no root element', () => {
    // The parser rejects this itself, before the rootless guard is reached —
    // a document without a root is malformed XML, not merely empty. Asserted
    // for the behaviour rather than the wording we happen to produce.
    expect(expectInvalid(XmlReading.parse('<!-- nothing here -->')).messages[0]).toContain(
      'Root element is missing',
    );
  });
});

describe('XmlReading traversal', () => {
  const document = expectOk(
    XmlReading.parse(
      partwise(`
        <part-list>
          <score-part id="P1"><part-name>Violin 1</part-name></score-part>
          <score-part id="P2"><part-name> Violin 2 </part-name></score-part>
        </part-list>
        <part id="P1"><measure number="1"/><measure number="X1"/></part>
      `),
    ),
  );

  it('returns element children in document order, ignoring text nodes', () => {
    // Order is the whole reason for a node tree: in MusicXML the sequence of
    // children carries meaning that a tag-keyed object would discard.
    expect(XmlReading.elements(document.root).map((e) => e.name)).toEqual(['part-list', 'part']);
  });

  it('finds all children of a name, and the first of a name', () => {
    const partList = XmlReading.childNamed(document.root, 'part-list')!;

    expect(XmlReading.childrenNamed(partList, 'score-part')).toHaveLength(2);
    expect(XmlReading.attribute(XmlReading.childNamed(partList, 'score-part')!, 'id')).toBe('P1');
  });

  it('returns undefined for a missing child rather than throwing', () => {
    expect(XmlReading.childNamed(document.root, 'nope')).toBeUndefined();
    expect(XmlReading.textOf(document.root, 'nope')).toBeUndefined();
  });

  it('trims text, since this corpus carries padded values', () => {
    const parts = XmlReading.childrenNamed(
      XmlReading.childNamed(document.root, 'part-list')!,
      'score-part',
    );

    expect(XmlReading.textOf(parts[1], 'part-name')).toBe('Violin 2');
  });

  it('counts every element in the subtree by name', () => {
    const counts = XmlReading.countElements(document.root);

    expect(counts.get('score-part')).toBe(2);
    expect(counts.get('measure')).toBe(2);
    expect(counts.get('part-name')).toBe(2);
  });

  it('totals the element count, excluding the root itself', () => {
    // part-list, 2 score-part, 2 part-name, part, 2 measure
    expect(XmlReading.totalElements(document.root)).toBe(8);
  });
});
