import { Clef } from '@scoregrove/domain/Clef';
import { Octave, Pitch, PitchClass, PitchLetter } from '@scoregrove/domain/Pitch';

/**
 * A vertical location on a five-line staff, counted in half staff spaces from
 * the middle line: 0 is the middle line, positive is upward, so +1 is the
 * space above the middle line, +4 the top line, and −4 the bottom line. Even
 * values are lines, odd values spaces.
 */
export type StaffPosition = number;

const letterSteps: Record<PitchLetter, number> = {
  C: 0,
  D: 1,
  E: 2,
  F: 3,
  G: 4,
  A: 5,
  B: 6,
};

/** `letterSteps` inverted, indexed by diatonic step mod 7 */
const lettersByStep: readonly PitchLetter[] = [
  PitchLetter.C,
  PitchLetter.D,
  PitchLetter.E,
  PitchLetter.F,
  PitchLetter.G,
  PitchLetter.A,
  PitchLetter.B,
];

/**
 * Diatonic steps of a pitch above C0, ignoring accidentals — the scale that
 * staff geometry works in.
 */
const diatonicIndex = (pitch: Pitch): number =>
  pitch.octave * 7 + letterSteps[pitch.pitchClass.letter];

/**
 * The diatonic index of the pitch whose notehead sits on each clef's middle
 * line: B4 for treble, D3 for bass, C4 for alto.
 */
const middleLineIndex: Record<Clef, number> = {
  Treble: 4 * 7 + letterSteps.B,
  Bass: 3 * 7 + letterSteps.D,
  Alto: 4 * 7 + letterSteps.C,
};

export const StaffPosition = {
  of(clef: Clef, pitch: Pitch): StaffPosition {
    return diatonicIndex(pitch) - middleLineIndex[clef];
  },

  /**
   * The inverse of `of`: the bare-letter pitch (no accidental) sitting at a
   * staff position for a clef. Deliberately never spells an accidental — an
   * absent accidental already means "follow the key signature" (the
   * domain's own convention), so a click at this position sounds exactly as
   * the key dictates without this function needing to know the key at all.
   * Overriding to a different accidental is a later, explicit edit (the
   * right-click flyout), not something clicking the staff itself decides.
   */
  pitch(clef: Clef, position: StaffPosition): Pitch {
    const index = position + middleLineIndex[clef];
    const octave = Math.floor(index / 7);
    const letter = lettersByStep[((index % 7) + 7) % 7];

    return Pitch.of(PitchClass.of(letter), Octave.of(octave));
  },

  /**
   * The y coordinate of a staff position, in staff spaces with the origin on
   * the staff's top line and y increasing downward (the SVG convention used
   * throughout the layout tree). The middle line is y 2; each position moves
   * half a space.
   */
  y(position: StaffPosition): number {
    return 2 - position / 2;
  },

  /**
   * The positions of the ledger lines a notehead at the given position needs:
   * even positions from ±6 out to the notehead, nearest the staff first.
   * Empty for positions within the staff.
   */
  ledgerLines(position: StaffPosition): StaffPosition[] {
    const lines: StaffPosition[] = [];

    if (position >= 6) {
      for (let line = 6; line <= position; line += 2) lines.push(line);
    }

    if (position <= -6) {
      for (let line = -6; line >= position; line -= 2) lines.push(line);
    }

    return lines;
  },
};
