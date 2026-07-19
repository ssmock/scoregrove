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
 * context walk, accidental resolution, stems, beams, ties, spacing — into
 * one unbroken system.
 */
export const MelodyEndToEnd: Story = {
  args: { system: SystemLayout.unbroken(Fixtures.monophonicMelody()), scale: 12 },
};

/**
 * Two staves, two voices on the treble: onset columns align simultaneous
 * notes across staves, voice 1 stems up and voice 2 down.
 */
export const TwoStaffMultiVoice: Story = {
  args: { system: SystemLayout.unbroken(Fixtures.twoStaffMultiVoice()), scale: 12 },
};

/**
 * The repeats fixture's barline furniture: repeat open and close, a double
 * bar, and a final bar. (Volta brackets and navigation signs are later
 * checklist items.)
 */
export const RepeatsBarlines: Story = {
  args: { system: SystemLayout.unbroken(Fixtures.repeatsAndNavigation()), scale: 12 },
};
