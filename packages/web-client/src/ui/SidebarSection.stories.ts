import type { Meta, StoryObj } from '@storybook/vue3-vite';
import SidebarSection from './SidebarSection.vue';

const meta: Meta<typeof SidebarSection> = {
  title: 'UI/SidebarSection',
  component: SidebarSection,
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Pallet: Story = {
  render: () => ({
    components: { SidebarSection },
    template: `
      <SidebarSection heading="Pallet" style="width: 260px;">
        <p style="margin: 0; color: var(--color-text-muted);">Note and rest tools go here.</p>
      </SidebarSection>
    `,
  }),
};

export const Empty: Story = {
  args: { heading: 'Projects' },
};
