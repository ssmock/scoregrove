import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { Clef } from '@scoregrove/domain/Clef';
import { Duration, NoteValue } from '@scoregrove/domain/Duration';
import { Mode } from '@scoregrove/domain/KeySignature';
import { StaffContent } from '@scoregrove/domain/Measure';
import { Note } from '@scoregrove/domain/MeasureElement';
import { NonEmptyArray } from '@scoregrove/domain/NonEmptyArray';
import { Octave, Pitch, PitchClass, PitchLetter } from '@scoregrove/domain/Pitch';
import { PositiveInteger } from '@scoregrove/domain/PositiveInteger';
import type { Score } from '@scoregrove/domain/Score';
import { Staff } from '@scoregrove/domain/Staff';
import { BeatUnit } from '@scoregrove/domain/TimeSignature';
import App from './App.vue';
import { withEditorStore } from './store/storybook';

const meta: Meta<typeof App> = {
  title: 'App',
  component: App,
};

export default meta;

type Story = StoryObj<typeof meta>;

/** The editor view, the app's default */
export const Editor: Story = {
  decorators: [withEditorStore()],
};

/** The performance view, switched to before render */
export const Performance: Story = {
  decorators: [withEditorStore({ configure: (store) => store.setView('performance') })],
};

/**
 * `measureCount` whole notes, one per measure, cycling through a scale —
 * enough content to force several systems and, at a real page's worth of
 * height, more than one printed page. Exists for `scripts/print-preview.mjs`
 * to load in isolation (no app state/localStorage to seed) and check
 * pagination/clipping against a real headless-Chromium print pass.
 */
const longScore = (measureCount: number): Score => {
  const scale = [
    PitchLetter.C,
    PitchLetter.D,
    PitchLetter.E,
    PitchLetter.F,
    PitchLetter.G,
    PitchLetter.A,
    PitchLetter.B,
  ];
  const whole = Duration.of(NoteValue.Whole);

  const measures = Array.from({ length: measureCount }, (_unused, index) => ({
    contents: NonEmptyArray.of([
      StaffContent.singleVoice(
        NonEmptyArray.of([
          Note.of(Pitch.of(PitchClass.of(scale[index % scale.length]), Octave.of(4)), whole),
        ]),
      ),
    ]),
  }));

  return {
    staves: NonEmptyArray.of([Staff.of(Clef.Treble)]),
    key: { tonic: PitchClass.of(PitchLetter.C), mode: Mode.Major },
    time: { beats: PositiveInteger.of(4), beatUnit: BeatUnit.Quarter },
    measures: NonEmptyArray.of(measures),
  };
};

/** The performance view with enough measures to span multiple printed pages */
export const PerformanceLongScore: Story = {
  decorators: [
    withEditorStore({
      initial: longScore(500),
      configure: (store) => store.setView('performance'),
    }),
  ],
};
