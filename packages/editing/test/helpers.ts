import { expect } from 'vitest';
import { Mode } from '@scoregrove/domain/KeySignature';
import type { Measure } from '@scoregrove/domain/Measure';
import { NonEmptyArray } from '@scoregrove/domain/NonEmptyArray';
import { Octave, Pitch, PitchClass, PitchLetter, type Accidental } from '@scoregrove/domain/Pitch';
import { Result } from '@scoregrove/domain/Result';
import { Score } from '@scoregrove/domain/Score';
import type { Staff } from '@scoregrove/domain/Staff';
import type { TimeSignature } from '@scoregrove/domain/TimeSignature';

export const pitch = (letter: PitchLetter, octave: number, accidental?: Accidental): Pitch =>
  Pitch.of(PitchClass.of(letter, accidental), Octave.of(octave));

export function expectOk<TValue>(result: Result<TValue>): TValue {
  if (!Result.isOk(result)) {
    expect.fail(`Expected ok, got: ${result.error.messages.join('; ')}`);
  }

  return result.value;
}

export function expectInvalid<TValue>(result: Result<TValue>): string[] {
  if (!Result.isError(result)) {
    expect.fail('Expected an error, got ok');
  }

  return result.error.messages;
}

/** A minimal, structurally valid score for exercising editing operations */
export function buildScore(args: {
  time: TimeSignature;
  staves: readonly Staff[];
  measures: readonly Measure[];
}): Score {
  return Score.of({
    staves: NonEmptyArray.of([...args.staves]),
    key: { tonic: PitchClass.of(PitchLetter.C), mode: Mode.Major },
    time: args.time,
    measures: NonEmptyArray.of([...args.measures]),
  });
}

/**
 * The invariant every editing operation must uphold: applying it never
 * leaves the score structurally invalid. Every place/erase test in this
 * suite runs its result through this.
 */
export function expectScoreCheckOk(score: Score): void {
  const result = Score.check(score);

  if (Result.isError(result)) {
    expect.fail(`Score.check failed: ${result.error.messages.join('; ')}`);
  }
}
