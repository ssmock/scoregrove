import type { Meta, StoryObj } from '@storybook/vue3-vite';
import AppCheckbox from './AppCheckbox.vue';

const meta: Meta<typeof AppCheckbox> = {
  title: 'UI/AppCheckbox',
  component: AppCheckbox,
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Checked: Story = {
  args: { label: 'Visible', modelValue: true },
};

export const Unchecked: Story = {
  args: { label: 'Visible', modelValue: false },
};

export const Disabled: Story = {
  args: { label: 'Visible', modelValue: true, disabled: true },
};
