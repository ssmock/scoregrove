import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { NavigationJump, NavigationMark } from '@scoregrove/domain/Navigation';
import NavigationSign from './NavigationSign.vue';
import { withStaff } from './storybook';

const meta: Meta<typeof NavigationSign> = {
  title: 'Music/Symbols/NavigationSign',
  component: NavigationSign,
  decorators: [withStaff({ width: 10 })],
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Segno: Story = { args: { mark: NavigationMark.Segno, x: 3, y: -1.5 } };
export const Coda: Story = { args: { mark: NavigationMark.Coda, x: 3, y: -1.5 } };
export const Fine: Story = { args: { mark: NavigationMark.Fine, x: 3, y: -1.5 } };
export const DalSegnoAlFine: Story = {
  args: { jump: NavigationJump.DalSegnoAlFine, x: 3, y: -1.5 },
};
