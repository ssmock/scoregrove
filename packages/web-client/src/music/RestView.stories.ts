import type { Meta, StoryObj } from '@storybook/vue3-vite';
import RestView from './RestView.vue';
import { withStaff } from './storybook';

const address = { measure: 0, staff: 0, voice: 0, element: 0 };

const meta: Meta<typeof RestView> = {
  title: 'Music/Composites/Rest',
  component: RestView,
  decorators: [withStaff({ width: 8 })],
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Quarter: Story = {
  args: { rest: { kind: 'rest', address, x: 3, glyph: 'restQuarter', y: 2 } },
};

export const WholeWithFermata: Story = {
  args: {
    rest: {
      kind: 'rest',
      address,
      x: 3,
      glyph: 'restWhole',
      y: 1,
      fermata: { glyph: 'fermataAbove', x: 3, y: -1.5 },
    },
  },
};

export const DottedEighth: Story = {
  args: {
    rest: {
      kind: 'rest',
      address,
      x: 3,
      glyph: 'rest8th',
      y: 2,
      dots: [{ glyph: 'augmentationDot', x: 4.5, y: 1.5 }],
    },
  },
};
