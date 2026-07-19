import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { ContextWalk } from '@scoregrove/engraving/ContextWalk';
import { Fixtures } from '@scoregrove/engraving/Fixtures';
import { MeasureLayout } from '@scoregrove/engraving/MeasureLayout';
import MeasureView from './MeasureView.vue';
import { withStaff } from './storybook';

const melody = Fixtures.monophonicMelody();
const contexts = ContextWalk.walk(melody);

const layoutMeasure = (measureIndex: number) =>
  MeasureLayout.layout({
    contexts: contexts[measureIndex],
    measure: melody.measures[measureIndex],
    measureIndex,
  })[0];

const meta: Meta<typeof MeasureView> = {
  title: 'Music/Composites/Measure',
  component: MeasureView,
  decorators: [withStaff({ width: 26 })],
};

export default meta;

type Story = StoryObj<typeof meta>;

/** Clef, key, time, an opening dynamic, and mixed rhythms */
export const OpeningMeasure: Story = {
  args: { measure: layoutMeasure(0) },
};

/** A dotted rhythm, a sixteenth run, and a rest — no signatures reprinted */
export const DottedAndSixteenths: Story = {
  args: { measure: layoutMeasure(1) },
};

/** A printed sharp and its natural cancellation */
export const AccidentalsAtWork: Story = {
  args: { measure: layoutMeasure(2) },
};

/** The final measure: tie target, fermata, and a Final barline */
export const FinalMeasure: Story = {
  args: { measure: layoutMeasure(3) },
};
