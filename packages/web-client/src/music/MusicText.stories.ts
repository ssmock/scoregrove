import type { Meta, StoryObj } from '@storybook/vue3-vite';
import MusicText from './MusicText.vue';
import { withStaff } from './storybook';

/**
 * The score-text renderer behind tempo words, swing feels, navigation
 * instructions, and repeat counts — the checklist's TempoText, SwingText,
 * and RepeatTimesText resolve to laid-out annotations drawn by this one
 * component.
 */
const meta: Meta<typeof MusicText> = {
  title: 'Music/Symbols/MusicText',
  component: MusicText,
  decorators: [withStaff({ width: 16 })],
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Tempo: Story = {
  args: {
    note: { text: 'Allegretto', x: 1, y: -4.5, size: 2.2, anchor: 'start', bold: true },
  },
};

export const TempoWithSwing: Story = {
  args: {
    note: {
      text: 'Moderato, Medium Swing',
      x: 1,
      y: -4.5,
      size: 2.2,
      anchor: 'start',
      bold: true,
    },
  },
};

export const JumpInstruction: Story = {
  args: {
    note: { text: 'D.S. al Fine', x: 15, y: -2.5, size: 1.8, anchor: 'end', italic: true },
  },
};

export const RepeatTimes: Story = {
  args: {
    note: { text: '×3', x: 15, y: -1.2, size: 1.8, anchor: 'end' },
  },
};
