import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { ContextWalk } from '@scoregrove/engraving/ContextWalk';
import { Fixtures } from '@scoregrove/engraving/Fixtures';
import { MeasureLayout } from '@scoregrove/engraving/MeasureLayout';
import TupletBracket from './TupletBracket.vue';
import { withStaff } from './storybook';

/** The repeats fixture's half-note triplet, straight from the pipeline */
const piece = Fixtures.repeatsAndNavigation();
const fixtureTuplet = MeasureLayout.layout({
  contexts: ContextWalk.walk(piece)[3],
  measure: piece.measures[3],
  measureIndex: 3,
})[0].tuplets[0];

const meta: Meta<typeof TupletBracket> = {
  title: 'Music/Symbols/TupletBracket',
  component: TupletBracket,
  decorators: [withStaff({ width: 16 })],
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Bracketed: Story = {
  args: { tuplet: { x1: 2, x2: 12, y: -2, label: '3', bracket: true } },
};

export const NumberOnly: Story = {
  args: { tuplet: { x1: 2, x2: 12, y: -2, label: '3', bracket: false } },
};

export const FromThePipeline: Story = {
  args: { tuplet: fixtureTuplet },
  decorators: [withStaff({ width: 26 })],
};
