<script setup lang="ts">
withDefaults(defineProps<{ label: string; modelValue: boolean; disabled?: boolean }>(), {
  disabled: false,
});

defineEmits<{ 'update:modelValue': [boolean] }>();
</script>

<template>
  <label class="app-checkbox" :class="{ 'app-checkbox--disabled': disabled }">
    <input
      type="checkbox"
      class="app-checkbox__control"
      :checked="modelValue"
      :disabled="disabled"
      @change="$emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
    />
    <span class="app-checkbox__label">{{ label }}</span>
  </label>
</template>

<style scoped>
.app-checkbox {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-base);
  color: var(--color-text);
  cursor: pointer;
}

.app-checkbox--disabled {
  color: var(--color-text-muted);
  cursor: not-allowed;
}

.app-checkbox__control {
  width: 1rem;
  height: 1rem;
  accent-color: var(--color-accent);
}
</style>
