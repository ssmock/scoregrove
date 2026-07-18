import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { Fixtures } from '@scoregrove/engraving/Fixtures';
import ScoreView from './ScoreView.vue';

/**
 * The full rendering demo of the strategy: each fixture score through the
 * complete pipeline — context walk, accidentals, stems, spacing, greedy line
 * breaking with justification — into a header plus stacked systems. Drag the
 * width control to watch measures re-break and justify live. The demo deepens
 * as pipeline stages land (beams, ties, multi-voice, multi-staff).
 */
const meta: Meta<typeof ScoreView> = {
  title: 'Music/Full Rendering Demo',
  component: ScoreView,
  argTypes: {
    width: {
      control: { type: 'range', min: 30, max: 200, step: 5 },
      description: 'Available width in staff spaces; drives line breaking',
    },
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

/** Mixed rhythms, accidentals, a dynamic, a tie, and a fermata in G major */
export const Melody: Story = {
  args: { score: Fixtures.monophonicMelody(), width: 70, scale: 12 },
};

/** Repeat barlines, endings, and a Final bar (voltas and signs are later items) */
export const RepeatsAndNavigation: Story = {
  args: { score: Fixtures.repeatsAndNavigation(), width: 70, scale: 12 },
};

/**
 * The two-staff fixture — rendered as its treble staff's first voice only
 * until multi-voice and multi-staff layout land.
 */
export const TwoStaffMultiVoice: Story = {
  args: { score: Fixtures.twoStaffMultiVoice(), width: 70, scale: 12 },
};

/** No explicit width: the score re-breaks as its container resizes */
export const ResizeDriven: Story = {
  args: { score: Fixtures.monophonicMelody(), scale: 10 },
};
