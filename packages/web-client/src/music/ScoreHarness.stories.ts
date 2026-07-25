import type { Meta, StoryObj } from '@storybook/vue3-vite';
import type { Score } from '@scoregrove/domain/Score';
import { Fixtures } from '@scoregrove/engraving/Fixtures';
import ScoreView from './ScoreView.vue';

/**
 * The render target for `scripts/haydn.mjs` — not a demo, a harness.
 *
 * The capture script needs to engrave an *arbitrary* score headlessly, and a
 * whole `Score` is far too large to pass through Storybook's URL args. So the
 * script injects one onto `window` before the page loads (via Playwright's
 * `addInitScript`) and this story picks it up. Opened by hand with nothing
 * injected it falls back to a fixture, so it still renders something rather
 * than erroring.
 *
 * Kept deliberately plain: no bar handles, no interaction, no loop region —
 * anything that draws chrome would end up in the captured PNGs.
 */
const harnessKey = '__scoregroveHarnessScore__';

declare global {
  interface Window {
    [harnessKey]?: Score;
  }
}

const injectedScore = (): Score => window[harnessKey] ?? Fixtures.twoStaffMultiVoice();

const meta: Meta<typeof ScoreView> = {
  title: 'Harness/ScoreCapture',
  component: ScoreView,
};

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Width is left unset so `ScoreView` observes its container, letting the
 * capture script choose the engraving width by sizing the viewport.
 */
export const Capture: Story = {
  render: () => ({
    components: { ScoreView },
    setup: () => ({ score: injectedScore() }),
    template: '<ScoreView :score="score" :scale="12" />',
  }),
};
