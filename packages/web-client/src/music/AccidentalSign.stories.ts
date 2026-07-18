import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { Accidental } from '@scoregrove/domain/Pitch';
import AccidentalSign from './AccidentalSign.vue';
import { withStaff } from './storybook';

const meta: Meta<typeof AccidentalSign> = {
  title: 'Music/Symbols/AccidentalSign',
  component: AccidentalSign,
  decorators: [withStaff({ width: 8 })],
  argTypes: {
    accidental: { control: 'select', options: Accidental.values },
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Sharp: Story = { args: { accidental: Accidental.Sharp, position: 1, x: 3 } };
export const Flat: Story = { args: { accidental: Accidental.Flat, position: -1, x: 3 } };
export const Natural: Story = { args: { accidental: Accidental.Natural, position: 0, x: 3 } };
export const DoubleSharp: Story = {
  args: { accidental: Accidental.DoubleSharp, position: 2, x: 3 },
};
export const DoubleFlat: Story = {
  args: { accidental: Accidental.DoubleFlat, position: -2, x: 3 },
};
