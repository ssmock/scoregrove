import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  server: {
    // Allow the dev server to be reached through an ngrok tunnel (see
    // `pnpm tunnels`); a leading dot matches all subdomains. Harmless for
    // local dev, where requests come from localhost.
    allowedHosts: ['.ngrok-free.app', '.ngrok-free.dev', '.ngrok.app', '.ngrok.dev'],
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
  test: {
    environment: 'happy-dom',
  },
});
