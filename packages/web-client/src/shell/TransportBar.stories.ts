import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { withEditorStore } from '../store/storybook';
import TransportBar from './TransportBar.vue';

/**
 * The playback controls. Play builds a real audio context on first click (a
 * user gesture, per the autoplay policy), so this story is only truly live in
 * a running browser — the scrubber stays disabled until a score has been
 * played once and has a duration.
 */
const meta: Meta<typeof TransportBar> = {
  title: 'Shell/TransportBar',
  component: TransportBar,
  decorators: [
    withEditorStore(),
    (story) => ({
      components: { story },
      template: '<div style="max-width: 32rem;"><story /></div>',
    }),
  ],
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
