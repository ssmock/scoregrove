<script setup lang="ts">
/**
 * A staff's name ("RH", "Violin"), right-aligned in the left margin,
 * vertically centered on the staff.
 */
withDefaults(defineProps<{ label: string; x?: number; y?: number }>(), {
  x: -1,
  y: 2,
});
</script>

<template>
  <text :x="x" :y="y + 0.6" class="music-text" font-size="1.8" text-anchor="end">
    {{ label }}
  </text>
</template>
