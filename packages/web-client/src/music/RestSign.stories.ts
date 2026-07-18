import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { NoteValue } from '@scoregrove/domain/Duration';
import RestSign from './RestSign.vue';
import { withStaff } from './storybook';

const meta: Meta<typeof RestSign> = {
  title: 'Music/Symbols/RestSign',
  component: RestSign,
  decorators: [withStaff({ width: 8 })],
  argTypes: {
    noteValue: { control: 'select', options: NoteValue.values },
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Whole: Story = { args: { noteValue: NoteValue.Whole, x: 3 } };
export const Half: Story = { args: { noteValue: NoteValue.Half, x: 3 } };
export const Quarter: Story = { args: { noteValue: NoteValue.Quarter, x: 3 } };
export const Eighth: Story = { args: { noteValue: NoteValue.Eighth, x: 3 } };
export const SixtyFourth: Story = { args: { noteValue: NoteValue.SixtyFourth, x: 3 } };
