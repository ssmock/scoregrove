import { describe, expect, it } from 'vitest';
import { Duration, NoteValue } from '@scoregrove/domain/Duration';
import { DynamicMark } from '@scoregrove/domain/Dynamic';
import { Mode, KeySignature } from '@scoregrove/domain/KeySignature';
import { Chord, DynamicElement, Note, Rest, TieRole } from '@scoregrove/domain/MeasureElement';
import { Accidental, PitchLetter } from '@scoregrove/domain/Pitch';
import { Accidentals } from '../src/Accidentals';
import { expectOk, pitch } from './helpers';

const gMajor: KeySignature = KeySignature.of(1, Mode.Major);
const quarter = Duration.of(NoteValue.Quarter);

describe('Accidentals.resolve', () => {
  it('prints nothing for notes the key signature already covers', () => {
    const printed = Accidentals.resolve(gMajor, [
      Note.of(pitch(PitchLetter.G, 4), quarter),
      Note.of(pitch(PitchLetter.F, 4), quarter),
    ]);

    expect(printed).toEqual([[undefined], [undefined]]);
  });

  it('prints an accidental where the sounding alteration departs from the key', () => {
    const printed = Accidentals.resolve(gMajor, [
      Note.of(pitch(PitchLetter.C, 5, Accidental.Sharp), quarter),
    ]);

    expect(printed).toEqual([[Accidental.Sharp]]);
  });

  it('carries an accidental for the rest of the measure at that octave', () => {
    const printed = Accidentals.resolve(gMajor, [
      Note.of(pitch(PitchLetter.C, 5, Accidental.Sharp), quarter),
      Note.of(pitch(PitchLetter.C, 5, Accidental.Sharp), quarter),
      Note.of(pitch(PitchLetter.C, 4, Accidental.Sharp), quarter),
    ]);

    expect(printed).toEqual([[Accidental.Sharp], [undefined], [Accidental.Sharp]]);
  });

  it('prints a natural to cancel an earlier accidental', () => {
    const printed = Accidentals.resolve(gMajor, [
      Note.of(pitch(PitchLetter.C, 5, Accidental.Sharp), quarter),
      Note.of(pitch(PitchLetter.C, 5), quarter),
    ]);

    expect(printed).toEqual([[Accidental.Sharp], [Accidental.Natural]]);
  });

  it('prints a natural for an explicit natural against the key', () => {
    const printed = Accidentals.resolve(gMajor, [
      Note.of(pitch(PitchLetter.F, 4, Accidental.Natural), quarter),
      Note.of(pitch(PitchLetter.F, 4), quarter),
    ]);

    expect(printed).toEqual([[Accidental.Natural], [Accidental.Sharp]]);
  });

  it('gives rests and dynamics no accidental slots', () => {
    const printed = Accidentals.resolve(gMajor, [
      Rest.of(quarter),
      DynamicElement.of(DynamicMark.Piano),
    ]);

    expect(printed).toEqual([[], []]);
  });
});

describe('Accidentals.resolve, across a tie', () => {
  const cMajor: KeySignature = KeySignature.of(0, Mode.Major);

  it('does not restate the accidental of a note tied over the barline', () => {
    // The measure opens with the far end of a tie begun in the previous one.
    // The tie carries the sharp; printing it again reads as a fresh alteration.
    const printed = Accidentals.resolve(cMajor, [
      Note.of(pitch(PitchLetter.F, 4, Accidental.Sharp), quarter, { tie: TieRole.End }),
    ]);

    expect(printed).toEqual([[undefined]]);
  });

  it('lets a later note of that pitch print its own accidental', () => {
    // The tied accidental holds for the tied note, not for the bar it lands in,
    // so the second F♯ is judged against the key and states itself.
    const printed = Accidentals.resolve(cMajor, [
      Note.of(pitch(PitchLetter.F, 4, Accidental.Sharp), quarter, { tie: TieRole.End }),
      Note.of(pitch(PitchLetter.G, 4), quarter),
      Note.of(pitch(PitchLetter.F, 4, Accidental.Sharp), quarter),
    ]);

    expect(printed).toEqual([[undefined], [undefined], [Accidental.Sharp]]);
  });

  it('still prints for a tie that begins here rather than arriving', () => {
    const printed = Accidentals.resolve(cMajor, [
      Note.of(pitch(PitchLetter.F, 4, Accidental.Sharp), quarter, { tie: TieRole.Begin }),
    ]);

    expect(printed).toEqual([[Accidental.Sharp]]);
  });

  it('suppresses only at the opening, since a tie within the measure needs no help', () => {
    // The second note receives a tie from the first, where the measure's own
    // state already carries the sharp — nothing prints either way, and the
    // opening rule must not be what does it.
    const printed = Accidentals.resolve(cMajor, [
      Note.of(pitch(PitchLetter.F, 4, Accidental.Sharp), quarter, { tie: TieRole.Begin }),
      Note.of(pitch(PitchLetter.F, 4, Accidental.Sharp), quarter, { tie: TieRole.End }),
    ]);

    expect(printed).toEqual([[Accidental.Sharp], [undefined]]);
  });

  it('looks past a dynamic to find the opening element', () => {
    const printed = Accidentals.resolve(cMajor, [
      DynamicElement.of(DynamicMark.Piano),
      Note.of(pitch(PitchLetter.F, 4, Accidental.Sharp), quarter, { tie: TieRole.End }),
    ]);

    expect(printed).toEqual([[], [undefined]]);
  });

  it('resolves a chord tone by tone, tying some pitches over and striking others', () => {
    const chord = expectOk(
      Chord.create(
        [
          { pitch: pitch(PitchLetter.F, 4, Accidental.Sharp), tie: TieRole.End },
          { pitch: pitch(PitchLetter.B, 4, Accidental.Flat) },
        ],
        quarter,
      ),
    );

    // The tied F♯ says nothing; the struck B♭ states itself
    expect(Accidentals.resolve(cMajor, [chord])).toEqual([[undefined, Accidental.Flat]]);
  });
});
