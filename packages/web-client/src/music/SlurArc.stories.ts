import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { Fixtures } from '@scoregrove/engraving/Fixtures';
import { SystemLayout } from '@scoregrove/engraving/SystemLayout';
import SlurArc from './SlurArc.vue';
import { withStaff } from './storybook';

const meta: Meta<typeof SlurArc> = {
  title: 'Music/Composites/SlurArc',
  component: SlurArc,
  decorators: [withStaff({ width: 14 })],
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Over: Story = {
  args: {
    slur: { x1: 2, y1: 0.5, cx1: 5, cy1: -1.8, cx2: 8, cy2: -1.8, x2: 11, y2: 1 },
  },
};

/** The two-staff fixture's cross-barline phrase, straight from the pipeline */
export const FromThePipeline: Story = {
  args: { slur: SystemLayout.unbroken(Fixtures.twoStaffMultiVoice()).slurs[0] },
  decorators: [withStaff({ width: 44 })],
};
