import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { Fixtures } from '@scoregrove/engraving/Fixtures';
import { SystemLayout } from '@scoregrove/engraving/SystemLayout';
import HairpinView from './HairpinView.vue';
import { withStaff } from './storybook';

const meta: Meta<typeof HairpinView> = {
  title: 'Music/Symbols/Hairpin',
  component: HairpinView,
  decorators: [withStaff({ width: 14 })],
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Crescendo: Story = {
  args: { hairpin: { x1: 2, x2: 12, y: 7, leftGap: 0, rightGap: 1.1 } },
};

export const Diminuendo: Story = {
  args: { hairpin: { x1: 2, x2: 12, y: 7, leftGap: 1.1, rightGap: 0 } },
};

/** The melody fixture's crescendo, straight from the pipeline */
export const FromThePipeline: Story = {
  args: { hairpin: SystemLayout.unbroken(Fixtures.monophonicMelody()).hairpins[0] },
  decorators: [withStaff({ width: 70 })],
};
