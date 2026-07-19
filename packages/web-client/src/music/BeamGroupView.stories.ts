import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { ContextWalk } from '@scoregrove/engraving/ContextWalk';
import { Fixtures } from '@scoregrove/engraving/Fixtures';
import { MeasureLayout } from '@scoregrove/engraving/MeasureLayout';
import { StemDirection } from '@scoregrove/engraving/Stems';
import BeamGroupView from './BeamGroupView.vue';
import { withStaff } from './storybook';

const meta: Meta<typeof BeamGroupView> = {
  title: 'Music/Composites/BeamGroup',
  component: BeamGroupView,
  decorators: [withStaff({ width: 12 })],
};

export default meta;

type Story = StoryObj<typeof meta>;

/** Beam quads alone — MeasureView pairs them with their notes */
export const PrimaryAndSecondary: Story = {
  args: {
    beams: [
      { x1: 2, y1: -1.5, x2: 8, y2: -1, thickness: 0.5, direction: StemDirection.Up, level: 1 },
      {
        x1: 2,
        y1: -0.75,
        x2: 8,
        y2: -0.25,
        thickness: 0.5,
        direction: StemDirection.Up,
        level: 2,
      },
    ],
  },
};

/** The melody fixture's sixteenth run, straight from the pipeline */
export const FromThePipeline: Story = {
  args: {
    beams: (() => {
      const melody = Fixtures.monophonicMelody();

      return MeasureLayout.layout({
        contexts: ContextWalk.walk(melody)[1],
        measure: melody.measures[1],
        measureIndex: 1,
      })[0].beams;
    })(),
  },
};
