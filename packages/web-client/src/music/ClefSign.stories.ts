import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { Clef } from '@scoregrove/domain/Clef';
import ClefSign from './ClefSign.vue';
import { withStaff } from './storybook';

const meta: Meta<typeof ClefSign> = {
  title: 'Music/Symbols/ClefSign',
  component: ClefSign,
  decorators: [withStaff({ width: 8 })],
  argTypes: {
    clef: { control: 'select', options: Clef.values },
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Treble: Story = { args: { clef: Clef.Treble, x: 1 } };
export const Bass: Story = { args: { clef: Clef.Bass, x: 1 } };
export const Alto: Story = { args: { clef: Clef.Alto, x: 1 } };
