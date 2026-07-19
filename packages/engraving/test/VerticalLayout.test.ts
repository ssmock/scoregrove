import { describe, expect, it } from 'vitest';
import { Clef } from '@scoregrove/domain/Clef';
import { Duration, NoteValue } from '@scoregrove/domain/Duration';
import { Mode } from '@scoregrove/domain/KeySignature';
import { StaffContent, type Measure } from '@scoregrove/domain/Measure';
import { Note, type MeasureElement } from '@scoregrove/domain/MeasureElement';
import { NonEmptyArray } from '@scoregrove/domain/NonEmptyArray';
import { NonEmptyString } from '@scoregrove/domain/NonEmptyString';
import { Lyric } from '@scoregrove/domain/Notations';
import { PitchClass, PitchLetter } from '@scoregrove/domain/Pitch';
import { PositiveInteger } from '@scoregrove/domain/PositiveInteger';
import { Score } from '@scoregrove/domain/Score';
import { Staff } from '@scoregrove/domain/Staff';
import { BeatUnit } from '@scoregrove/domain/TimeSignature';
import { Fixtures } from '../src/Fixtures';
import { LineBreaking } from '../src/LineBreaking';
import { SystemLayout } from '../src/SystemLayout';
import { pitch } from './helpers';

const twoStaffScore = (topElements: MeasureElement[], bottomElements: MeasureElement[]): Score =>
  Score.of({
    staves: NonEmptyArray.of([Staff.of(Clef.Treble), Staff.of(Clef.Bass)]),
    key: { tonic: PitchClass.of(PitchLetter.C), mode: Mode.Major },
    time: { beats: PositiveInteger.of(4), beatUnit: BeatUnit.Quarter },
    measures: NonEmptyArray.of([
      {
        contents: NonEmptyArray.of([
          StaffContent.singleVoice(NonEmptyArray.of(topElements)),
          StaffContent.singleVoice(NonEmptyArray.of(bottomElements)),
        ]),
      } satisfies Measure,
    ]),
  });

const whole = (letter: PitchLetter, octave: number, lyrics?: string[]) =>
  Note.of(
    pitch(letter, octave),
    Duration.of(NoteValue.Whole),
    lyrics
      ? { lyrics: NonEmptyArray.of(lyrics.map((text) => Lyric.of(NonEmptyString.of(text)))) }
      : {},
  );

describe('VerticalLayout', () => {
  it('bounds the melody system by its real content', () => {
    const system = SystemLayout.unbroken(Fixtures.monophonicMelody());

    // Tempo text sits at −4.5 with ~1.8 of ascent above it
    expect(system.top).toBeLessThan(-5);

    // The lyric verse at 9.2 plus descent and margin
    expect(system.bottom).toBeGreaterThan(9.5);
  });

  it('keeps sparse staves at the minimum spacing', () => {
    const system = SystemLayout.unbroken(
      twoStaffScore([whole(PitchLetter.B, 4)], [whole(PitchLetter.D, 3)]),
    );

    expect(system.staffYs).toEqual([0, 10]);
  });

  it('opens up spacing when the upper staff sings two verses', () => {
    const sparse = SystemLayout.unbroken(
      twoStaffScore([whole(PitchLetter.B, 4)], [whole(PitchLetter.D, 3)]),
    );
    const verses = SystemLayout.unbroken(
      twoStaffScore([whole(PitchLetter.B, 4, ['one', 'two'])], [whole(PitchLetter.D, 3)]),
    );

    // Verse 2's baseline is 11.4; the next staff must clear it
    expect(verses.staffYs[1]).toBeGreaterThan(sparse.staffYs[1]);
    expect(verses.staffYs[1]).toBeGreaterThan(12);
  });

  it('opens up spacing when the lower staff reaches high on ledger lines', () => {
    const sparse = SystemLayout.unbroken(
      twoStaffScore([whole(PitchLetter.B, 4)], [whole(PitchLetter.D, 3)]),
    );
    const high = SystemLayout.unbroken(
      // C5 on the bass staff: far above its top line
      twoStaffScore([whole(PitchLetter.B, 4)], [whole(PitchLetter.C, 5)]),
    );

    expect(high.staffYs[1]).toBeGreaterThan(sparse.staffYs[1]);
  });

  it('sizes every broken system from its own content', () => {
    const systems = LineBreaking.breakIntoSystems(Fixtures.monophonicMelody(), { width: 40 });

    systems.forEach((system) => {
      expect(system.top).toBeLessThan(0);
      expect(system.bottom).toBeGreaterThan(system.staffYs[system.staffYs.length - 1] + 4);
    });

    // Only the first system carries the tempo line, so it reaches higher
    expect(systems[0].top).toBeLessThan(systems[1].top);
  });
});
