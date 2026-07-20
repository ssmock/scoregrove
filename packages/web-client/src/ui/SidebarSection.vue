<script setup lang="ts">
/**
 * One region of the editor sidebar (view switcher, pallet, project
 * management) — a heading plus its content, stacked consistently.
 */
defineProps<{ heading?: string }>();
</script>

<template>
  <section class="sidebar-section">
    <h2 v-if="heading" class="sidebar-section__heading">{{ heading }}</h2>
    <div class="sidebar-section__body">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.sidebar-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.sidebar-section__heading {
  margin: 0;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.sidebar-section__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
</style>
