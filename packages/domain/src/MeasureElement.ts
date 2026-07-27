import type { Duration } from './Duration';
import type { Dynamic } from './Dynamic';
import { NonEmptyArray } from './NonEmptyArray';
import { NonEmptyString } from './NonEmptyString';
import type { Notations } from './Notations';
import { Pitch } from './Pitch';
import { Result } from './Result';
import { pickDuplicatesWithFn, proseList } from './Utils';
import { vocabulary } from './Vocabulary';

const tieMembers = {
  Begin: 'Begin',
  End: 'End',
  Both: 'Both',
} as const;

/**
 * How a note or chord tone participates in a tie: Begin starts a tie into the
 * next element of the same pitch, End receives one, and Both does each (the
 * middle of a chain).
 */
export type TieRole = (typeof tieMembers)[keyof typeof tieMembers];

export const TieRole = {
  ...tieMembers,
  ...vocabulary<TieRole>(tieMembers),
};

const noteheadMembers = {
  Normal: 'Normal',
  None: 'None',
} as const;

/**
 * How a notehead is drawn. `None` is an invisible notehead — a real device,
 * used to hold a duration without printing a note (spacing a voice, or writing
 * a tie into a bar that shows nothing).
 *
 * Deliberately narrow, following the ornament precedent: the shaped heads (X,
 * diamond, slash) belong with the unpitched and percussion design that
 * `TODO-more.md` calls for, and inventing half of that here would pre-empt it.
 * An absent style means Normal.
 */
export type NoteheadStyle = (typeof noteheadMembers)[keyof typeof noteheadMembers];

export const NoteheadStyle = {
  ...noteheadMembers,
  ...vocabulary<NoteheadStyle>(noteheadMembers),
};

/**
 * A single sounded pitch with a written duration, its own optional tie, and
 * any shared notations (articulations, slur, fermata, graces, lyrics).
 */
export type Note = {
  kind: 'note';
  pitch: Pitch;
  duration: Duration;
  tie?: TieRole;
  /** How the head is drawn; absent means Normal */
  notehead?: NoteheadStyle;
} & Notations;

export const Note = {
  of(pitch: Pitch, duration: Duration, extras: { tie?: TieRole } & Notations = {}): Note {
    return { kind: 'note', pitch, duration, ...extras };
  },

  is(element: MeasureElement): element is Note {
    return element.kind === 'note';
  },
};

/**
 * Silence for a written duration. A fermata may extend it; other notations do
 * not apply to silence.
 */
export type Rest = {
  kind: 'rest';
  duration: Duration;
  fermata?: boolean;
  /**
   * Where the rest sits on the staff, when the writer pinned it — expressed as
   * the pitch whose staff position it occupies, which is how the printed page
   * and MusicXML both think of it.
   *
   * Absent means the standard row for the value, which is the usual case. It is
   * set to clear another voice: a rest that would collide with the notes below
   * it gets lifted, and that choice is the writer's rather than the engraver's.
   */
  position?: Pitch;
};

export const Rest = {
  of(duration: Duration, extras: { fermata?: boolean; position?: Pitch } = {}): Rest {
    return { kind: 'rest', duration, ...extras };
  },

  is(element: MeasureElement): element is Rest {
    return element.kind === 'rest';
  },
};

/**
 * One pitch within a chord, carrying its own optional tie so that a chord can
 * tie only the tones that continue into the next element.
 */
export type ChordTone = {
  pitch: Pitch;
  tie?: TieRole;
  /** How this tone's head is drawn; absent means Normal */
  notehead?: NoteheadStyle;
};

export const ChordTone = {
  of(pitch: Pitch, tie?: TieRole): ChordTone {
    return tie ? { pitch, tie } : { pitch };
  },
};

/**
 * Two or more distinct pitches sounded together for a single written duration.
 * Ties are per tone; the shared notations apply to the chord as a whole.
 */
export type Chord = {
  kind: 'chord';
  tones: NonEmptyArray<ChordTone>;
  duration: Duration;
} & Notations;

export const Chord = {
  create(
    tones: readonly (Pitch | ChordTone)[] | null | undefined,
    duration: Duration,
    notations: Notations = {},
  ): Result<Chord> {
    const normalized = (tones ?? []).map((entry) =>
      'pitch' in entry ? entry : ChordTone.of(entry),
    );

    const listResult = NonEmptyArray.create(normalized, NonEmptyString.of('Chord tones'));

    if (!Result.isOk(listResult)) return Result.mapError(listResult);

    const list = listResult.value;

    if (list.length < 2) return Result.invalid('A chord requires at least two tones');

    const duplicates = pickDuplicatesWithFn(
      list.map((tone) => tone.pitch),
      Pitch.equals,
    );

    if (duplicates.length) {
      return Result.invalid(
        `A chord cannot repeat a pitch: ${proseList(duplicates.map(Pitch.format))}`,
      );
    }

    return Result.ok({ kind: 'chord', tones: list, duration, ...notations });
  },

  is(element: MeasureElement): element is Chord {
    return element.kind === 'chord';
  },
};

/**
 * A dynamic indication positioned within the element sequence. It takes effect
 * at the following note and, for gradual changes, runs until the next dynamic
 * indication.
 */
export type DynamicElement = {
  kind: 'dynamic';
  dynamic: Dynamic;
};

export const DynamicElement = {
  of(dynamic: Dynamic): DynamicElement {
    return { kind: 'dynamic', dynamic };
  },

  is(element: MeasureElement): element is DynamicElement {
    return element.kind === 'dynamic';
  },
};

/**
 * Anything that can appear in one voice's element sequence within a measure.
 */
export type MeasureElement = Note | Rest | Chord | DynamicElement;
