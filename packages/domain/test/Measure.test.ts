import { describe, expect, it } from 'vitest';
import { ClosingBarline } from '../src/Barline';
import { Clef } from '../src/Clef';
import { Duration, NoteValue, Tuplet } from '../src/Duration';
import { DynamicMark } from '../src/Dynamic';
import { Measure, StaffContent, Voice } from '../src/Measure';
import { DynamicElement, Note, Rest } from '../src/MeasureElement';
import { NavigationMark } from '../src/Navigation';
import { NonEmptyArray } from '../src/NonEmptyArray';
import { Octave, Pitch, PitchClass, PitchLetter } from '../src/Pitch';
import { PositiveInteger } from '../src/PositiveInteger';
import { BeatUnit, Swing, TimeSignature } from '../src/TimeSignature';
import { expectInvalid, expectOk } from './helpers';

const c4 = Pitch.of(PitchClass.of(PitchLetter.C), Octave.of(4));
const quarter = Duration.of(NoteValue.Quarter);

const elements = () => NonEmptyArray.of([Note.of(c4, quarter)]);
const contents = () => NonEmptyArray.of([StaffContent.singleVoice(elements())]);

describe('Voice', () => {
  it('wraps an element sequence', () => {
    expect(Voice.of(elements())).toEqual({ elements: [Note.of(c4, quarter)] });
  });
});

describe('StaffContent', () => {
  it('holds voices with an optional clef change', () => {
    const voices = NonEmptyArray.of([Voice.of(elements())]);

    expect(StaffContent.of(voices)).toEqual({ voices });
    expect(StaffContent.of(voices, Clef.Alto)).toEqual({ clef: 'Alto', voices });
  });

  it('builds the single-voice case directly', () => {
    expect(StaffContent.singleVoice(elements(), Clef.Bass)).toEqual({
      clef: 'Bass',
      voices: [{ elements: [Note.of(c4, quarter)] }],
    });
  });
});

describe('Measure', () => {
  it('passes a minimal spec through', () => {
    const measure = expectOk(Measure.create({ contents: contents() }));
    expect(measure.contents).toHaveLength(1);
  });

  it('preserves attributes like swing changes', () => {
    const measure = expectOk(Measure.create({ contents: contents(), swing: Swing.Straight }));
    expect(measure.swing).toBe('Straight');
  });

  it('accepts repeatTimes alongside a RepeatClose barline', () => {
    const measure = expectOk(
      Measure.create({
        contents: contents(),
        closing: ClosingBarline.RepeatClose,
        repeatTimes: PositiveInteger.of(3),
      }),
    );
    expect(measure.repeatTimes).toBe(3);
  });

  it('rejects repeatTimes without a RepeatClose barline', () => {
    const error = expectInvalid(
      Measure.create({ contents: contents(), repeatTimes: PositiveInteger.of(3) }),
    );
    expect(error.messages).toEqual(['repeatTimes requires a RepeatClose closing barline']);
  });

  it('rejects repeatTimes below two, aggregating messages', () => {
    const error = expectInvalid(
      Measure.create({ contents: contents(), repeatTimes: PositiveInteger.of(1) }),
    );
    expect(error.messages).toEqual([
      'repeatTimes requires a RepeatClose closing barline',
      'repeatTimes must be at least 2 (the total number of passes)',
    ]);
  });

  it('dedupes navigation marks', () => {
    const measure = expectOk(
      Measure.create({
        contents: contents(),
        marks: NonEmptyArray.of([NavigationMark.Segno, NavigationMark.Segno, NavigationMark.Coda]),
      }),
    );
    expect(measure.marks).toEqual(['Segno', 'Coda']);
  });

  it('dedupes volta ending numbers', () => {
    const measure = expectOk(
      Measure.create({
        contents: contents(),
        ending: NonEmptyArray.of([
          PositiveInteger.of(1),
          PositiveInteger.of(1),
          PositiveInteger.of(2),
        ]),
      }),
    );
    expect(measure.ending).toEqual([1, 2]);
  });
});

describe('Measure.check', () => {
  const threeFour = expectOk(TimeSignature.create(3, BeatUnit.Quarter));

  const measureOf = (...voices: Voice[]): Measure => ({
    contents: NonEmptyArray.of([StaffContent.of(NonEmptyArray.of(voices))]),
  });

  const voice = (
    ...elements: [Note | Rest | DynamicElement, ...(Note | Rest | DynamicElement)[]]
  ) => Voice.of(NonEmptyArray.of(elements));

  it('accepts an exactly full measure', () => {
    expectOk(
      Measure.check(
        threeFour,
        measureOf(voice(Note.of(c4, quarter), Rest.of(quarter), Note.of(c4, quarter))),
      ),
    );
  });

  it('ignores dynamics, which consume no time', () => {
    expectOk(
      Measure.check(
        threeFour,
        measureOf(
          voice(
            DynamicElement.of(DynamicMark.Piano),
            Note.of(c4, quarter),
            Note.of(c4, quarter),
            Note.of(c4, quarter),
          ),
        ),
      ),
    );
  });

  it('accepts exact tuplet arithmetic', () => {
    // Three triplet quarters span a half note (3 in the space of 2), so one
    // more quarter exactly fills 3/4.
    const tripletQuarter = Duration.of(NoteValue.Quarter, { tuplet: Tuplet.triplet() });

    expectOk(
      Measure.check(
        threeFour,
        measureOf(
          voice(
            Note.of(c4, tripletQuarter),
            Note.of(c4, tripletQuarter),
            Note.of(c4, tripletQuarter),
            Note.of(c4, quarter),
          ),
        ),
      ),
    );
  });

  it('rejects an underfull measure with the amounts', () => {
    const error = expectInvalid(Measure.check(threeFour, measureOf(voice(Note.of(c4, quarter)))));
    expect(error.messages).toEqual([
      'staff 1, voice 1 underfills the measure: 1/4 of a whole note; the 3/4 measure holds 3/4',
    ]);
  });

  it('rejects an overfull measure even when underfull is allowed', () => {
    const full = Duration.of(NoteValue.Whole);
    const error = expectInvalid(
      Measure.check(threeFour, measureOf(voice(Note.of(c4, full))), { allowUnderfull: true }),
    );
    expect(error.messages).toEqual([
      'staff 1, voice 1 overfills the measure: 1/1 of a whole note; the 3/4 measure holds 3/4',
    ]);
  });

  it('allows an underfull pickup when requested', () => {
    expectOk(
      Measure.check(threeFour, measureOf(voice(Note.of(c4, quarter))), { allowUnderfull: true }),
    );
  });

  it('checks every voice independently', () => {
    const error = expectInvalid(
      Measure.check(
        threeFour,
        measureOf(
          voice(Note.of(c4, quarter), Note.of(c4, quarter), Note.of(c4, quarter)),
          voice(Note.of(c4, quarter)),
        ),
      ),
    );
    expect(error.messages).toEqual([
      'staff 1, voice 2 underfills the measure: 1/4 of a whole note; the 3/4 measure holds 3/4',
    ]);
  });
});
