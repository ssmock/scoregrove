import type { Meta, StoryObj } from '@storybook/vue3-vite';
import AppTextField from './AppTextField.vue';

const meta: Meta<typeof AppTextField> = {
  title: 'UI/AppTextField',
  component: AppTextField,
};

export default meta;

type Story = StoryObj<typeof meta>;

export const StaffLabel: Story = {
  args: { label: 'Staff label', modelValue: 'RH' },
};

export const ProjectName: Story = {
  args: { label: 'Project name', modelValue: 'Study in G', placeholder: 'Untitled' },
};

export const WithError: Story = {
  args: { label: 'Project name', modelValue: '', error: 'A project name is required' },
};
