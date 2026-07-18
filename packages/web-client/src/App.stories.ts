import type { Meta, StoryObj } from '@storybook/vue3-vite';
import App from './App.vue';

const meta: Meta<typeof App> = {
  title: 'App',
  component: App,
};

export default meta;

type Story = StoryObj<typeof meta>;

const mockCounterEndpoint = (respond: () => Promise<Response>) => [
  async () => {
    globalThis.fetch = respond;
  },
];

export const Loaded: Story = {
  loaders: mockCounterEndpoint(
    async () => new Response(JSON.stringify({ value: 3 }), { status: 200 }),
  ),
};

export const ServerUnavailable: Story = {
  loaders: mockCounterEndpoint(async () => {
    throw new Error('Network error');
  }),
};
