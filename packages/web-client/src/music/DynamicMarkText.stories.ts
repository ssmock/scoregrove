import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { DynamicMark } from '@scoregrove/domain/Dynamic';
import DynamicMarkText from './DynamicMarkText.vue';
import { withStaff } from './storybook';

const meta: Meta<typeof DynamicMarkText> = {
  title: 'Music/Symbols/DynamicMarkText',
  component: DynamicMarkText,
  decorators: [withStaff({ width: 8 })],
  argTypes: {
    dynamic: { control: 'select', options: DynamicMark.values },
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Piano: Story = { args: { dynamic: DynamicMark.Piano, x: 3, y: 7 } };
export const Fortissimo: Story = { args: { dynamic: DynamicMark.Fortissimo, x: 3, y: 7 } };
export const Sforzando: Story = { args: { dynamic: DynamicMark.Sforzando, x: 3, y: 7 } };
