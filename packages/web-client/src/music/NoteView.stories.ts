import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { ContextWalk } from '@scoregrove/engraving/ContextWalk';
import { Fixtures } from '@scoregrove/engraving/Fixtures';
import type { LaidOutNote } from '@scoregrove/engraving/LayoutTree';
import { MeasureLayout } from '@scoregrove/engraving/MeasureLayout';
import NoteView from './NoteView.vue';
import { withStaff } from './storybook';

/**
 * Laid-out notes pulled from the real pipeline over the melody fixture, so
 * the story shows exactly what MeasureView would place.
 */
const melody = Fixtures.monophonicMelody();
const contexts = ContextWalk.walk(melody);

const notesOfMeasure = (measureIndex: number): LaidOutNote[] =>
  MeasureLayout.layout({
    contexts: contexts[measureIndex],
    measure: melody.measures[measureIndex],
    measureIndex,
  })[0].elements.filter((element): element is LaidOutNote => element.kind === 'note');

const meta: Meta<typeof NoteView> = {
  title: 'Music/Composites/Note',
  component: NoteView,
  decorators: [withStaff({ width: 20 })],
};

export default meta;

type Story = StoryObj<typeof meta>;

export const QuarterWithStem: Story = {
  args: { note: notesOfMeasure(0)[0] },
};

export const DottedQuarter: Story = {
  args: { note: notesOfMeasure(1)[0] },
};

/** The eighth after the dotted quarter — alone in its beat, so it keeps a flag */
export const EighthWithFlag: Story = {
  args: { note: notesOfMeasure(1)[1] },
};

export const WithPrintedSharp: Story = {
  args: { note: notesOfMeasure(2)[0] },
};
