import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { Result } from '@scoregrove/domain/Result';
import type { Score } from '@scoregrove/domain/Score';
import { Fixtures } from '@scoregrove/engraving/Fixtures';
import { Compiler, type Performance } from '@scoregrove/playback/Compiler';
import PianoRoll from './PianoRoll.vue';

/**
 * The compiled `Performance` of each fixture, drawn silently. This is the
 * end-to-end proof (and visual regression surface) for the pure playback
 * pipeline: the unfolded play order (repeats/D.S.), tempo, tie folding, and
 * dynamics all show up as bar positions, widths, and opacities.
 */
const compile = (score: Score): Performance => {
  const result = Compiler.compile(score);

  if (!Result.isOk(result)) throw new Error('fixture failed to compile');

  return result.value;
};

const meta: Meta<typeof PianoRoll> = {
  title: 'Playback/PianoRoll',
  component: PianoRoll,
};

export default meta;

type Story = StoryObj<typeof meta>;

/** The monophonic melody — dynamics (p→f) show as opacity, the tie as one longer bar */
export const Melody: Story = {
  args: { performance: compile(Fixtures.monophonicMelody()) },
};

/** Two staves and multiple voices span a wider pitch range */
export const TwoStaffMultiVoice: Story = {
  args: { performance: compile(Fixtures.twoStaffMultiVoice()) },
};

/** Repeats and a D.S. al Fine — measures recur along the timeline in play order */
export const RepeatsAndNavigation: Story = {
  args: { performance: compile(Fixtures.repeatsAndNavigation()) },
};
