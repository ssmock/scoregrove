import type { Meta, StoryObj } from '@storybook/vue3-vite';
import AppButton from './AppButton.vue';
import AppDialog from './AppDialog.vue';

const meta: Meta<typeof AppDialog> = {
  title: 'UI/AppDialog',
  component: AppDialog,
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => ({
    components: { AppDialog },
    template: `
      <AppDialog :open="true" title="Staff Setup">
        <p>Dialog body content goes here.</p>
      </AppDialog>
    `,
  }),
};

export const WithFooter: Story = {
  render: () => ({
    components: { AppDialog, AppButton },
    template: `
      <AppDialog :open="true" title="Delete Project">
        <p>"Study in G" will be permanently deleted. This can't be undone.</p>
        <template #footer>
          <AppButton variant="quiet">Cancel</AppButton>
          <AppButton variant="danger">Delete</AppButton>
        </template>
      </AppDialog>
    `,
  }),
};

/** No title, no close affordance — for a dialog that demands an explicit choice */
export const Undismissable: Story = {
  render: () => ({
    components: { AppDialog, AppButton },
    template: `
      <AppDialog :open="true" :dismissable="false">
        <p>Save changes before starting a new project?</p>
        <template #footer>
          <AppButton variant="quiet">Discard</AppButton>
          <AppButton>Save</AppButton>
        </template>
      </AppDialog>
    `,
  }),
};
