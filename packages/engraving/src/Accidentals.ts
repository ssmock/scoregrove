import { KeySignature } from '@scoregrove/domain/KeySignature';
import type { MeasureElement } from '@scoregrove/domain/MeasureElement';
import { Accidental, type Pitch } from '@scoregrove/domain/Pitch';

/**
 * For identity purposes an explicit Natural is the same alteration as no
 * accidental at all (the domain's PitchClass follows the same convention).
 */
const normalize = (accidental: Accidental | undefined): Accidental | undefined =>
  accidental === Accidental.Natural ? undefined : accidental;

const stateKey = (pitch: Pitch): string => `${pitch.pitchClass.letter}${pitch.octave}`;

export const Accidentals = {
  /**
   * Which accidental, if any, must be printed before each sounded pitch of a
   * voice's element sequence within one measure. The key signature and
   * earlier accidentals in the measure carry forward per letter and octave,
   * and a pitch prints an accidental exactly when its sounding alteration
   * differs from what carries forward (a cancellation prints ♮).
   *
   * The result is parallel to `elements`: one entry per element, holding one
   * accidental slot per sounded pitch (a single slot for notes, one per tone
   * for chords, none for rests and dynamics).
   *
   * Ties across barlines do not yet suppress the restated accidental — noted
   * as an assumption in the rendering strategy.
   */
  resolve(key: KeySignature, elements: readonly MeasureElement[]): (Accidental | undefined)[][] {
    const keyAccidentals = KeySignature.accidentals(key);

    const keyAlteration = (pitch: Pitch): Accidental | undefined =>
      keyAccidentals?.letters.includes(pitch.pitchClass.letter)
        ? keyAccidentals.accidental
        : undefined;

    /** Sounding alteration per letter-and-octave, once it departs from the key */
    const state = new Map<string, Accidental | undefined>();

    const resolvePitch = (pitch: Pitch): Accidental | undefined => {
      const written = pitch.pitchClass.accidental;
      const intended = written !== undefined ? normalize(written) : keyAlteration(pitch);
      const carried = state.has(stateKey(pitch))
        ? state.get(stateKey(pitch))
        : keyAlteration(pitch);

      state.set(stateKey(pitch), intended);

      if (intended === carried) return undefined;

      return intended ?? Accidental.Natural;
    };

    return elements.map((element) => {
      if (element.kind === 'note') return [resolvePitch(element.pitch)];
      if (element.kind === 'chord') return element.tones.map((tone) => resolvePitch(tone.pitch));

      return [];
    });
  },
};
