import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { StemDirection } from '@scoregrove/engraving/Stems';
import StemView from './StemView.vue';
import { withStaff } from './storybook';

const meta: Meta<typeof StemView> = {
  title: 'Music/Symbols/Stem',
  component: StemView,
  decorators: [withStaff({ width: 8 })],
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Up: Story = {
  args: { stem: { x: 4, top: -1.5, bottom: 2, direction: StemDirection.Up } },
};

export const Down: Story = {
  args: { stem: { x: 4, top: 1.5, bottom: 5, direction: StemDirection.Down } },
};
