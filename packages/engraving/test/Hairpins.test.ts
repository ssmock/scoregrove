import { describe, expect, it } from 'vitest';
import { Clef } from '@scoregrove/domain/Clef';
import { Duration, NoteValue } from '@scoregrove/domain/Duration';
import { DynamicChange, DynamicMark } from '@scoregrove/domain/Dynamic';
import { Mode } from '@scoregrove/domain/KeySignature';
import { StaffContent, type Measure } from '@scoregrove/domain/Measure';
import { DynamicElement, Note, type MeasureElement } from '@scoregrove/domain/MeasureElement';
import { NonEmptyArray } from '@scoregrove/domain/NonEmptyArray';
import { PitchClass, PitchLetter } from '@scoregrove/domain/Pitch';
import { PositiveInteger } from '@scoregrove/domain/PositiveInteger';
import { Score } from '@scoregrove/domain/Score';
import { Staff } from '@scoregrove/domain/Staff';
import { BeatUnit } from '@scoregrove/domain/TimeSignature';
import { Fixtures } from '../src/Fixtures';
import type { LaidOutDynamic } from '../src/LayoutTree';
import { LineBreaking } from '../src/LineBreaking';
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

const whole = (letter: PitchLetter) => Note.of(pitch(letter, 4), Duration.of(NoteValue.Whole));

describe('Hairpins', () => {
  it('stretches the melody crescendo from its first note to the forte', () => {
    const system = SystemLayout.unbroken(Fixtures.monophonicMelody());

    expect(system.hairpins).toHaveLength(1);

    const [hairpin] = system.hairpins;

    expect(hairpin.staff).toBe(0);
    expect(hairpin.leftGap).toBe(0);
    expect(hairpin.rightGap).toBeCloseTo(1.1);
    expect(hairpin.x2).toBeGreaterThan(hairpin.x1);

    // The wedge ends before the forte mark it resolves to
    const forte = system.measures[3].staves[0].elements.find(
      (element): element is LaidOutDynamic =>
        element.kind === 'dynamic' && element.glyph === 'dynamicForte',
    );

    expect(forte).toBeDefined();
    expect(hairpin.x2).toBeLessThan(system.measures[3].x + forte!.x);
  });

  it('closes a diminuendo the mirrored way', () => {
    const score = scoreOf([
      [DynamicElement.of(DynamicChange.Diminuendo), whole(PitchLetter.C)],
      [whole(PitchLetter.D)],
      [DynamicElement.of(DynamicMark.Piano), whole(PitchLetter.E)],
    ]);

    const [hairpin] = SystemLayout.unbroken(score).hairpins;

    expect(hairpin.leftGap).toBeCloseTo(1.1);
    expect(hairpin.rightGap).toBe(0);
  });

  it('runs to the end of the music when nothing follows', () => {
    const score = scoreOf([
      [DynamicElement.of(DynamicChange.Crescendo), whole(PitchLetter.C)],
      [whole(PitchLetter.D)],
    ]);

    const system = SystemLayout.unbroken(score);
    const [hairpin] = system.hairpins;

    expect(hairpin).toBeDefined();
    expect(hairpin.x2).toBeGreaterThan(system.measures[1].x);
  });

  it('splits across systems with a continuous taper', () => {
    const score = scoreOf([
      [DynamicElement.of(DynamicChange.Crescendo), whole(PitchLetter.C)],
      [whole(PitchLetter.D)],
      [DynamicElement.of(DynamicMark.Forte), whole(PitchLetter.E)],
    ]);

    // Narrow enough that each measure takes its own system
    const systems = LineBreaking.breakIntoSystems(score, { width: 10 });
    const segments = systems.flatMap((system) => system.hairpins);

    expect(segments.length).toBeGreaterThan(1);
    expect(segments[0].leftGap).toBe(0);
    expect(segments.at(-1)!.rightGap).toBeCloseTo(1.1);

    segments.slice(1).forEach((segment, index) => {
      expect(segment.leftGap).toBeCloseTo(segments[index].rightGap);
    });
  });

  it('drops a change with nothing sounded before the next indication', () => {
    const score = scoreOf([
      [
        DynamicElement.of(DynamicChange.Crescendo),
        DynamicElement.of(DynamicMark.Forte),
        whole(PitchLetter.C),
      ],
    ]);

    expect(SystemLayout.unbroken(score).hairpins).toEqual([]);
  });
});
