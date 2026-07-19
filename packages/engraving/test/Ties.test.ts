import { describe, expect, it } from 'vitest';
import { Clef } from '@scoregrove/domain/Clef';
import { Duration, NoteValue } from '@scoregrove/domain/Duration';
import { Mode } from '@scoregrove/domain/KeySignature';
import { StaffContent, type Measure } from '@scoregrove/domain/Measure';
import { Note, TieRole, type MeasureElement } from '@scoregrove/domain/MeasureElement';
import { NonEmptyArray } from '@scoregrove/domain/NonEmptyArray';
import { PitchClass, PitchLetter } from '@scoregrove/domain/Pitch';
import { PositiveInteger } from '@scoregrove/domain/PositiveInteger';
import { Score } from '@scoregrove/domain/Score';
import { Staff } from '@scoregrove/domain/Staff';
import { BeatUnit } from '@scoregrove/domain/TimeSignature';
import { Fixtures } from '../src/Fixtures';
import { LineBreaking } from '../src/LineBreaking';
import { SystemLayout } from '../src/SystemLayout';
import { pitch } from './helpers';

const melody = Fixtures.monophonicMelody();

describe('Ties on one system', () => {
  it('draws the melody tie from the Begin note to the End note', () => {
    const system = SystemLayout.unbroken(melody);

    expect(system.ties).toHaveLength(1);

    const [tie] = system.ties;

    expect(tie.x2).toBeGreaterThan(tie.x1);
    expect(tie.y1).toBe(tie.y2);

    // D5 stems down, so the tie curves over: controls above the endpoints
    expect(tie.cy1).toBeLessThan(tie.y1);
    expect(tie.cy2).toBeLessThan(tie.y2);
  });

  it('spans from the third measure into the fourth', () => {
    const system = SystemLayout.unbroken(melody);
    const [tie] = system.ties;
    const third = system.measures[2];
    const fourth = system.measures[3];

    expect(tie.x1).toBeGreaterThan(third.x);
    expect(tie.x2).toBeGreaterThan(fourth.x);
    expect(tie.x2).toBeLessThan(fourth.x + fourth.staves[0].width);
  });
});

describe('Ties across a system break', () => {
  it('splits into an open-ended arc on each system', () => {
    // Narrow enough that every measure gets its own system
    const systems = LineBreaking.breakIntoSystems(melody, { width: 10 });
    const withTies = systems.filter((system) => system.ties.length > 0);

    expect(withTies).toHaveLength(2);

    const [outgoing, incoming] = withTies;

    // The outgoing half runs to the system edge; the incoming reopens before its note
    expect(outgoing.ties[0].x2).toBeCloseTo(outgoing.width - 0.5);
    expect(incoming.ties[0].x1).toBeLessThan(incoming.ties[0].x2);
    expect(outgoing.ties[0].y1).toBeCloseTo(incoming.ties[0].y2);
  });
});

describe('Ties draft tolerance', () => {
  it('drops a tie whose continuation does not match', () => {
    const time = { beats: PositiveInteger.of(4), beatUnit: BeatUnit.Quarter };
    const measure = (elements: MeasureElement[]): Measure => ({
      contents: NonEmptyArray.of([StaffContent.singleVoice(NonEmptyArray.of(elements))]),
    });

    const score = Score.of({
      staves: NonEmptyArray.of([Staff.of(Clef.Treble)]),
      key: { tonic: PitchClass.of(PitchLetter.C), mode: Mode.Major },
      time,
      measures: NonEmptyArray.of([
        measure([
          Note.of(pitch(PitchLetter.G, 4), Duration.of(NoteValue.Half), { tie: TieRole.Begin }),
          // The "continuation" is a different pitch: an invalid draft
          Note.of(pitch(PitchLetter.A, 4), Duration.of(NoteValue.Half)),
        ]),
      ]),
    });

    expect(SystemLayout.unbroken(score).ties).toEqual([]);
  });
});
