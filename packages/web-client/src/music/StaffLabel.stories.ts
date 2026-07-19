import type { Meta, StoryObj } from '@storybook/vue3-vite';
import StaffLabel from './StaffLabel.vue';
import { withStaff } from './storybook';

const meta: Meta<typeof StaffLabel> = {
  title: 'Music/Structure/StaffLabel',
  component: StaffLabel,
  decorators: [withStaff({ width: 14 })],
};

export default meta;

type Story = StoryObj<typeof meta>;

export const RightHand: Story = {
  args: { label: 'RH', x: 3 },
};

export const InstrumentName: Story = {
  args: { label: 'Violin', x: 6 },
};
