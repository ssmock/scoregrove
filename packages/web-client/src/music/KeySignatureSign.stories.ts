import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { Clef } from '@scoregrove/domain/Clef';
import { Mode, KeySignature } from '@scoregrove/domain/KeySignature';
import { Accidental, PitchClass, PitchLetter } from '@scoregrove/domain/Pitch';
import KeySignatureSign from './KeySignatureSign.vue';
import { withStaff } from './storybook';
import { Result } from '@scoregrove/domain/Result';

const key = (letter: PitchLetter, mode: Mode, accidental?: Accidental): KeySignature => {
  const signature = KeySignature.ofTonic(PitchClass.of(letter, accidental), mode);

  // These are literals in fixtures and stories, so a failure is a typo in the
  // file rather than bad data at runtime.
  if (!Result.isOk(signature)) throw new Error(`${letter} ${mode} is not a standard key`);

  return signature.value;
};

const meta: Meta<typeof KeySignatureSign> = {
  title: 'Music/Symbols/KeySignatureSign',
  component: KeySignatureSign,
  decorators: [withStaff({ width: 10 })],
};

export default meta;

type Story = StoryObj<typeof meta>;

export const DMajorTreble: Story = {
  args: { clef: Clef.Treble, keySignature: key(PitchLetter.D, Mode.Major), x: 1 },
};

export const EFlatMajorTreble: Story = {
  args: {
    clef: Clef.Treble,
    keySignature: key(PitchLetter.E, Mode.Major, Accidental.Flat),
    x: 1,
  },
};

export const BMajorBass: Story = {
  args: { clef: Clef.Bass, keySignature: key(PitchLetter.B, Mode.Major), x: 1 },
};

export const FSharpMinorAlto: Story = {
  args: {
    clef: Clef.Alto,
    keySignature: key(PitchLetter.F, Mode.Minor, Accidental.Sharp),
    x: 1,
  },
};

/** The tenor sharp exception: F♯ and G♯ drop an octave, so the run ascends. */
export const BMajorTenor: Story = {
  args: { clef: Clef.Tenor, keySignature: key(PitchLetter.B, Mode.Major), x: 1 },
};

export const EFlatMajorTenor: Story = {
  args: {
    clef: Clef.Tenor,
    keySignature: key(PitchLetter.E, Mode.Major, Accidental.Flat),
    x: 1,
  },
};
