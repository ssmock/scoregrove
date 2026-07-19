import { describe, expect, it } from 'vitest';
import { Clef } from '@scoregrove/domain/Clef';
import { Duration, NoteValue } from '@scoregrove/domain/Duration';
import { Mode } from '@scoregrove/domain/KeySignature';
import { StaffContent, type Measure } from '@scoregrove/domain/Measure';
import { Note, type MeasureElement } from '@scoregrove/domain/MeasureElement';
import { NonEmptyArray } from '@scoregrove/domain/NonEmptyArray';
import { SlurRole } from '@scoregrove/domain/Notations';
import { PitchClass, PitchLetter } from '@scoregrove/domain/Pitch';
import { PositiveInteger } from '@scoregrove/domain/PositiveInteger';
import { Score } from '@scoregrove/domain/Score';
import { Staff } from '@scoregrove/domain/Staff';
import { BeatUnit } from '@scoregrove/domain/TimeSignature';
import { Fixtures } from '../src/Fixtures';
import { LineBreaking } from '../src/LineBreaking';
import { StaffPosition } from '../src/StaffPosition';
import { SystemLayout } from '../src/SystemLayout';
import { pitch } from './helpers';

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

const quarter = (letter: PitchLetter, octave: number, slur?: SlurRole) =>
  Note.of(pitch(letter, octave), Duration.of(NoteValue.Quarter), slur ? { slur } : {});

describe('Slurs', () => {
  it('draws the fixture slur across the barline in the upper voice', () => {
    const system = SystemLayout.unbroken(Fixtures.twoStaffMultiVoice());

    expect(system.slurs).toHaveLength(1);

    const [slur] = system.slurs;

    expect(slur.staff).toBe(0);
    expect(slur.x2).toBeGreaterThan(slur.x1);

    // Upper voice stems up, so the slur curves under: controls below endpoints
    expect(slur.cy1).toBeGreaterThan(slur.y1);
  });

  it('clears an intervening higher note', () => {
    const low = () => quarter(PitchLetter.C, 5);
    const highNote = quarter(PitchLetter.A, 5);
    const score = scoreOf([
      [
        quarter(PitchLetter.C, 5, SlurRole.Begin),
        highNote,
        low(),
        quarter(PitchLetter.C, 5, SlurRole.End),
      ],
    ]);

    const system = SystemLayout.unbroken(score);
    const [slur] = system.slurs;

    // C5 stems down (position 1), so the slur curves over; its apex must
    // clear A5's notehead top
    const apexY = (slur.y1 + slur.y2) / 8 + (3 * (slur.cy1 + slur.cy2)) / 8;
    const highTop = StaffPosition.y(StaffPosition.of(Clef.Treble, pitch(PitchLetter.A, 5))) - 0.5;

    expect(apexY).toBeLessThan(highTop);
  });

  it('splits an arc at a system break', () => {
    const measures = [
      [
        quarter(PitchLetter.E, 4, SlurRole.Begin),
        quarter(PitchLetter.F, 4),
        quarter(PitchLetter.G, 4),
        quarter(PitchLetter.A, 4),
      ],
      [
        quarter(PitchLetter.B, 4),
        quarter(PitchLetter.C, 5),
        quarter(PitchLetter.D, 5),
        quarter(PitchLetter.E, 5, SlurRole.End),
      ],
    ];
    const systems = LineBreaking.breakIntoSystems(scoreOf(measures), { width: 12 });
    const withSlurs = systems.filter((system) => system.slurs.length > 0);

    expect(withSlurs).toHaveLength(2);
    expect(withSlurs[0].slurs[0].x2).toBeCloseTo(withSlurs[0].width - 0.5);
  });

  it('drops an unpaired End silently', () => {
    const score = scoreOf([
      [
        quarter(PitchLetter.C, 5, SlurRole.End),
        quarter(PitchLetter.D, 5),
        quarter(PitchLetter.E, 5),
        quarter(PitchLetter.F, 5),
      ],
    ]);

    expect(SystemLayout.unbroken(score).slurs).toEqual([]);
  });
});
