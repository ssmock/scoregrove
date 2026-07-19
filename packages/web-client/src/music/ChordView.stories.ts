import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { ContextWalk } from '@scoregrove/engraving/ContextWalk';
import { Fixtures } from '@scoregrove/engraving/Fixtures';
import type { LaidOutChord } from '@scoregrove/engraving/LayoutTree';
import { MeasureLayout } from '@scoregrove/engraving/MeasureLayout';
import ChordView from './ChordView.vue';
import { withStaff } from './storybook';

/** The bass-clef chords of the two-staff fixture, straight from the pipeline */
const piece = Fixtures.twoStaffMultiVoice();
const contexts = ContextWalk.walk(piece);

const bassChords = MeasureLayout.layout({
  contexts: contexts[1],
  measure: piece.measures[1],
  measureIndex: 1,
})[1].elements.filter((element): element is LaidOutChord => element.kind === 'chord');

const meta: Meta<typeof ChordView> = {
  title: 'Music/Composites/Chord',
  component: ChordView,
  decorators: [withStaff({ width: 20 })],
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Triad: Story = {
  args: { chord: bassChords[0] },
};

export const SecondCluster: Story = {
  args: {
    chord: {
      kind: 'chord',
      address: { measure: 0, staff: 0, voice: 0, element: 0 },
      x: 6,
      notehead: 'noteheadHalf',
      tones: [
        { tone: 0, position: -6, x: 6 },
        { tone: 1, position: -5, x: 7.1 },
      ],
      stem: { x: 7.1, top: -1.5, bottom: 5, direction: 'Up' },
      ledgers: [-6],
    },
  },
};
