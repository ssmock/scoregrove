import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { ContextWalk } from '@scoregrove/engraving/ContextWalk';
import { Fixtures } from '@scoregrove/engraving/Fixtures';
import type { LaidOutNote } from '@scoregrove/engraving/LayoutTree';
import { MeasureLayout } from '@scoregrove/engraving/MeasureLayout';
import { StemDirection } from '@scoregrove/engraving/Stems';
import GraceNoteView from './GraceNoteView.vue';
import { withStaff } from './storybook';

/** The melody fixture's acciaccatura, straight from the pipeline */
const melody = Fixtures.monophonicMelody();
const laid = MeasureLayout.layout({
  contexts: ContextWalk.walk(melody)[3],
  measure: melody.measures[3],
  measureIndex: 3,
})[0];
const fixtureGrace = laid.elements.find(
  (e): e is LaidOutNote => e.kind === 'note' && (e.graces?.length ?? 0) > 0,
)!.graces![0];

const meta: Meta<typeof GraceNoteView> = {
  title: 'Music/Symbols/GraceNote',
  component: GraceNoteView,
  decorators: [withStaff({ width: 12 })],
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Acciaccatura: Story = {
  args: {
    grace: {
      x: 4,
      position: 3,
      notehead: 'noteheadBlack',
      scale: 0.6,
      stem: { x: 4.7, top: -1.9, bottom: 0.5, direction: StemDirection.Up },
      flag: { glyph: 'flag8thUp', x: 4.7, y: -1.9 },
      slash: { x1: 3.8, y1: -0.4, x2: 5.3, y2: -1.4 },
      ledgers: [],
    },
  },
};

export const Appoggiatura: Story = {
  args: {
    grace: {
      x: 4,
      position: 1,
      notehead: 'noteheadBlack',
      scale: 0.6,
      stem: { x: 4.7, top: -0.9, bottom: 1.5, direction: StemDirection.Up },
      flag: { glyph: 'flag8thUp', x: 4.7, y: -0.9 },
      ledgers: [],
    },
  },
};

export const FromThePipeline: Story = {
  args: { grace: fixtureGrace },
  decorators: [withStaff({ width: 30 })],
};
