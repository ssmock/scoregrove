import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { Fixtures } from '@scoregrove/engraving/Fixtures';
import { SystemLayout } from '@scoregrove/engraving/SystemLayout';
import VoltaBracket from './VoltaBracket.vue';
import { withStaff } from './storybook';

const meta: Meta<typeof VoltaBracket> = {
  title: 'Music/Symbols/VoltaBracket',
  component: VoltaBracket,
  decorators: [withStaff({ width: 16 })],
};

export default meta;

type Story = StoryObj<typeof meta>;

export const FirstEnding: Story = {
  args: {
    volta: { x1: 2, x2: 12, y: -3.5, label: '1.', hookStart: true, hookEnd: true },
  },
};

export const FinalPassage: Story = {
  args: {
    volta: { x1: 2, x2: 12, y: -3.5, label: '2.', hookStart: true, hookEnd: false },
  },
};

/** The repeats fixture's first ending, straight from the pipeline */
export const FromThePipeline: Story = {
  args: { volta: SystemLayout.unbroken(Fixtures.repeatsAndNavigation()).voltas[0] },
  decorators: [withStaff({ width: 40 })],
};
