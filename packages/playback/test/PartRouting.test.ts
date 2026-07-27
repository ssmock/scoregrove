import { describe, expect, it } from 'vitest';
import { Clef } from '@scoregrove/domain/Clef';
import { Mode } from '@scoregrove/domain/KeySignature';
import { NonEmptyArray } from '@scoregrove/domain/NonEmptyArray';
import { NonEmptyString } from '@scoregrove/domain/NonEmptyString';
import { Part } from '@scoregrove/domain/Part';
import { PitchClass, PitchLetter } from '@scoregrove/domain/Pitch';
import { PositiveInteger } from '@scoregrove/domain/PositiveInteger';
import { Score } from '@scoregrove/domain/Score';
import { Staff } from '@scoregrove/domain/Staff';
import { BeatUnit } from '@scoregrove/domain/TimeSignature';
import { PartRouting } from '../src/PartRouting';

const name = (value: string) => NonEmptyString.of(value);

const scoreWith = (staves: Staff[], parts?: Part[]): Score =>
  Score.of({
    staves: NonEmptyArray.of(staves),
    ...(parts ? { parts: NonEmptyArray.of(parts) } : {}),
    key: { tonic: PitchClass.of(PitchLetter.C), mode: Mode.Major },
    time: { beats: PositiveInteger.of(4), beatUnit: BeatUnit.Quarter },
    measures: NonEmptyArray.of([]),
  });

describe('PartRouting', () => {
  it('gives a quartet one player per staff, with its sound', () => {
    const routing = PartRouting.of(
      scoreWith(
        [Staff.of(Clef.Treble), Staff.of(Clef.Treble), Staff.of(Clef.Alto), Staff.of(Clef.Bass)],
        [
          Part.of({ name: name('Violin 1'), sound: name('strings.violin') }),
          Part.of({ name: name('Violin 2'), sound: name('strings.violin') }),
          Part.of({ name: name('Viola'), sound: name('strings.viola') }),
          Part.of({ name: name('Violoncello'), sound: name('strings.cello') }),
        ],
      ),
    );

    expect(routing.partOfStaff).toEqual([0, 1, 2, 3]);
    expect(routing.parts.map((part) => part.sound)).toEqual([
      'strings.violin',
      'strings.violin',
      'strings.viola',
      'strings.cello',
    ]);
  });

  it('routes both staves of a two-staff part to one player', () => {
    // The case that makes routing by part rather than by staff worth the few
    // lines: a pianist handed two instruments would play over themselves.
    const routing = PartRouting.of(
      scoreWith(
        [Staff.of(Clef.Treble), Staff.of(Clef.Bass)],
        [Part.of({ name: name('Piano'), staves: PositiveInteger.of(2) })],
      ),
    );

    expect(routing.partOfStaff).toEqual([0, 0]);
    expect(routing.parts).toHaveLength(1);
  });

  it('falls back to one player per staff when a score has no parts', () => {
    // Every hand-authored fixture: a score that was never told who plays it
    // still has to sound, exactly as it did before parts existed.
    const routing = PartRouting.of(
      scoreWith([Staff.of(Clef.Treble, name('RH')), Staff.of(Clef.Bass, name('LH'))]),
    );

    expect(routing.partOfStaff).toEqual([0, 1]);
    expect(routing.parts.map((part) => part.name)).toEqual(['RH', 'LH']);
  });

  it('plays a staff the parts do not cover rather than silencing it', () => {
    // A `Score.check` failure, but not a reason to drop the music on the floor
    const routing = PartRouting.of(
      scoreWith(
        [Staff.of(Clef.Treble), Staff.of(Clef.Bass), Staff.of(Clef.Bass)],
        [Part.of({ name: name('One') }), Part.of({ name: name('Two') })],
      ),
    );

    expect(routing.partOfStaff).toEqual([0, 1, 1]);
  });

  it('sends an unrouted staff to the first player', () => {
    const routing = PartRouting.of(scoreWith([Staff.of(Clef.Treble)]));

    expect(PartRouting.partOf(routing, 9)).toBe(0);
  });
});
