import { KeySignature } from '@scoregrove/domain/KeySignature';
import { TieRole, type MeasureElement } from '@scoregrove/domain/MeasureElement';
import { Accidental, type Pitch } from '@scoregrove/domain/Pitch';

/**
 * For identity purposes an explicit Natural is the same alteration as no
 * accidental at all (the domain's PitchClass follows the same convention).
 */
const normalize = (accidental: Accidental | undefined): Accidental | undefined =>
  accidental === Accidental.Natural ? undefined : accidental;

const stateKey = (pitch: Pitch): string => `${pitch.pitchClass.letter}${pitch.octave}`;

/** Whether a tie role receives a tie from what came before it */
const receivesTie = (tie: TieRole | undefined): boolean =>
  tie === TieRole.End || tie === TieRole.Both;

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
   * ## A tie across the barline
   *
   * A note tied over a barline does not restate its accidental — the tie is
   * what carries it, and printing it again reads as a second, fresh alteration.
   * Such a note is also **transparent to the rest of the measure**: it does not
   * seed the accidental state, so a later note of the same letter and octave is
   * judged against the key alone and prints its own accidental if it needs one.
   * That is the conventional reading (Gould): the tied accidental holds for the
   * tied note, not for the bar it lands in.
   *
   * Finding those notes needs no lookahead into the previous measure. A tie
   * must be continued by the element immediately following it — `Score.check`
   * enforces exactly that — so a tie *received* anywhere but at a voice's first
   * sounding element came from earlier in the same measure, where the state
   * already carries the alteration and nothing prints anyway. Only the first
   * sounding element can be receiving one from across the barline.
   */
  resolve(key: KeySignature, elements: readonly MeasureElement[]): (Accidental | undefined)[][] {
    const keyAccidentals = KeySignature.accidentals(key);

    const keyAlteration = (pitch: Pitch): Accidental | undefined =>
      keyAccidentals?.letters.includes(pitch.pitchClass.letter)
        ? keyAccidentals.accidental
        : undefined;

    /** Sounding alteration per letter-and-octave, once it departs from the key */
    const state = new Map<string, Accidental | undefined>();

    const resolvePitch = (pitch: Pitch, tiedAcrossBarline: boolean): Accidental | undefined => {
      // The tie carries the alteration, and carries it no further than itself:
      // print nothing, and leave the measure's state untouched.
      if (tiedAcrossBarline) return undefined;

      const written = pitch.pitchClass.accidental;
      const intended = written !== undefined ? normalize(written) : keyAlteration(pitch);
      const carried = state.has(stateKey(pitch))
        ? state.get(stateKey(pitch))
        : keyAlteration(pitch);

      state.set(stateKey(pitch), intended);

      if (intended === carried) return undefined;

      return intended ?? Accidental.Natural;
    };

    /** Only a voice's first sounding element can receive a tie from the previous measure */
    let atFirstSounding = true;

    return elements.map((element) => {
      if (element.kind === 'dynamic') return [];

      const opening = atFirstSounding;

      atFirstSounding = false;

      if (element.kind === 'note') {
        return [resolvePitch(element.pitch, opening && receivesTie(element.tie))];
      }

      if (element.kind === 'chord') {
        // Per tone: a chord may tie some of its pitches over and strike others
        return element.tones.map((tone) =>
          resolvePitch(tone.pitch, opening && receivesTie(tone.tie)),
        );
      }

      return [];
    });
  },
};
