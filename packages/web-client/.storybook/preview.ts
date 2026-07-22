import type { Preview } from '@storybook/vue3-vite';
import '../src/ui/tokens.css';
import '../src/music/smufl.css';
// Guarded entirely by `@media print`, so this has no effect on ordinary
// (screen) story rendering — imported here so a print-media emulation
// (e.g. `scripts/print-preview.mjs`) actually exercises the same rules the
// real app's `main.ts` loads, instead of silently seeing none of them.
import '../src/shell/print.css';
import { loadMusicFont } from '../src/music/fonts';

const preview: Preview = {
  loaders: [
    async () => {
      // Music glyphs render as tofu until Bravura is ready
      await loadMusicFont();

      return {};
    },
  ],

  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },

    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: 'todo',
    },
  },
};

export default preview;
