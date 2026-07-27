import { describe, expect, it } from 'vitest';
import { Clef } from '@scoregrove/domain/Clef';
import { Duration, NoteValue } from '@scoregrove/domain/Duration';
import { KeySignature, Mode } from '@scoregrove/domain/KeySignature';
import { StaffContent, type Measure } from '@scoregrove/domain/Measure';
import { Note, TieRole, type MeasureElement } from '@scoregrove/domain/MeasureElement';
import { NonEmptyArray } from '@scoregrove/domain/NonEmptyArray';
import { PitchClass, PitchLetter, Octave, type Pitch } from '@scoregrove/domain/Pitch';
import { PositiveInteger } from '@scoregrove/domain/PositiveInteger';
import { Result } from '@scoregrove/domain/Result';
import { Score } from '@scoregrove/domain/Score';
import { Staff } from '@scoregrove/domain/Staff';
import { BeatUnit } from '@scoregrove/domain/TimeSignature';
import { Compiler } from '../src/Compiler';
import { PerformanceChecks } from '../src/PerformanceChecks';

/** A check that cannot fail is worth nothing, so each of these breaks one thing. */

const pitch = (letter: PitchLetter, octave: number): Pitch => ({
  pitchClass: PitchClass.of(letter),
  octave: Octave.of(octave),
});

const quarter = Duration.of(NoteValue.Quarter);

const scoreOf = (measures: MeasureElement[][], extra: Partial<Measure>[] = []): Score =>
  Score.of({
    staves: NonEmptyArray.of([Staff.of(Clef.Treble)]),
    key: KeySignature.of(0, Mode.Major),
    time: { beats: PositiveInteger.of(4), beatUnit: BeatUnit.Quarter },
    measures: NonEmptyArray.of(
      measures.map((elements, index): Measure => ({
        contents: NonEmptyArray.of([StaffContent.singleVoice(NonEmptyArray.of(elements))]),
        ...extra[index],
      })),
    ),
  });

const bar = (): MeasureElement[] => [
  Note.of(pitch(PitchLetter.C, 5), quarter),
  Note.of(pitch(PitchLetter.D, 5), quarter),
  Note.of(pitch(PitchLetter.E, 5), quarter),
  Note.of(pitch(PitchLetter.F, 5), quarter),
];

const run = (score: Score) => {
  const compiled = Compiler.compile(score);

  if (!Result.isOk(compiled)) throw new Error(compiled.error.messages.join('; '));

  return PerformanceChecks.run(score, compiled.value);
};

const failed = (score: Score) =>
  run(score)
    .filter((check) => !check.passed)
    .map((check) => check.name);

describe('PerformanceChecks', () => {
  it('passes a performance with nothing wrong with it', () => {
    expect(failed(scoreOf([bar(), bar()]))).toEqual([]);
  });

  it('counts a tie chain as one event, not two', () => {
    const tied = scoreOf([
      [
        Note.of(pitch(PitchLetter.C, 5), quarter, { tie: TieRole.Begin }),
        Note.of(pitch(PitchLetter.C, 5), quarter, { tie: TieRole.End }),
        Note.of(pitch(PitchLetter.E, 5), quarter),
        Note.of(pitch(PitchLetter.F, 5), quarter),
      ],
    ]);

    const compiled = Compiler.compile(tied);

    if (!Result.isOk(compiled)) throw new Error('compile');

    // Four written notes, three sounded events — the check's expectation is
    // onsets, so it would fail if the tied note sounded again
    expect(compiled.value.events).toHaveLength(3);
    expect(PerformanceChecks.run(tied, compiled.value).every((check) => check.passed)).toBe(true);
  });

  it('catches a part that stops sounding', () => {
    const score = scoreOf([bar()]);
    const compiled = Compiler.compile(score);

    if (!Result.isOk(compiled)) throw new Error('compile');

    const missing = { ...compiled.value, events: compiled.value.events.slice(0, 2) };
    const names = PerformanceChecks.run(score, missing)
      .filter((check) => !check.passed)
      .map((check) => check.name);

    expect(names).toContain('every part sounds every note it is written');
  });

  it('catches an event of no length', () => {
    const score = scoreOf([bar()]);
    const compiled = Compiler.compile(score);

    if (!Result.isOk(compiled)) throw new Error('compile');

    const degenerate = {
      ...compiled.value,
      events: compiled.value.events.map((event, index) =>
        index === 0 ? { ...event, durationSeconds: 0 } : event,
      ),
    };

    expect(
      PerformanceChecks.run(score, degenerate)
        .filter((check) => !check.passed)
        .map((check) => check.name),
    ).toContain('no event has a zero, negative or unreal length');
  });

  it('catches a duration that does not match tempo and meter', () => {
    const score = scoreOf([bar()]);
    const compiled = Compiler.compile(score);

    if (!Result.isOk(compiled)) throw new Error('compile');

    const stretched = { ...compiled.value, durationSeconds: compiled.value.durationSeconds * 2 };

    expect(
      PerformanceChecks.run(score, stretched)
        .filter((check) => !check.passed)
        .map((check) => check.name),
    ).toContain('the total duration matches tempo times meter');
  });

  it('counts a partial measure by what it holds, not by its meter', () => {
    // A pickup lasts what it sounds; measuring it as a full bar would over-count
    // the performance by the shortfall, once per pass through it.
    const pickup = scoreOf(
      [[Note.of(pitch(PitchLetter.C, 5), quarter)], bar()],
      [{ partial: true }, {}],
    );

    expect(failed(pickup)).toEqual([]);
  });
});
