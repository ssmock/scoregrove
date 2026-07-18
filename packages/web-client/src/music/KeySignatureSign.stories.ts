import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { Clef } from '@scoregrove/domain/Clef';
import { Mode, type KeySignature } from '@scoregrove/domain/KeySignature';
import { Accidental, PitchClass, PitchLetter } from '@scoregrove/domain/Pitch';
import KeySignatureSign from './KeySignatureSign.vue';
import { withStaff } from './storybook';

const key = (letter: PitchLetter, mode: Mode, accidental?: Accidental): KeySignature => ({
  tonic: PitchClass.of(letter, accidental),
  mode,
});

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
