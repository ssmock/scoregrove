import type { Meta, StoryObj } from '@storybook/vue3-vite';
import ConfirmDialog from './ConfirmDialog.vue';

const meta: Meta<typeof ConfirmDialog> = {
  title: 'UI/ConfirmDialog',
  component: ConfirmDialog,
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    open: true,
    title: 'Remove staff?',
    message: 'This removes the staff and its music from every measure.',
  },
};

export const Danger: Story = {
  args: {
    open: true,
    title: 'Delete project?',
    message: '"Study in G" will be permanently deleted.',
    confirmLabel: 'Delete',
    danger: true,
  },
};
