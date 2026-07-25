import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { Duration, NoteValue } from '@scoregrove/domain/Duration';
import { NewSection, SectionBreak } from '@scoregrove/domain/Measure';
import { NonEmptyArray } from '@scoregrove/domain/NonEmptyArray';
import { NonEmptyString } from '@scoregrove/domain/NonEmptyString';
import { Fixtures } from '@scoregrove/engraving/Fixtures';
import { withEditorStore } from '../store/storybook';
import { useEditorStore } from '../store/useEditorStore';
import ScoreDisplay from './ScoreDisplay.vue';

const meta: Meta<typeof ScoreDisplay> = {
  title: 'Shell/ScoreDisplay',
  component: ScoreDisplay,
  // ScoreDisplay injects the editor store for playback state, so every story
  // needs one provided or its setup throws and nothing renders at all. Stories
  // that drive the store themselves override this with their own instance.
  decorators: [withEditorStore()],
};

export default meta;

type Story = StoryObj<typeof meta>;

/** The melody fixture with a section opening at measure 2 */
const sectioned = () => {
  const score = Fixtures.monophonicMelody();

  return {
    ...score,
    measures: NonEmptyArray.of(
      score.measures.map((measure, index) =>
        index === 2
          ? {
              ...measure,
              newSection: NewSection.of(NonEmptyString.of('Var. I'), SectionBreak.Page),
            }
          : measure,
      ),
    ),
  };
};

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
/**
 * Horizontal flow is one continuous scrolling line for DAW-style editing, and
 * a section must not interrupt it — no break, no heading. Same fixture as
 * `Horizontal`, with a section on measure 2 that should make no difference.
 */
export const HorizontalWithSection: Story = {
  args: { score: sectioned(), flow: 'horizontal' },
  decorators: [
    (story) => ({
      components: { story },
      template: '<div style="height: 300px; width: 400px;"><story /></div>',
    }),
  ],
};

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
