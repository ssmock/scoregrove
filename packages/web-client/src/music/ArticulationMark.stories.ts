import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { Articulation } from '@scoregrove/domain/Notations';
import ArticulationMark from './ArticulationMark.vue';
import { withStaff } from './storybook';

const meta: Meta<typeof ArticulationMark> = {
  title: 'Music/Symbols/ArticulationMark',
  component: ArticulationMark,
  decorators: [withStaff({ width: 8 })],
  argTypes: {
    articulation: { control: 'select', options: Articulation.values },
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

export const StaccatoAbove: Story = {
  args: { articulation: Articulation.Staccato, placement: 'above', x: 3.5, y: -0.8 },
};

export const AccentBelow: Story = {
  args: { articulation: Articulation.Accent, placement: 'below', x: 3.5, y: 4.8 },
};

export const Marcato: Story = {
  args: { articulation: Articulation.Marcato, placement: 'above', x: 3.5, y: -0.8 },
};
