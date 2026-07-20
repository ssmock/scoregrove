<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string;
    modelValue: string;
    options: readonly { value: string; label: string }[];
    disabled?: boolean;
  }>(),
  { disabled: false },
);

defineEmits<{ 'update:modelValue': [string] }>();
</script>

<template>
  <label class="app-select">
    <span class="app-select__label">{{ label }}</span>
    <select
      class="app-select__control"
      :value="modelValue"
      :disabled="disabled"
      @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
    >
      <option v-for="option in options" :key="option.value" :value="option.value">
        {{ option.label }}
      </option>
    </select>
  </label>
</template>

<style scoped>
.app-select {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.app-select__control {
  padding: var(--space-2) var(--space-3);
  font: inherit;
  font-size: var(--text-base);
  color: var(--color-text);
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.app-select__control:focus-visible {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: 1px;
}
</style>
