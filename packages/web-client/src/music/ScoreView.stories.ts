import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { NewSection, SectionBreak } from '@scoregrove/domain/Measure';
import { NonEmptyArray } from '@scoregrove/domain/NonEmptyArray';
import { NonEmptyString } from '@scoregrove/domain/NonEmptyString';
import { Fixtures } from '@scoregrove/engraving/Fixtures';
import type { Score } from '@scoregrove/domain/Score';
import ScoreView from './ScoreView.vue';
import haydnThemeJson from './fixtures/haydnTheme.score.json';

/** Movement II's theme, imported from the corpus; see the story below */
const haydnTheme = haydnThemeJson as unknown as Score;

/** The melody fixture with a titled section opening partway through */
const sectioned = () => {
  const score = Fixtures.monophonicMelody();

  return {
    ...score,
    measures: NonEmptyArray.of(
      score.measures.map((measure, index) =>
        index === 2
          ? {
              ...measure,
              newSection: NewSection.of(NonEmptyString.of('Var. I'), SectionBreak.System),
            }
          : measure,
      ),
    ),
  };
};

/**
 * The full rendering demo of the strategy: each fixture score through the
 * complete pipeline — context walk, accidentals, stems, spacing, greedy line
 * breaking with justification — into a header plus stacked systems. Drag the
 * width control to watch measures re-break and justify live. The demo deepens
 * as pipeline stages land (beams, ties, multi-voice, multi-staff).
 */
const meta: Meta<typeof ScoreView> = {
  title: 'Music/Full Rendering Demo',
  component: ScoreView,
  argTypes: {
    width: {
      control: { type: 'range', min: 30, max: 200, step: 5 },
      description: 'Available width in staff spaces; drives line breaking',
    },
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

/** Mixed rhythms, accidentals, a dynamic, a tie, and a fermata in G major */
export const Melody: Story = {
  args: { score: Fixtures.monophonicMelody(), width: 70, scale: 12 },
};

/** Repeat barlines, endings, and a Final bar (voltas and signs are later items) */
export const RepeatsAndNavigation: Story = {
  args: { score: Fixtures.repeatsAndNavigation(), width: 70, scale: 12 },
};

/**
 * The two-staff fixture: onset columns align both staves and both treble
 * voices, voice 1 stems up, voice 2 down.
 */
export const TwoStaffMultiVoice: Story = {
  args: { score: Fixtures.twoStaffMultiVoice(), width: 70, scale: 12 },
};

/** No explicit width: the score re-breaks as its container resizes */
export const ResizeDriven: Story = {
  args: { score: Fixtures.monophonicMelody(), scale: 10 },
};

/**
 * Sections: a titled heading opens a new system even where the width would
 * happily have kept going. The width is deliberately generous, so the break
 * you see is the section's doing and nothing else.
 */
export const Sections: Story = {
  args: { score: sectioned(), width: 120, scale: 12 },
};

/**
 * Real music, imported rather than invented. Movement II's theme from the
 * Haydn quartet — four bracketed staves with joined barlines, part names,
 * a pickup bar, slurs, dynamics, a turn, fermatas and a double stop, none of
 * which anyone chose to exercise a feature.
 *
 * The fixture is committed score JSON rather than parsed here: a story should
 * not read a 4 MB XML file, and a test in `packages/import` fails if the
 * importer stops producing exactly this, so it cannot drift unnoticed.
 */
export const HaydnTheme: Story = {
  args: { score: haydnTheme, width: 110, scale: 10 },
};

/** The same music at a narrower width, so line breaking has to work for it */
export const HaydnThemeNarrow: Story = {
  args: { score: haydnTheme, width: 62, scale: 10 },
};
