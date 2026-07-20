<script setup lang="ts">
import AppButton from './AppButton.vue';
import AppDialog from './AppDialog.vue';

/**
 * A yes/no confirmation over AppDialog — staff removal, project deletion,
 * bar erase. Dismissing the dialog (Escape, overlay click, the close
 * button) counts as cancel.
 */
withDefaults(
  defineProps<{
    open: boolean;
    title?: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    danger?: boolean;
  }>(),
  { title: undefined, confirmLabel: 'Confirm', cancelLabel: 'Cancel', danger: false },
);

const emit = defineEmits<{ confirm: []; cancel: [] }>();
</script>

<template>
  <AppDialog :open="open" :title="title" @close="emit('cancel')">
    <p class="confirm-dialog__message">{{ message }}</p>
    <template #footer>
      <AppButton variant="quiet" @click="emit('cancel')">{{ cancelLabel }}</AppButton>
      <AppButton :variant="danger ? 'danger' : 'default'" @click="emit('confirm')">
        {{ confirmLabel }}
      </AppButton>
    </template>
  </AppDialog>
</template>

<style scoped>
.confirm-dialog__message {
  margin: 0;
}
</style>
