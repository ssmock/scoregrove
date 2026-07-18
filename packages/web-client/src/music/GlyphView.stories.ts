import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { glyphs, type GlyphName } from '@scoregrove/engraving/Bravura';
import GlyphView from './GlyphView.vue';
import { withStaff } from './storybook';

const meta: Meta<typeof GlyphView> = {
  title: 'Music/Primitives/Glyph',
  component: GlyphView,
  decorators: [withStaff()],
  argTypes: {
    glyph: { control: 'select', options: Object.keys(glyphs) },
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { glyph: 'gClef', x: 0, y: 3 },
};

/**
 * Every extracted glyph on one sheet — a quick check that the Bravura font
 * loaded and the metadata extraction covers what we use.
 */
export const Catalog: Story = {
  render: () => ({
    components: { GlyphView },
    data: () => ({ names: Object.keys(glyphs) as GlyphName[], perRow: 10 }),
    template: `
      <svg viewBox="0 0 60 42" width="900" height="630" role="img" aria-label="Glyph catalog">
        <GlyphView
          v-for="(name, index) in names"
          :key="name"
          :glyph="name"
          :x="(index % perRow) * 6 + 2"
          :y="Math.floor(index / perRow) * 6 + 4"
        />
      </svg>
    `,
  }),
};
