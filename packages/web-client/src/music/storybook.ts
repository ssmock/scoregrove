import type { Decorator } from '@storybook/vue3-vite';
import StaffLines from './StaffLines.vue';

/**
 * Wraps an SVG-fragment story (a component whose root is a <g>) in an <svg>
 * with staff lines behind it, so symbol components render in context. The
 * viewBox is in staff spaces with the staff's top line at y 0, matching the
 * layout tree's convention.
 */
export const withStaff = (options: { width?: number; showStaff?: boolean } = {}): Decorator => {
  const width = options.width ?? 14;
  const showStaff = options.showStaff ?? true;
  const margin = 6;
  const height = 4 + margin * 2;

  return (story) => ({
    components: { story, StaffLines },
    data: () => ({ width, showStaff }),
    template: `
      <svg
        viewBox="-2 ${-margin} ${width + 4} ${height}"
        :width="(${width} + 4) * 10"
        :height="${height} * 10"
        role="img"
        aria-label="Notation preview"
      >
        <staff-lines v-if="showStaff" :width="width" />
        <story />
      </svg>
    `,
  });
};
