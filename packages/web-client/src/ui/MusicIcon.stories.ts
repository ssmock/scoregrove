import type { Meta, StoryObj } from '@storybook/vue3-vite';
import MusicIcon from './MusicIcon.vue';

const meta: Meta<typeof MusicIcon> = {
  title: 'UI/MusicIcon',
  component: MusicIcon,
};

export default meta;

type Story = StoryObj<typeof meta>;

export const QuarterNote: Story = {
  args: { glyph: 'noteheadBlack', size: 32 },
};

export const QuarterRest: Story = {
  args: { glyph: 'restQuarter', size: 32 },
};

export const TrebleClef: Story = {
  args: { glyph: 'gClef', size: 32 },
};

/** The size these render at inside AppButton's icon slot */
export const PalletSize: Story = {
  args: { glyph: 'noteheadHalf', size: 18 },
};
