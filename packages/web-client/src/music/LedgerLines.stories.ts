import type { Meta, StoryObj } from '@storybook/vue3-vite';
import LedgerLines from './LedgerLines.vue';
import { withStaff } from './storybook';

const meta: Meta<typeof LedgerLines> = {
  title: 'Music/Primitives/LedgerLines',
  component: LedgerLines,
  decorators: [withStaff()],
};

export default meta;

type Story = StoryObj<typeof meta>;

export const AboveTheStaff: Story = {
  args: { x: 4, positions: [6, 8] },
};

export const BelowTheStaff: Story = {
  args: { x: 4, positions: [-6] },
};
