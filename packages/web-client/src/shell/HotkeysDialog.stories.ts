import type { Meta, StoryObj } from '@storybook/vue3-vite';
import HotkeysDialog from './HotkeysDialog.vue';

const meta: Meta<typeof HotkeysDialog> = {
  title: 'Shell/HotkeysDialog',
  component: HotkeysDialog,
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Open: Story = {
  args: { open: true },
};
