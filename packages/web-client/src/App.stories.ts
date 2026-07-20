import type { Meta, StoryObj } from '@storybook/vue3-vite';
import App from './App.vue';
import { withEditorStore } from './store/storybook';

const meta: Meta<typeof App> = {
  title: 'App',
  component: App,
};

export default meta;

type Story = StoryObj<typeof meta>;

/** The editor view, the app's default */
export const Editor: Story = {
  decorators: [withEditorStore()],
};

/** The performance view, switched to before render */
export const Performance: Story = {
  decorators: [withEditorStore({ configure: (store) => store.setView('performance') })],
};
