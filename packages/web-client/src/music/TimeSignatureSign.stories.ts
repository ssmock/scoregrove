import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { PositiveInteger } from '@scoregrove/domain/PositiveInteger';
import { BeatUnit, TimeSignature } from '@scoregrove/domain/TimeSignature';
import TimeSignatureSign from './TimeSignatureSign.vue';
import { withStaff } from './storybook';

const meta: Meta<typeof TimeSignatureSign> = {
  title: 'Music/Symbols/TimeSignatureSign',
  component: TimeSignatureSign,
  decorators: [withStaff({ width: 8 })],
};

export default meta;

type Story = StoryObj<typeof meta>;

export const ThreeFour: Story = {
  args: { time: { beats: PositiveInteger.of(3), beatUnit: BeatUnit.Quarter }, x: 2 },
};

export const TwelveEight: Story = {
  args: { time: { beats: PositiveInteger.of(12), beatUnit: BeatUnit.Eighth }, x: 2 },
};

export const Common: Story = {
  args: { time: TimeSignature.commonTime(), x: 2 },
};

export const CutCommon: Story = {
  args: { time: TimeSignature.cutCommonTime(), x: 2 },
};
