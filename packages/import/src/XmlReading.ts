import { Result } from '@scoregrove/domain/Result';
import { XmlDocument, XmlElement, XmlError, parseXml } from '@rgrove/parse-xml';

/**
 * The entry point of the importer: raw MusicXML text into a validated node
 * tree, plus the small traversal vocabulary every later reader is built on.
 *
 * ## Why a node tree rather than an object
 *
 * MusicXML is **order-sensitive** in a way most XML is not. A measure's
 * `<note>` sequence *is* the music, and `<backup>`/`<forward>` mean nothing
 * except positionally. Parsers that hand back a plain JavaScript object keyed
 * by tag name discard exactly the information the format carries, so this uses
 * `@rgrove/parse-xml`, whose tree preserves document order by construction. It
 * also parses the DOCTYPE **without fetching the external DTD** — every
 * MusicXML file points at `musicxml.org`, and we want neither a network round
 * trip nor an XXE surface at parse time.
 *
 * ## What is rejected
 *
 * Only what cannot be read at all: malformed XML, an empty document, and
 * `score-timewise`. The last is refused outright rather than half-supported —
 * a timewise file interleaves parts per measure, so reading it is a different
 * traversal, not a variation on this one. Everything else that is merely
 * *unrecognized* is the report's business, not the parser's.
 */

/** A parsed MusicXML document, known to be partwise and to have a root */
export type MusicXmlDocument = {
  root: XmlElement;
  /** The root's `version` attribute (e.g. "4.0"); absent on very old files */
  version?: string;
};

/** Only element children, in document order — the order MusicXML encodes meaning in */
const elementsOf = (parent: XmlDocument | XmlElement): XmlElement[] =>
  parent.children.filter((child): child is XmlElement => child instanceof XmlElement);

export const XmlReading = {
  /**
   * Parses MusicXML text into a validated document. Errors are `Result`s
   * rather than exceptions, matching the rest of the domain, so a caller
   * importing a directory can report a bad file and carry on.
   */
  parse(xml: string): Result<MusicXmlDocument> {
    let document: XmlDocument;

    try {
      document = parseXml(xml);
    } catch (error) {
      // XmlError carries line/column, which is the only useful thing to say
      // about a file that will not parse at all.
      if (error instanceof XmlError) return Result.invalid(`Malformed XML: ${error.message}`);

      throw error;
    }

    // In practice the parser rejects a rootless document as malformed before
    // this, so the guard is type narrowing rather than an expected path.
    const root = document.root;

    if (!root) return Result.invalid('The document has no root element');

    if (root.name === 'score-timewise') {
      return Result.invalid(
        'This is a score-timewise document; only score-partwise is supported. ' +
          'Most editors can export partwise, or MusicXML ships an XSLT to convert.',
      );
    }

    if (root.name !== 'score-partwise') {
      return Result.invalid(
        `Expected a score-partwise root element, found <${root.name}>. ` +
          'This does not look like a MusicXML document.',
      );
    }

    const version = root.attributes.version;

    // Note there is deliberately no DOCTYPE requirement. MusicXML 3.1 and later
    // are commonly validated against the XSD and shipped without one, so
    // demanding a DOCTYPE would reject valid files; the root element and its
    // `version` are the reliable identification.
    return Result.ok(version ? { root, version } : { root });
  },

  /** Element children of `parent`, in document order */
  elements: elementsOf,

  /** Element children named `name`, in document order */
  childrenNamed(parent: XmlDocument | XmlElement, name: string): XmlElement[] {
    return elementsOf(parent).filter((child) => child.name === name);
  },

  /** The first element child named `name`, or undefined */
  childNamed(parent: XmlDocument | XmlElement, name: string): XmlElement | undefined {
    return elementsOf(parent).find((child) => child.name === name);
  },

  /**
   * The trimmed text of the first child named `name`. Trimming matters: this
   * corpus carries values like `" dolce"` and a non-breaking space, artifacts
   * of the transcription rather than meaning.
   */
  textOf(parent: XmlDocument | XmlElement, name: string): string | undefined {
    const child = XmlReading.childNamed(parent, name);

    return child ? child.text.trim() : undefined;
  },

  /** An attribute value, or undefined when absent */
  attribute(element: XmlElement, name: string): string | undefined {
    return element.attributes[name];
  },

  /**
   * Every element in the subtree, counted by tag name.
   *
   * This is the denominator of the import's central accounting identity:
   * `consumed + unsupported` must equal it, which is what turns "never drop an
   * element silently" from an intention into something checkable. An element a
   * reader believes it handled but quietly discards shows up in neither
   * histogram, and only this total catches it.
   */
  countElements(parent: XmlDocument | XmlElement): Map<string, number> {
    const counts = new Map<string, number>();

    const walk = (element: XmlElement): void => {
      counts.set(element.name, (counts.get(element.name) ?? 0) + 1);

      for (const child of elementsOf(element)) walk(child);
    };

    for (const element of elementsOf(parent)) walk(element);

    return counts;
  },

  /** The subtree's total element count — the sum of `countElements` */
  totalElements(parent: XmlDocument | XmlElement): number {
    let total = 0;

    for (const count of XmlReading.countElements(parent).values()) total += count;

    return total;
  },
};
