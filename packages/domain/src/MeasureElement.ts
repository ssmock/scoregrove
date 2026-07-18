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

/**
 * A single sounded pitch with a written duration, its own optional tie, and
 * any shared notations (articulations, slur, fermata, graces, lyrics).
 */
export type Note = {
  kind: 'note';
  pitch: Pitch;
  duration: Duration;
  tie?: TieRole;
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
};

export const Rest = {
  of(duration: Duration, extras: { fermata?: boolean } = {}): Rest {
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
