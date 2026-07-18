import type { Meta, StoryObj } from '@storybook/vue3-vite';
import AugmentationDots from './AugmentationDots.vue';
import { withStaff } from './storybook';

const meta: Meta<typeof AugmentationDots> = {
  title: 'Music/Symbols/AugmentationDots',
  component: AugmentationDots,
  decorators: [withStaff({ width: 8 })],
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Dotted: Story = {
  args: { dots: [{ glyph: 'augmentationDot', x: 4, y: 1.5 }] },
};

export const DoubleDotted: Story = {
  args: {
    dots: [
      { glyph: 'augmentationDot', x: 4, y: 1.5 },
      { glyph: 'augmentationDot', x: 4.8, y: 1.5 },
    ],
  },
};
