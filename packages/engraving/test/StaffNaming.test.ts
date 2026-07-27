import { describe, expect, it } from 'vitest';
import { NonEmptyArray } from '@scoregrove/domain/NonEmptyArray';
import { NonEmptyString } from '@scoregrove/domain/NonEmptyString';
import { Part } from '@scoregrove/domain/Part';
import { PositiveInteger } from '@scoregrove/domain/PositiveInteger';
import { Score } from '@scoregrove/domain/Score';
import { Staff } from '@scoregrove/domain/Staff';
import { Clef } from '@scoregrove/domain/Clef';
import { KeySignature } from '@scoregrove/domain/KeySignature';
import { TimeSignature } from '@scoregrove/domain/TimeSignature';
import { Fixtures } from '../src/Fixtures';
import { StaffNaming } from '../src/StaffNaming';

const name = (value: string) => NonEmptyString.of(value);

/** A score with the given staves and parts, and one borrowed measure to be valid */
const scoreWith = (staves: Staff[], parts?: Part[]): Score => {
  const base = Fixtures.twoStaffMultiVoice();

  return Score.of({
    ...base,
    staves: NonEmptyArray.of(staves),
    ...(parts ? { parts: NonEmptyArray.of(parts) } : {}),
    key: base.key satisfies KeySignature,
    time: base.time satisfies TimeSignature,
  });
};

describe('StaffNaming', () => {
  it('prefers a part name over a staff label, and abbreviates after the first system', () => {
    const names = StaffNaming.of(
      scoreWith(
        [Staff.of(Clef.Treble, name('ignored')), Staff.of(Clef.Bass)],
        [
          Part.of({ name: name('Violin I'), abbreviation: name('Vln. I') }),
          Part.of({ name: name('Violoncello'), abbreviation: name('Vc.') }),
        ],
      ),
    );

    expect(names.full).toEqual(['Violin I', 'Violoncello']);
    expect(names.short).toEqual(['Vln. I', 'Vc.']);
  });

  it('falls back to the full name when a part has no abbreviation', () => {
    // The Haydn corpus has no <part-abbreviation> anywhere, so this is the
    // case that actually runs until we author the short forms ourselves.
    const names = StaffNaming.of(
      scoreWith(
        [Staff.of(Clef.Treble), Staff.of(Clef.Bass)],
        [Part.of({ name: name('Viola') }), Part.of({ name: name('Violoncello') })],
      ),
    );

    expect(names.short).toEqual(['Viola', 'Violoncello']);
  });

  it('names only the first staff of a part that spans two', () => {
    // A piano under a brace prints one name against the pair, not two
    const names = StaffNaming.of(
      scoreWith(
        [Staff.of(Clef.Treble), Staff.of(Clef.Bass)],
        [Part.of({ name: name('Piano'), staves: PositiveInteger.of(2) })],
      ),
    );

    expect(names.full).toEqual(['Piano', undefined]);
  });

  it('keeps a staff label when the score has no parts at all', () => {
    const names = StaffNaming.of(scoreWith([Staff.of(Clef.Treble, name('RH'))]));

    expect(names.full).toEqual(['RH']);
  });

  it('sizes the margin to the widest label rather than a fixed guess', () => {
    const short = StaffNaming.of(scoreWith([Staff.of(Clef.Treble, name('RH'))]));
    const long = StaffNaming.of(scoreWith([Staff.of(Clef.Treble, name('Violoncello'))]));

    expect(long.margin).toBeGreaterThan(short.margin);
  });

  it('reserves nothing when there is nothing to print', () => {
    expect(StaffNaming.of(scoreWith([Staff.of(Clef.Treble)])).margin).toBe(0);
  });

  it('measures with the injected measurer rather than assuming one', () => {
    const wide = StaffNaming.of(
      scoreWith([Staff.of(Clef.Treble, name('Vln'))]),
      (text) => text.length * 3,
    );

    expect(wide.margin).toBe(3 * 3 + 1);
  });
});
