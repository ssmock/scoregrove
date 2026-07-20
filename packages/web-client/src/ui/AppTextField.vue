<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string;
    modelValue: string;
    placeholder?: string;
    disabled?: boolean;
    error?: string;
  }>(),
  { placeholder: '', disabled: false, error: undefined },
);

defineEmits<{ 'update:modelValue': [string] }>();
</script>

<template>
  <label class="app-text-field">
    <span class="app-text-field__label">{{ label }}</span>
    <input
      class="app-text-field__control"
      type="text"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <span v-if="error" class="app-text-field__error">{{ error }}</span>
  </label>
</template>

<style scoped>
.app-text-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.app-text-field__control {
  padding: var(--space-2) var(--space-3);
  font: inherit;
  font-size: var(--text-base);
  color: var(--color-text);
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.app-text-field__control:focus-visible {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: 1px;
}

.app-text-field__error {
  color: var(--color-danger);
}
</style>
