import type { StorybookConfig } from '@storybook/vue3-vite';

// Let Storybook be reached through an ngrok tunnel (see `pnpm tunnels`). A
// leading dot matches all subdomains; harmless for local dev. This has to be
// set in two places: `core.allowedHosts` for Storybook's own dev server (which
// otherwise 403s "Invalid host" on the manager) and Vite's `server.allowedHosts`
// for the preview iframe.
const ngrokHosts = ['.ngrok-free.app', '.ngrok-free.dev', '.ngrok.app', '.ngrok.dev'];

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: ['@storybook/addon-a11y', '@storybook/addon-docs'],
  framework: '@storybook/vue3-vite',
  core: {
    allowedHosts: ngrokHosts,
  },
  async viteFinal(viteConfig) {
    viteConfig.server ??= {};
    viteConfig.server.allowedHosts = ngrokHosts;

    return viteConfig;
  },
};

export default config;
