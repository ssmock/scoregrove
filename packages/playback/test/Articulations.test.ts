import { describe, expect, it } from 'vitest';
import { Clef } from '@scoregrove/domain/Clef';
import { Duration, NoteValue } from '@scoregrove/domain/Duration';
import { Mode } from '@scoregrove/domain/KeySignature';
import { StaffContent, type Measure } from '@scoregrove/domain/Measure';
import { Note, type MeasureElement } from '@scoregrove/domain/MeasureElement';
import { NonEmptyArray } from '@scoregrove/domain/NonEmptyArray';
import { Articulation } from '@scoregrove/domain/Notations';
import { Octave, Pitch, PitchClass, PitchLetter } from '@scoregrove/domain/Pitch';
import { PositiveInteger } from '@scoregrove/domain/PositiveInteger';
import { Result } from '@scoregrove/domain/Result';
import { Score } from '@scoregrove/domain/Score';
import { Staff } from '@scoregrove/domain/Staff';
import { BeatUnit } from '@scoregrove/domain/TimeSignature';
import { Articulations } from '../src/Articulations';
import { Compiler } from '../src/Compiler';

const c4 = Pitch.of(PitchClass.of(PitchLetter.C), Octave.of(4));
const quarter = Duration.of(NoteValue.Quarter);

const note = (...articulations: Articulation[]): MeasureElement =>
  Note.of(
    c4,
    quarter,
    articulations.length ? { articulations: NonEmptyArray.of(articulations) } : {},
  );

const scoreOf = (elements: MeasureElement[]): Score =>
  Score.of({
    staves: NonEmptyArray.of([Staff.of(Clef.Treble)]),
    key: { tonic: PitchClass.of(PitchLetter.C), mode: Mode.Major },
    time: { beats: PositiveInteger.of(4), beatUnit: BeatUnit.Quarter },
    measures: NonEmptyArray.of([
      { contents: NonEmptyArray.of([StaffContent.singleVoice(NonEmptyArray.of(elements))]) },
    ] as Measure[]),
  });

const events = (elements: MeasureElement[]) => {
  const compiled = Compiler.compile(scoreOf(elements));

  if (!Result.isOk(compiled)) throw new Error(compiled.error.messages.join('; '));

  return compiled.value.events;
};

describe('Articulations', () => {
  it('combines several marks by taking the strongest of each', () => {
    // Short *and* loud, rather than whichever was written first
    const both = Articulations.shapingOf([Articulation.Staccato, Articulation.Accent]);

    expect(both.duration).toBeLessThan(1);
    expect(both.velocity).toBeGreaterThan(1);
  });

  it('leaves an unmarked note alone', () => {
    expect(Articulations.shapingOf([])).toEqual(Articulations.unshaped);
  });

  it('records nothing for elements with no marks', () => {
    expect(Articulations.shapings(scoreOf([note(), note(), note(), note()])).size).toBe(0);
  });
});

describe('Articulations, in a compiled performance', () => {
  it('shortens a staccato note without moving the next one', () => {
    const [first, second] = events([note(Articulation.Staccato), note(), note(), note()]);
    const [plainFirst, plainSecond] = events([note(), note(), note(), note()]);

    // The sound is shorter…
    expect(first.durationSeconds).toBeLessThan(plainFirst.durationSeconds);
    expect(first.durationSeconds).toBeCloseTo(plainFirst.durationSeconds * 0.5, 6);

    // …and nothing has moved: the gap is what detachment sounds like
    expect(first.startSeconds).toBeCloseTo(plainFirst.startSeconds, 9);
    expect(second.startSeconds).toBeCloseTo(plainSecond.startSeconds, 9);
  });

  it('makes staccatissimo shorter than staccato', () => {
    const [staccato] = events([note(Articulation.Staccato), note(), note(), note()]);
    const [staccatissimo] = events([note(Articulation.Staccatissimo), note(), note(), note()]);

    expect(staccatissimo.durationSeconds).toBeLessThan(staccato.durationSeconds);
  });

  it('strikes an accent harder, and a marcato harder still', () => {
    const [plain] = events([note(), note(), note(), note()]);
    const [accented] = events([note(Articulation.Accent), note(), note(), note()]);
    const [marcato] = events([note(Articulation.Marcato), note(), note(), note()]);

    expect(accented.velocity).toBeGreaterThan(plain.velocity);
    expect(marcato.velocity).toBeGreaterThan(accented.velocity);
    expect(accented.durationSeconds).toBeCloseTo(plain.durationSeconds, 9);
  });

  it('never drives a velocity past full', () => {
    // Marcato multiplies, and a loud dynamic could otherwise push it over 1
    const [marcato] = events([note(Articulation.Marcato), note(), note(), note()]);

    expect(marcato.velocity).toBeLessThanOrEqual(1);
  });

  it('leaves tenuto sounding its full length, as an unmarked note already does', () => {
    // A deliberate no-op until unarticulated notes get a shorter default; see
    // the module header.
    const [tenuto] = events([note(Articulation.Tenuto), note(), note(), note()]);
    const [plain] = events([note(), note(), note(), note()]);

    expect(tenuto.durationSeconds).toBeCloseTo(plain.durationSeconds, 9);
  });
});
