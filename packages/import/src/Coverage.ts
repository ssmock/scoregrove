/**
 * The audit behind the project's one inviolable rule: **nothing is dropped in
 * silence.**
 *
 * Reporting unsupported elements does not enforce that rule on its own. An
 * element no reader ever looks at raises no warning precisely *because* nobody
 * looked — the failure is invisible by construction. So every element name a
 * MusicXML file can contain is accounted for here, in exactly one of three
 * places, and anything absent from all three is a hole.
 *
 * `Coverage.audit` partitions a file's element census against these lists. A
 * non-empty `unaccounted` means the importer is meeting something it has never
 * been told about, which is a defect whatever the readers happen to warn.
 *
 * This is deliberately a hand-kept manifest rather than runtime instrumentation
 * threaded through every reader. It can drift from the code, but it cannot
 * drift *silently*: the corpus test fails the moment a file contains a name no
 * list mentions, and reviewing a name against its list is a small, honest job.
 */

/** Element names a reader turns into domain data */
export const consumed: readonly string[] = [
  // Document and part structure
  'part-list',
  'score-part',
  'part-name',
  'part-abbreviation',
  'score-instrument',
  'instrument-sound',
  'part',
  'measure',
  // Measure attributes
  'attributes',
  'divisions',
  'key',
  'fifths',
  'mode',
  'time',
  'beats',
  'beat-type',
  'clef',
  'sign',
  'line',
  // Notes
  'note',
  'pitch',
  'step',
  'alter',
  'octave',
  'rest',
  'chord',
  'grace',
  'duration',
  'type',
  'dot',
  'accidental',
  'time-modification',
  'actual-notes',
  'normal-notes',
  // Notations
  'notations',
  'tie',
  'slur',
  'articulations',
  'staccato',
  'staccatissimo',
  'tenuto',
  'accent',
  'strong-accent',
  'ornaments',
  'trill-mark',
  'turn',
  'fermata',
  'notehead',
  'display-step',
  'display-octave',
  // Staff grouping
  'part-group',
  'group-symbol',
  'group-barline',
];

/**
 * Element names read by a module not yet written. Distinct from the categories
 * below because the plan is to consume them — listing them here keeps the audit
 * honest about what is pending rather than pretending it is handled.
 */
export const pending: readonly string[] = [
  // DirectionReading
  'direction',
  'direction-type',
  'dynamics',
  'p',
  'pp',
  'f',
  'ff',
  'fz',
  'other-dynamics',
  'wedge',
  'words',
  'sound',
  // StructureReading
  'barline',
  'bar-style',
  'repeat',
  'ending',
  // The element builder
  'backup',
  'forward',
  'voice',
  // Score header
  'work',
  'work-title',
  'work-number',
  'identification',
  'creator',
  'rights',
];

/**
 * Element names read and deliberately not carried, each with the reason. These
 * are decisions, not oversights, and the reason is the point: a future reader
 * of this file should be able to disagree with one without first working out
 * what it was for.
 */
export const ignored: Readonly<Record<string, string>> = {
  // Engraver's layout, which we re-engrave from scratch by design
  print: 'layout is re-derived; the source page and system breaks are not imported',
  'page-layout': 'layout is re-derived',
  'page-height': 'layout is re-derived',
  'page-width': 'layout is re-derived',
  'page-margins': 'layout is re-derived',
  'left-margin': 'layout is re-derived',
  'right-margin': 'layout is re-derived',
  'top-margin': 'layout is re-derived',
  'bottom-margin': 'layout is re-derived',
  'system-layout': 'layout is re-derived',
  'system-margins': 'layout is re-derived',
  'system-distance': 'layout is re-derived',
  'top-system-distance': 'layout is re-derived',
  'staff-layout': 'layout is re-derived',
  'staff-distance': 'layout is re-derived',
  'line-width': 'layout is re-derived',
  'note-size': 'layout is re-derived',
  defaults: 'layout is re-derived',
  scaling: 'layout is re-derived',
  millimeters: 'layout is re-derived',
  tenths: 'layout is re-derived',
  appearance: 'layout is re-derived',
  'music-font': 'engraving uses its own bundled Bravura',
  'word-font': 'engraving chooses its own text faces',
  'lyric-font': 'engraving chooses its own text faces',
  credit: 'page credits are re-derived from the work title and composer',
  'credit-type': 'page credits are re-derived',
  'credit-words': 'page credits are re-derived',

  // Derived rather than imported, per the rendering strategy
  beam: 'beaming is derived from beat structure; the domain has no beam field',
  stem: 'stem direction is derived from staff position and voice',
  tuplet: 'the bracket is derived from runs of equal ratios; time-modification is authoritative',
  tied: 'the printed tie; <tie> carries the same information and is read instead',

  // Playback parameters we set ourselves
  'midi-instrument': 'playback assigns its own instruments',
  'midi-device': 'playback assigns its own instruments',
  'midi-channel': 'playback assigns its own instruments',
  'midi-program': 'playback assigns its own instruments',
  volume: 'playback resolves loudness from written dynamics',
  pan: 'the domain has no stereo placement',
  'instrument-name': 'the part name is used; the instrument sound carries the timbre',

  // Metadata about the file rather than the music
  encoding: 'describes the encoder, not the music',
  'encoding-date': 'describes the encoder, not the music',
  software: 'describes the encoder, not the music',
  source: 'recorded in the corpus PROVENANCE instead',
  supports: 'declares encoder capabilities, not musical content',
};

/**
 * Element names whose information the model cannot hold. Every one is a real
 * loss, listed so it can be argued with — and each is reported at its site so
 * a file that uses one says so.
 *
 * **Currently empty**, and deliberately so: everything this corpus contains is
 * now carried by the model, whether or not the engraver draws it. Notehead
 * style, a rest's chosen row, and staff grouping each lived here until the
 * domain grew somewhere to put them.
 */
export const unrepresented: Readonly<Record<string, string>> = {};

export type CoverageAudit = {
  /** Names met in the file and turned into domain data */
  consumed: readonly string[];
  /** Names met that a planned module will read */
  pending: readonly string[];
  /** Names met and deliberately dropped, with reasons */
  ignored: readonly { name: string; reason: string }[];
  /** Names met whose information the model cannot hold, with reasons */
  unrepresented: readonly { name: string; reason: string }[];
  /**
   * Names met that appear on **no** list — the audit's whole purpose. Each is
   * an element the importer has never been told about, and so cannot be
   * warning about either.
   */
  unaccounted: readonly string[];
};

export const Coverage = {
  consumed,
  pending,
  ignored,
  unrepresented,

  /** Partitions the element names a file actually contains against the lists above */
  audit(elementNames: Iterable<string>): CoverageAudit {
    const met = [...new Set(elementNames)].sort();
    const isConsumed = new Set(consumed);
    const isPending = new Set(pending);

    return {
      consumed: met.filter((name) => isConsumed.has(name)),
      pending: met.filter((name) => !isConsumed.has(name) && isPending.has(name)),
      ignored: met
        .filter((name) => ignored[name] !== undefined)
        .map((name) => ({ name, reason: ignored[name] })),
      unrepresented: met
        .filter((name) => unrepresented[name] !== undefined)
        .map((name) => ({ name, reason: unrepresented[name] })),
      unaccounted: met.filter(
        (name) =>
          !isConsumed.has(name) &&
          !isPending.has(name) &&
          ignored[name] === undefined &&
          unrepresented[name] === undefined,
      ),
    };
  },
};
