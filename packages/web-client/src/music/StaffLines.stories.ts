import type { Meta, StoryObj } from '@storybook/vue3-vite';
import StaffLines from './StaffLines.vue';
import { withStaff } from './storybook';

const meta: Meta<typeof StaffLines> = {
  title: 'Music/Primitives/StaffLines',
  component: StaffLines,
  decorators: [withStaff({ showStaff: false })],
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { width: 14 },
};
