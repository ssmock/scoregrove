import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { NoteValue } from '@scoregrove/domain/Duration';
import { StemDirection } from '@scoregrove/engraving/Stems';
import FlagView from './FlagView.vue';
import { withStaff } from './storybook';

const meta: Meta<typeof FlagView> = {
  title: 'Music/Symbols/Flag',
  component: FlagView,
  decorators: [withStaff({ width: 8 })],
  argTypes: {
    noteValue: { control: 'select', options: NoteValue.values },
    direction: { control: 'select', options: StemDirection.values },
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

export const EighthUp: Story = {
  args: { noteValue: NoteValue.Eighth, direction: StemDirection.Up, x: 4, y: -1 },
};

export const SixteenthDown: Story = {
  args: { noteValue: NoteValue.Sixteenth, direction: StemDirection.Down, x: 4, y: 5 },
};
