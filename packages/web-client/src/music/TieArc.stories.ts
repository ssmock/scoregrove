import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { Fixtures } from '@scoregrove/engraving/Fixtures';
import { SystemLayout } from '@scoregrove/engraving/SystemLayout';
import TieArc from './TieArc.vue';
import { withStaff } from './storybook';

const meta: Meta<typeof TieArc> = {
  title: 'Music/Composites/TieArc',
  component: TieArc,
  decorators: [withStaff({ width: 14 })],
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Over: Story = {
  args: {
    tie: { x1: 2, y1: 0.8, cx1: 4.4, cy1: 0, cx2: 7.6, cy2: 0, x2: 10, y2: 0.8 },
  },
};

export const Under: Story = {
  args: {
    tie: { x1: 2, y1: 3.2, cx1: 4.4, cy1: 4, cx2: 7.6, cy2: 4, x2: 10, y2: 3.2 },
  },
};

/** The melody fixture's cross-barline tie, straight from the pipeline */
export const FromThePipeline: Story = {
  args: { tie: SystemLayout.unbroken(Fixtures.monophonicMelody()).ties[0] },
  decorators: [withStaff({ width: 40 })],
};
