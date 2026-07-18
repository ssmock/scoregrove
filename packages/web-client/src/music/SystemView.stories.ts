import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { Fixtures } from '@scoregrove/engraving/Fixtures';
import { SystemLayout } from '@scoregrove/engraving/SystemLayout';
import SystemView from './SystemView.vue';

const meta: Meta<typeof SystemView> = {
  title: 'Music/Composites/System',
  component: SystemView,
};

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * The end-to-end slice: the whole melody fixture through the full pipeline —
 * context walk, accidental resolution, stems and flags, spacing — into one
 * unbroken system. The full rendering demo will grow from here as line
 * breaking, multiple staves, and spanners land.
 */
export const MelodyEndToEnd: Story = {
  args: { system: SystemLayout.singleStaff(Fixtures.monophonicMelody()), scale: 12 },
};

/**
 * The repeats fixture's barline furniture: repeat open and close, a double
 * bar, and a final bar. (Volta brackets and navigation signs are later
 * checklist items.)
 */
export const RepeatsBarlines: Story = {
  args: { system: SystemLayout.singleStaff(Fixtures.repeatsAndNavigation()), scale: 12 },
};
