import type { Meta, StoryObj } from '@storybook/vue3-vite';
import FermataMark from './FermataMark.vue';
import { withStaff } from './storybook';

const meta: Meta<typeof FermataMark> = {
  title: 'Music/Symbols/FermataMark',
  component: FermataMark,
  decorators: [withStaff({ width: 8 })],
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Above: Story = { args: { placement: 'above', x: 3, y: -1.5 } };
export const Below: Story = { args: { placement: 'below', x: 3, y: 5.5 } };
