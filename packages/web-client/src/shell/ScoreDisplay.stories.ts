import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { Duration, NoteValue } from '@scoregrove/domain/Duration';
import { Fixtures } from '@scoregrove/engraving/Fixtures';
import { withEditorStore } from '../store/storybook';
import { useEditorStore } from '../store/useEditorStore';
import ScoreDisplay from './ScoreDisplay.vue';

const meta: Meta<typeof ScoreDisplay> = {
  title: 'Shell/ScoreDisplay',
  component: ScoreDisplay,
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Vertical: Story = {
  args: { score: Fixtures.monophonicMelody(), flow: 'vertical' },
  decorators: [
    (story) => ({ components: { story }, template: '<div style="height: 400px;"><story /></div>' }),
  ],
};

export const Horizontal: Story = {
  args: { score: Fixtures.monophonicMelody(), flow: 'horizontal' },
  decorators: [
    (story) => ({
      components: { story },
      template: '<div style="height: 300px; width: 400px;"><story /></div>',
    }),
  ],
};

/** A hidden staff never reaches the renderer at all */
export const WithAHiddenStaff: Story = {
  args: {
    score: Fixtures.twoStaffMultiVoice(),
    flow: 'vertical',
    hiddenStaves: new Set([1]),
  },
  decorators: [
    (story) => ({ components: { story }, template: '<div style="height: 300px;"><story /></div>' }),
  ],
};

/**
 * The editor's clickable staff, with a quarter-note tool pre-selected: hover
 * to see the ghost preview snap to the nearest pitch, click to place, and
 * right-click a placed note to open the editing flyout. Renders straight
 * from the story's own store (not the static `score` arg) so placing a note
 * actually re-renders — a plain `args.score` wouldn't reflect the store's
 * internal mutations.
 */
export const Interactive: Story = {
  args: { flow: 'vertical', interactive: true },
  decorators: [
    withEditorStore({
      initial: Fixtures.monophonicMelody(),
      configure: (store) =>
        store.selectTool({ kind: 'note', duration: Duration.of(NoteValue.Quarter) }),
    }),
  ],
  render: (args) => ({
    components: { ScoreDisplay },
    setup() {
      const store = useEditorStore();

      return { args, store };
    },
    template:
      '<div style="height: 400px;"><ScoreDisplay v-bind="args" :score="store.state.score" :flow="store.state.flow" /></div>',
  }),
};
