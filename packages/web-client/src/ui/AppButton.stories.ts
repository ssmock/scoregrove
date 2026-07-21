import type { Meta, StoryObj } from '@storybook/vue3-vite';
import AppButton from './AppButton.vue';
import MusicIcon from './MusicIcon.vue';

const meta: Meta<typeof AppButton> = {
  title: 'UI/AppButton',
  component: AppButton,
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => ({
    components: { AppButton },
    template: `<AppButton>Add staff</AppButton>`,
  }),
};

export const Quiet: Story = {
  render: () => ({
    components: { AppButton },
    template: `<AppButton variant="quiet">Cancel</AppButton>`,
  }),
};

export const Danger: Story = {
  render: () => ({
    components: { AppButton },
    template: `<AppButton variant="danger">Delete</AppButton>`,
  }),
};

export const Link: Story = {
  render: () => ({
    components: { AppButton },
    template: `<AppButton variant="link">Keyboard shortcuts</AppButton>`,
  }),
};

/** The pressed state a pallet tool takes while it's the active one */
export const Pressed: Story = {
  render: () => ({
    components: { AppButton },
    template: `<AppButton :pressed="true">Quarter note</AppButton>`,
  }),
};

export const Disabled: Story = {
  render: () => ({
    components: { AppButton },
    template: `<AppButton disabled>Redo</AppButton>`,
  }),
};

export const WithIcon: Story = {
  render: () => ({
    components: { AppButton, MusicIcon },
    template: `
      <AppButton>
        <template #icon><MusicIcon glyph="noteheadBlack" :size="18" /></template>
        Quarter note
      </AppButton>
    `,
  }),
};
