<script setup lang="ts">
import { onMounted, ref } from 'vue';
import type { Counter } from '@scoregrove/domain/Counter';

const counter = ref<Counter | null>(null);
const error = ref<string | null>(null);

async function refresh(): Promise<void> {
  const res = await fetch('/api/counter');
  counter.value = (await res.json()) as Counter;
}

async function call(action: 'increment' | 'decrement'): Promise<void> {
  try {
    const res = await fetch(`/api/counter/${action}`, { method: 'POST' });
    counter.value = (await res.json()) as Counter;
    error.value = null;
  } catch {
    error.value = 'Could not reach the server. Is it running (pnpm dev:server)?';
  }
}

onMounted(async () => {
  try {
    await refresh();
  } catch {
    error.value = 'Could not reach the server. Is it running (pnpm dev:server)?';
  }
});
</script>

<template>
  <main>
    <h1>scoregrove</h1>
    <p v-if="error">{{ error }}</p>
    <p v-else-if="counter === null">Loading…</p>
    <div v-else>
      <p>Count: {{ counter.value }}</p>
      <button type="button" @click="call('decrement')">-</button>
      <button type="button" @click="call('increment')">+</button>
    </div>
  </main>
</template>
