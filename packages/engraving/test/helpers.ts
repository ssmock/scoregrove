import { expect } from 'vitest';
import {
  Octave,
  Pitch,
  PitchClass,
  type Accidental,
  type PitchLetter,
} from '@scoregrove/domain/Pitch';
import { Result } from '@scoregrove/domain/Result';

export const pitch = (letter: PitchLetter, octave: number, accidental?: Accidental): Pitch =>
  Pitch.of(PitchClass.of(letter, accidental), Octave.of(octave));

export function expectOk<TValue>(result: Result<TValue>): TValue {
  if (!Result.isOk(result)) {
    expect.fail(`Expected ok, got: ${result.error.messages.join('; ')}`);
  }

  return result.value;
}
