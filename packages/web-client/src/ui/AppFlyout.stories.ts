import type { Meta, StoryObj } from '@storybook/vue3-vite';
import AppFlyout from './AppFlyout.vue';

const meta: Meta<typeof AppFlyout> = {
  title: 'UI/AppFlyout',
  component: AppFlyout,
};

export default meta;

type Story = StoryObj<typeof meta>;

/** No anchor or pointer position given: falls back to a fixed top-left offset */
export const Default: Story = {
  render: () => ({
    components: { AppFlyout },
    template: `
      <AppFlyout :open="true">
        <div style="padding: 4px 8px; white-space: nowrap;">Flyout content</div>
      </AppFlyout>
    `,
  }),
};

/** Anchored below a trigger element, as the pallet's duration picker will be */
export const AnchoredToTrigger: Story = {
  render: () => ({
    components: { AppFlyout },
    data: () => ({ anchorEl: null as HTMLElement | null, open: true }),
    mounted() {
      this.anchorEl = this.$refs.trigger as HTMLElement;
    },
    template: `
      <div style="padding: 60px;">
        <button ref="trigger" type="button">Options</button>
        <AppFlyout :open="open" :anchor="anchorEl" @close="open = false">
          <div style="padding: 4px 8px; white-space: nowrap;">Flyout content</div>
        </AppFlyout>
      </div>
    `,
  }),
};

/** At a pointer position, as the right-click element editor will be */
export const AtPointerPosition: Story = {
  render: () => ({
    components: { AppFlyout },
    template: `
      <AppFlyout :open="true" :at="{ x: 80, y: 60 }">
        <div style="padding: 4px 8px; white-space: nowrap;">
          Articulations, Dots, Accidentals, Remove
        </div>
      </AppFlyout>
    `,
  }),
};
