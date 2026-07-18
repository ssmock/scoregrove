import type { Meta, StoryObj } from '@storybook/vue3-vite';
import BarlineView from './BarlineView.vue';
import { withStaff } from './storybook';

const meta: Meta<typeof BarlineView> = {
  title: 'Music/Primitives/Barline',
  component: BarlineView,
  decorators: [withStaff({ width: 10 })],
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Regular: Story = { args: { kind: 'Regular', x: 8 } };
export const Double: Story = { args: { kind: 'Double', x: 8 } };
export const Final: Story = { args: { kind: 'Final', x: 8 } };
export const RepeatOpen: Story = { args: { kind: 'RepeatOpen', x: 2 } };
export const RepeatClose: Story = { args: { kind: 'RepeatClose', x: 8 } };
