import { ClosingBarline, OpeningBarline } from './Barline';
import { Count } from './Count';
import type { KeySignature } from './KeySignature';
import { Measure } from './Measure';
import { type Chord, type Note, TieRole } from './MeasureElement';
import { NavigationJump, NavigationMark } from './Navigation';
import type { NonEmptyArray } from './NonEmptyArray';
import type { NonEmptyString } from './NonEmptyString';
import { SlurRole } from './Notations';
import { Pitch } from './Pitch';
import { Result } from './Result';
import type { Staff } from './Staff';
import type { Tempo } from './Tempo';
import type { Swing, TimeSignature } from './TimeSignature';

/**
 * A complete musical score: staff definitions, the initial key, time, tempo,
 * and swing feel, and the measures themselves. Mid-piece changes to any of
 * these are carried by the measure where they take effect. An absent swing
 * means Straight.
 *
 * `Score.of` builds without validation so that drafts — scores mid-composition
 * that temporarily break structural rules — are representable. Call
 * `Score.check` whenever structural coherence matters (saving, playback,
 * rendering).
 */
export type Score = {
  title?: NonEmptyString;
  composer?: NonEmptyString;
  staves: NonEmptyArray<Staff>;
  key: KeySignature;
  time: TimeSignature;
  tempo?: Tempo;
  swing?: Swing;
  measures: NonEmptyArray<Measure>;
};

const dalSegnoJumps: readonly NavigationJump[] = [
  NavigationJump.DalSegno,
  NavigationJump.DalSegnoAlFine,
  NavigationJump.DalSegnoAlCoda,
];

const alFineJumps: readonly NavigationJump[] = [
  NavigationJump.DaCapoAlFine,
  NavigationJump.DalSegnoAlFine,
];

const alCodaJumps: readonly NavigationJump[] = [
  NavigationJump.DaCapoAlCoda,
  NavigationJump.DalSegnoAlCoda,
];

const checkStaffAlignment = (score: Score): string[] => {
  const messages: string[] = [];
  const staffCount = score.staves.length;

  score.measures.forEach((measure, i) => {
    if (measure.contents.length !== staffCount) {
      messages.push(
        `Measure ${i + 1} has content for ${measure.contents.length} of the ` +
          `${staffCount} staves the score defines`,
      );
    }
  });

  return messages;
};

const checkNavigation = (score: Score): string[] => {
  const messages: string[] = [];

  const marks = new Set<NavigationMark>(score.measures.flatMap((m) => m.marks ?? []));
  const jumps = new Set<NavigationJump>(score.measures.flatMap((m) => (m.jump ? [m.jump] : [])));

  if (dalSegnoJumps.some((jump) => jumps.has(jump)) && !marks.has(NavigationMark.Segno)) {
    messages.push('A dal segno jump requires a Segno mark somewhere in the score');
  }

  if (alFineJumps.some((jump) => jumps.has(jump)) && !marks.has(NavigationMark.Fine)) {
    messages.push('An al Fine jump requires a Fine mark somewhere in the score');
  }

  const hasAlCodaJump = alCodaJumps.some((jump) => jumps.has(jump));

  if (hasAlCodaJump && !marks.has(NavigationMark.Coda)) {
    messages.push('An al Coda jump requires a Coda mark somewhere in the score');
  }

  if (hasAlCodaJump && !jumps.has(NavigationJump.ToCoda)) {
    messages.push('An al Coda jump requires a ToCoda jump marking the departure point');
  }

  if (jumps.has(NavigationJump.ToCoda) && !marks.has(NavigationMark.Coda)) {
    messages.push('A ToCoda jump requires a Coda mark somewhere in the score');
  }

  return messages;
};

/**
 * Fullness of every measure against the time signature in force there. The
 * first measure may be underfull (an anacrusis / pickup).
 */
const checkFullness = (score: Score): string[] => {
  const messages: string[] = [];
  let time = score.time;

  score.measures.forEach((measure, i) => {
    time = measure.time ?? time;

    const result = Measure.check(time, measure, { allowUnderfull: i === 0 });

    if (Result.isError(result)) {
      messages.push(...result.error.messages.map((m) => `Measure ${i + 1}: ${m}`));
    }
  });

  return messages;
};

/**
 * Traditional repeats cannot nest, and an opened repeat must eventually close.
 * A RepeatClose without a preceding RepeatOpen is legal (it repeats from the
 * beginning of the score).
 */
const checkRepeats = (score: Score): string[] => {
  const messages: string[] = [];
  let openedAt: number | null = null;

  score.measures.forEach((measure, i) => {
    if (measure.opening === OpeningBarline.RepeatOpen) {
      if (openedAt !== null) {
        messages.push(
          `Measure ${i + 1} opens a repeat while the repeat opened at ` +
            `measure ${openedAt + 1} is still open`,
        );
      }

      openedAt = i;
    }

    if (measure.closing === ClosingBarline.RepeatClose) {
      openedAt = null;
    }
  });

  if (openedAt !== null) {
    messages.push(`The repeat opened at measure ${openedAt + 1} is never closed`);
  }

  return messages;
};

type VoltaBracket = {
  numbers: readonly number[];
  start: number;
  end: number;
};

const sameNumbers = (a: readonly number[], b: readonly number[]): boolean =>
  a.length === b.length && a.every((n, i) => n === b[i]);

/**
 * Volta endings: consecutive measures sharing an identical ending set form a
 * bracket; adjacent brackets form a chain (a first/second-ending group). Each
 * chain's passage numbers must cover 1..max without gaps or overlaps, and
 * every bracket except the one played last must close with a repeat.
 */
const checkEndings = (score: Score): string[] => {
  const messages: string[] = [];
  const chains: VoltaBracket[][] = [];

  score.measures.forEach((measure, i) => {
    const numbers = measure.ending ? [...measure.ending].sort((a, b) => a - b) : null;

    if (!numbers) return;

    const chain = chains.at(-1);
    const bracket = chain?.at(-1);
    const continuesChain = bracket !== undefined && bracket.end === i - 1;

    if (continuesChain && sameNumbers(bracket.numbers, numbers)) {
      bracket.end = i;
    } else if (continuesChain && chain !== undefined) {
      chain.push({ numbers, start: i, end: i });
    } else {
      chains.push([{ numbers, start: i, end: i }]);
    }
  });

  for (const chain of chains) {
    const all = chain.flatMap((bracket) => [...bracket.numbers]);
    const max = Math.max(...all);
    const seen = new Set<number>();

    for (const n of all) {
      if (seen.has(n)) {
        messages.push(
          `The endings starting at measure ${chain[0].start + 1} use passage ${n} more than once`,
        );
      }

      seen.add(n);
    }

    for (let n = 1; n <= max; n++) {
      if (!seen.has(n)) {
        messages.push(
          `The endings starting at measure ${chain[0].start + 1} skip passage ${n} ` +
            `(passages must cover 1 through ${max})`,
        );
      }
    }

    for (const bracket of chain) {
      if (bracket.numbers.includes(max)) continue;

      const last = score.measures[bracket.end];

      if (last.closing !== ClosingBarline.RepeatClose) {
        messages.push(
          `The ending at measures ${bracket.start + 1}–${bracket.end + 1} must close ` +
            `with a repeat (only the final passage continues onward)`,
        );
      }
    }
  }

  return messages;
};

type SoundedElement = Note | Chord;

const tiePitches = (element: SoundedElement): { incoming: Pitch[]; outgoing: Pitch[] } => {
  if (element.kind === 'note') {
    return {
      incoming: element.tie === TieRole.End || element.tie === TieRole.Both ? [element.pitch] : [],
      outgoing:
        element.tie === TieRole.Begin || element.tie === TieRole.Both ? [element.pitch] : [],
    };
  }

  return {
    incoming: element.tones
      .filter((tone) => tone.tie === TieRole.End || tone.tie === TieRole.Both)
      .map((tone) => tone.pitch),
    outgoing: element.tones
      .filter((tone) => tone.tie === TieRole.Begin || tone.tie === TieRole.Both)
      .map((tone) => tone.pitch),
  };
};

type PendingTie = {
  pitch: Pitch;
  measure: number;
};

type VoiceState = {
  pending: PendingTie[];
  openSlurs: number[];
  lastMeasure: number;
};

/**
 * Tie continuity and slur balance, walked per staff and voice index across
 * consecutive measures. A tie connects adjacent sounded elements of the same
 * pitch; a rest or a gap in the voice breaks it. Slur Begins and Ends must
 * balance within each contiguous voice chain.
 */
const checkTiesAndSlurs = (score: Score): string[] => {
  const messages: string[] = [];

  const finalize = (state: VoiceState, label: string) => {
    for (const tie of state.pending) {
      messages.push(
        `${label}: the tie begun on ${Pitch.format(tie.pitch)} in measure ${tie.measure} ` +
          `is never completed`,
      );
    }

    for (const measure of state.openSlurs) {
      messages.push(`${label}: the slur begun in measure ${measure} is never closed`);
    }
  };

  score.staves.forEach((_staff, staffIndex) => {
    const states = new Map<number, VoiceState>();
    const label = (voiceIndex: number) => `Staff ${staffIndex + 1}, voice ${voiceIndex + 1}`;

    score.measures.forEach((measure, i) => {
      const content = measure.contents[staffIndex];

      if (!content) return;

      content.voices.forEach((voice, voiceIndex) => {
        let state = states.get(voiceIndex);

        if (state && state.lastMeasure !== i - 1) {
          finalize(state, label(voiceIndex));
          state = undefined;
        }

        if (!state) {
          state = { pending: [], openSlurs: [], lastMeasure: i };
          states.set(voiceIndex, state);
        }

        state.lastMeasure = i;

        for (const element of voice.elements) {
          if (element.kind === 'dynamic') continue;

          if (element.kind === 'rest') {
            for (const tie of state.pending) {
              messages.push(
                `Measure ${i + 1}, staff ${staffIndex + 1}, voice ${voiceIndex + 1}: the tie ` +
                  `begun on ${Pitch.format(tie.pitch)} in measure ${tie.measure} is ` +
                  `interrupted by a rest`,
              );
            }

            state.pending = [];
            continue;
          }

          const { incoming, outgoing } = tiePitches(element);
          const position = `Measure ${i + 1}, staff ${staffIndex + 1}, voice ${voiceIndex + 1}`;

          for (const tie of state.pending) {
            if (!incoming.some((pitch) => Pitch.equals(pitch, tie.pitch))) {
              messages.push(
                `${position}: the tie begun on ${Pitch.format(tie.pitch)} in ` +
                  `measure ${tie.measure} is not continued here`,
              );
            }
          }

          for (const pitch of incoming) {
            if (!state.pending.some((tie) => Pitch.equals(tie.pitch, pitch))) {
              messages.push(
                `${position}: a tie ends on ${Pitch.format(pitch)} that was never begun`,
              );
            }
          }

          state.pending = outgoing.map((pitch) => ({ pitch, measure: i + 1 }));

          if (element.slur === SlurRole.End || element.slur === SlurRole.Both) {
            if (!state.openSlurs.length) {
              messages.push(`${position}: a slur ends that was never begun`);
            } else {
              state.openSlurs.pop();
            }
          }

          if (element.slur === SlurRole.Begin || element.slur === SlurRole.Both) {
            state.openSlurs.push(i + 1);
          }
        }
      });
    });

    for (const [voiceIndex, state] of states) {
      finalize(state, label(voiceIndex));
    }
  });

  return messages;
};

export const Score = {
  /**
   * Builds a score without structural validation, so drafts are representable.
   * Run `Score.check` before treating the score as coherent.
   */
  of(spec: Score): Score {
    return { ...spec };
  },

  /**
   * Checks whole-score structural coherence: staff alignment, navigation
   * targets, measure fullness, repeat pairing, volta endings, tie continuity,
   * and slur balance. All problems are reported together.
   */
  check(score: Score): Result<void> {
    const messages: string[] = [
      ...checkStaffAlignment(score),
      ...checkNavigation(score),
      ...checkFullness(score),
      ...checkRepeats(score),
      ...checkEndings(score),
      ...checkTiesAndSlurs(score),
    ];

    if (messages.length) return Result.invalid(messages);

    return Result.okNoValue();
  },

  measureCount(score: Score): Count {
    return Count.of(score.measures.length);
  },
};
