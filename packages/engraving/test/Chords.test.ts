import { describe, expect, it } from 'vitest';
import { Clef } from '@scoregrove/domain/Clef';
import { Duration, NoteValue } from '@scoregrove/domain/Duration';
import { Mode } from '@scoregrove/domain/KeySignature';
import { StaffContent, type Measure } from '@scoregrove/domain/Measure';
import { Chord, Note, TieRole, type MeasureElement } from '@scoregrove/domain/MeasureElement';
import { NonEmptyArray } from '@scoregrove/domain/NonEmptyArray';
import { Accidental, PitchClass, PitchLetter, type Pitch } from '@scoregrove/domain/Pitch';
import { PositiveInteger } from '@scoregrove/domain/PositiveInteger';
import { Score } from '@scoregrove/domain/Score';
import { Staff } from '@scoregrove/domain/Staff';
import { BeatUnit } from '@scoregrove/domain/TimeSignature';
import { ContextWalk } from '../src/ContextWalk';
import type { LaidOutChord } from '../src/LayoutTree';
import { MeasureLayout } from '../src/MeasureLayout';
import { StemDirection } from '../src/Stems';
import { SystemLayout } from '../src/SystemLayout';
import { expectOk, pitch } from './helpers';

const chord = (tones: (Pitch | { pitch: Pitch; tie?: TieRole })[], noteValue: NoteValue) =>
  expectOk(Chord.create(tones, Duration.of(noteValue)));

const scoreOf = (elements: MeasureElement[][]): Score =>
  Score.of({
    staves: NonEmptyArray.of([Staff.of(Clef.Treble)]),
    key: { tonic: PitchClass.of(PitchLetter.C), mode: Mode.Major },
    time: { beats: PositiveInteger.of(4), beatUnit: BeatUnit.Quarter },
    measures: NonEmptyArray.of(
      elements.map((measureElements): Measure => ({
        contents: NonEmptyArray.of([StaffContent.singleVoice(NonEmptyArray.of(measureElements))]),
      })),
    ),
  });

const layoutFirst = (score: Score): LaidOutChord[] => {
  const contexts = ContextWalk.walk(score);

  return MeasureLayout.layout({
    contexts: contexts[0],
    measure: score.measures[0],
    measureIndex: 0,
  })[0].elements.filter((e): e is LaidOutChord => e.kind === 'chord');
};

describe('MeasureLayout chords', () => {
  it('stacks a plain triad on one x with a single stem', () => {
    const score = scoreOf([
      [
        chord(
          [pitch(PitchLetter.C, 4), pitch(PitchLetter.E, 4), pitch(PitchLetter.G, 4)],
          NoteValue.Half,
        ),
        chord(
          [pitch(PitchLetter.C, 4), pitch(PitchLetter.E, 4), pitch(PitchLetter.G, 4)],
          NoteValue.Half,
        ),
      ],
    ]);

    const [laid] = layoutFirst(score);

    // All below the middle line: stem up, every tone on the column x
    expect(laid.stem?.direction).toBe(StemDirection.Up);
    laid.tones.forEach((tone) => expect(tone.x).toBe(laid.x));

    // The stem spans from the lowest tone up past the highest
    const ys = laid.tones.map((tone) => tone.position);

    expect(Math.min(...ys)).toBe(-6);
    expect(laid.stem!.top).toBeLessThan(2);
    expect(laid.ledgers).toEqual([-6]);
  });

  it('offsets the upper tone of a second across an up-stem', () => {
    const score = scoreOf([
      [
        chord([pitch(PitchLetter.C, 4), pitch(PitchLetter.D, 4)], NoteValue.Half),
        chord([pitch(PitchLetter.C, 4), pitch(PitchLetter.D, 4)], NoteValue.Half),
      ],
    ]);

    const [laid] = layoutFirst(score);
    const c = laid.tones.find((tone) => tone.position === -6)!;
    const d = laid.tones.find((tone) => tone.position === -5)!;

    expect(c.x).toBe(laid.x);
    expect(d.x).toBeGreaterThan(c.x);
  });

  it('offsets the lower tone of a second across a down-stem', () => {
    const score = scoreOf([
      [
        chord([pitch(PitchLetter.B, 4), pitch(PitchLetter.C, 5)], NoteValue.Half),
        chord([pitch(PitchLetter.B, 4), pitch(PitchLetter.C, 5)], NoteValue.Half),
      ],
    ]);

    const [laid] = layoutFirst(score);
    const b = laid.tones.find((tone) => tone.position === 0)!;
    const c = laid.tones.find((tone) => tone.position === 1)!;

    expect(laid.stem?.direction).toBe(StemDirection.Down);
    expect(c.x).toBe(laid.x);
    expect(b.x).toBeLessThan(c.x);
  });

  it('prints per-tone accidentals only where needed', () => {
    const score = scoreOf([
      [
        chord([pitch(PitchLetter.E, 4, Accidental.Flat), pitch(PitchLetter.G, 4)], NoteValue.Half),
        chord([pitch(PitchLetter.E, 4, Accidental.Flat), pitch(PitchLetter.G, 4)], NoteValue.Half),
      ],
    ]);

    const [first, second] = layoutFirst(score);
    const flatted = first.tones.find((tone) => tone.accidental);

    expect(flatted?.accidental?.glyph).toBe('accidentalFlat');
    expect(first.tones.filter((tone) => tone.accidental)).toHaveLength(1);

    // The flat carries through the measure: the second chord prints nothing
    expect(second.tones.every((tone) => tone.accidental === undefined)).toBe(true);
  });

  it('gives flagged values one flag on the chord, not per tone', () => {
    const score = scoreOf([
      [
        chord([pitch(PitchLetter.C, 4), pitch(PitchLetter.G, 4)], NoteValue.Eighth),
        Note.of(pitch(PitchLetter.C, 4), Duration.of(NoteValue.Eighth)),
        Note.of(pitch(PitchLetter.C, 4), Duration.of(NoteValue.Half)),
        Note.of(pitch(PitchLetter.C, 4), Duration.of(NoteValue.Quarter)),
      ],
    ]);

    const [laid] = layoutFirst(score);

    expect(laid.flag).toBeDefined();
  });
});

describe('Chord ties', () => {
  it('ties chord tones to their continuations per tone', () => {
    const score = scoreOf([
      [
        chord(
          [
            { pitch: pitch(PitchLetter.C, 4), tie: TieRole.Begin },
            { pitch: pitch(PitchLetter.E, 4) },
          ],
          NoteValue.Whole,
        ),
      ],
      [
        chord(
          [
            { pitch: pitch(PitchLetter.C, 4), tie: TieRole.End },
            { pitch: pitch(PitchLetter.E, 4) },
          ],
          NoteValue.Whole,
        ),
      ],
    ]);

    const system = SystemLayout.unbroken(score);

    // Exactly one tie: the C4 tone chain, not the untied E4
    expect(system.ties).toHaveLength(1);
    expect(system.ties[0].x2).toBeGreaterThan(system.ties[0].x1);
  });
});
