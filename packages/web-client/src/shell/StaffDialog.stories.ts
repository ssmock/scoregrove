import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { Clef } from '@scoregrove/domain/Clef';
import { NonEmptyString } from '@scoregrove/domain/NonEmptyString';
import StaffDialog from './StaffDialog.vue';
import { withEditorStore } from '../store/storybook';

const meta: Meta<typeof StaffDialog> = {
  title: 'Shell/StaffDialog',
  component: StaffDialog,
};

export default meta;

type Story = StoryObj<typeof meta>;

export const SingleStaff: Story = {
  args: { open: true },
  decorators: [withEditorStore()],
};

export const TwoStaves: Story = {
  args: { open: true },
  decorators: [
    withEditorStore({
      configure: (store) => store.addStaff(Clef.Bass, NonEmptyString.of('LH')),
    }),
  ],
};
