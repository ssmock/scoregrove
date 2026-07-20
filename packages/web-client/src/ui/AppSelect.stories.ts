import type { Meta, StoryObj } from '@storybook/vue3-vite';
import AppSelect from './AppSelect.vue';

const meta: Meta<typeof AppSelect> = {
  title: 'UI/AppSelect',
  component: AppSelect,
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Clef: Story = {
  args: {
    label: 'Clef',
    modelValue: 'Treble',
    options: [
      { value: 'Treble', label: 'Treble' },
      { value: 'Bass', label: 'Bass' },
      { value: 'Alto', label: 'Alto' },
    ],
  },
};

export const Flow: Story = {
  args: {
    label: 'Flow',
    modelValue: 'vertical',
    options: [
      { value: 'vertical', label: 'Vertical (wrap)' },
      { value: 'horizontal', label: 'Horizontal (scroll)' },
    ],
  },
};

export const Disabled: Story = {
  args: {
    label: 'Clef',
    modelValue: 'Treble',
    options: [{ value: 'Treble', label: 'Treble' }],
    disabled: true,
  },
};
