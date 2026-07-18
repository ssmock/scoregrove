import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { NoteValue } from '@scoregrove/domain/Duration';
import NoteheadView from './NoteheadView.vue';
import { withStaff } from './storybook';

const meta: Meta<typeof NoteheadView> = {
  title: 'Music/Symbols/Notehead',
  component: NoteheadView,
  decorators: [withStaff({ width: 8 })],
  argTypes: {
    noteValue: { control: 'select', options: NoteValue.values },
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Black: Story = { args: { noteValue: NoteValue.Quarter, position: 1, x: 3 } };
export const Half: Story = { args: { noteValue: NoteValue.Half, position: -2, x: 3 } };
export const Whole: Story = { args: { noteValue: NoteValue.Whole, position: 0, x: 3 } };
export const Breve: Story = { args: { noteValue: NoteValue.Breve, position: 2, x: 3 } };
