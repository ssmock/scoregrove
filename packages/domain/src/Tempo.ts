import { DotCount, NoteValue } from './Duration';
import { PositiveInteger } from './PositiveInteger';
import { Result } from './Result';
import { vocabulary } from './Vocabulary';

const markingMembers = {
  Larghissimo: 'Larghissimo',
  Grave: 'Grave',
  Largo: 'Largo',
  Larghetto: 'Larghetto',
  Adagio: 'Adagio',
  Adagietto: 'Adagietto',
  Andante: 'Andante',
  Andantino: 'Andantino',
  Moderato: 'Moderato',
  Allegretto: 'Allegretto',
  Allegro: 'Allegro',
  Vivace: 'Vivace',
  Vivacissimo: 'Vivacissimo',
  Presto: 'Presto',
  Prestissimo: 'Prestissimo',
} as const;

/**
 * The traditional Italian tempo markings, ordered slowest to fastest. Mapping
 * to beats per minute is deliberately left for later.
 */
export type TempoMarking = (typeof markingMembers)[keyof typeof markingMembers];

export const TempoMarking = {
  ...markingMembers,
  ...vocabulary<TempoMarking>(markingMembers),
};

const changeMembers = {
  Accelerando: 'Accelerando',
  Ritardando: 'Ritardando',
  Rallentando: 'Rallentando',
  Ritenuto: 'Ritenuto',
  ATempo: 'ATempo',
} as const;

/**
 * Instructions that alter or restore the prevailing tempo: accelerando (speed
 * up), ritardando/rallentando (slow down gradually), ritenuto (hold back
 * immediately), and a tempo (return to the prevailing tempo).
 */
export type TempoChange = (typeof changeMembers)[keyof typeof changeMembers];

export const TempoChange = {
  ...changeMembers,
  ...vocabulary<TempoChange>(changeMembers),
};

/**
 * An exact tempo: so many beats per minute of a given note value (optionally
 * dotted) — the metronome mark conventionally printed as "♩ = 120" or
 * "♩. = 80". Unlike the Italian markings, this pins a precise speed, which
 * playback reads directly (from `bpm`) rather than inferring one from a
 * marking. The beat note value need not be the time signature's beat unit
 * (6/8 is commonly marked on the dotted quarter).
 */
export type MetronomeMark = {
  noteValue: NoteValue;
  dots?: DotCount;
  bpm: PositiveInteger;
};

/** Prose names for the beat note value, used by `format` (the serif text face has no note glyphs of its own) */
const beatNames: Record<NoteValue, string> = {
  Breve: 'breve',
  Whole: 'whole',
  Half: 'half',
  Quarter: 'quarter',
  Eighth: 'eighth',
  Sixteenth: 'sixteenth',
  ThirtySecond: 'thirty-second',
  SixtyFourth: 'sixty-fourth',
};

export const MetronomeMark = {
  /**
   * Brands a metronome mark from an already-valid beats-per-minute count;
   * use only when the value is known positive (e.g. a literal). `create`
   * validates arbitrary input.
   */
  of(noteValue: NoteValue, bpm: PositiveInteger, dots?: DotCount): MetronomeMark {
    return dots ? { noteValue, dots, bpm } : { noteValue, bpm };
  },

  create(noteValue: NoteValue, bpm: number, dots?: DotCount): Result<MetronomeMark> {
    if (!PositiveInteger.is(bpm)) {
      return Result.invalid(
        'A metronome mark’s tempo must be a positive whole number of beats per minute',
      );
    }

    return Result.ok(MetronomeMark.of(noteValue, PositiveInteger.of(bpm), dots));
  },

  /** Narrows a tempo indication to a metronome mark (the only non-string tempo) */
  is(tempo: Tempo): tempo is MetronomeMark {
    return typeof tempo !== 'string';
  },

  equals(a: MetronomeMark, b: MetronomeMark): boolean {
    return a.noteValue === b.noteValue && (a.dots ?? 0) === (b.dots ?? 0) && a.bpm === b.bpm;
  },

  /**
   * The conventional text of the mark, e.g. "quarter = 120" or "dotted
   * quarter = 80". Engraving prints this verbatim for now; the score-standard
   * form (a SMuFL note glyph followed by "= 120") is future work — the serif
   * text face has no reliable note glyphs, so prose keeps it legible until a
   * proper glyph-plus-number metronome annotation lands (see playback.md).
   */
  format(mark: MetronomeMark): string {
    const dots = mark.dots === 2 ? 'double-dotted ' : mark.dots === 1 ? 'dotted ' : '';

    return `${dots}${beatNames[mark.noteValue]} = ${mark.bpm}`;
  },
};

/** Structural guard for the metronome-mark shape against fully-unknown input (the `Tempo.is(unknown)` path) */
const isMetronomeShape = (val: unknown): val is MetronomeMark => {
  if (typeof val !== 'object' || val === null) return false;

  const candidate = val as { noteValue?: unknown; bpm?: unknown; dots?: unknown };

  return (
    NoteValue.is(candidate.noteValue) &&
    PositiveInteger.is(candidate.bpm) &&
    (candidate.dots === undefined || DotCount.is(candidate.dots))
  );
};

/**
 * Any tempo indication that can appear over a measure: an absolute Italian
 * marking, a gradual change instruction, or an exact metronome mark.
 */
export type Tempo = TempoMarking | TempoChange | MetronomeMark;

/** The enumerable string tempos (markings + changes); a metronome mark is constructed, not one of a fixed set */
const stringTempos = vocabulary<TempoMarking | TempoChange>({
  ...markingMembers,
  ...changeMembers,
});

export const Tempo = {
  /** The Italian markings and change instructions. Metronome marks are built, not listed, so they are not here. */
  values: stringTempos.values,

  /** Parses a marking or change name; metronome marks are constructed via `MetronomeMark.of`/`create`, not parsed. */
  create: stringTempos.create,

  /** Whether `val` is any tempo indication: an Italian marking, a change instruction, or a metronome mark. */
  is(val: unknown): val is Tempo {
    return stringTempos.is(val) || isMetronomeShape(val);
  },

  /** Narrows a tempo to an absolute Italian marking. */
  isMarking(tempo: Tempo): tempo is TempoMarking {
    return typeof tempo === 'string' && TempoMarking.is(tempo);
  },

  /** Narrows a tempo to a gradual change instruction. */
  isChange(tempo: Tempo): tempo is TempoChange {
    return typeof tempo === 'string' && TempoChange.is(tempo);
  },

  /** Narrows a tempo to an exact metronome mark. */
  isMetronome(tempo: Tempo): tempo is MetronomeMark {
    return MetronomeMark.is(tempo);
  },
};
