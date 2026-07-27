import type { Meta, StoryObj } from '@storybook/vue3-vite';
import StaffBracket from './StaffBracket.vue';
import { withStaff } from './storybook';

/**
 * The three group signs, each spanning two staves at the default 10-space
 * separation — so `y2` is the second staff's bottom line, 10 + 4.
 */
const meta: Meta<typeof StaffBracket> = {
  title: 'Music/Symbols/StaffBracket',
  component: StaffBracket,
  decorators: [withStaff({ width: 16 })],
};

export default meta;

type Story = StoryObj<typeof meta>;

/** An instrumental family — what a string quartet's four staves get */
export const Bracket: Story = {
  args: { symbol: 'Bracket', y1: 0, y2: 14 },
};

/** One player's two staves, as on a piano */
export const Brace: Story = {
  args: { symbol: 'Brace', y1: 0, y2: 14 },
};

export const Line: Story = {
  args: { symbol: 'Line', y1: 0, y2: 14 },
};

/** Four staves, the shape the Haydn quartet actually prints */
export const OverFourStaves: Story = {
  args: { symbol: 'Bracket', y1: 0, y2: 34 },
  decorators: [withStaff({ width: 16 })],
};
