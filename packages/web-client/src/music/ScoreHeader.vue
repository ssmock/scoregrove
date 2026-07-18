<script setup lang="ts">
withDefaults(defineProps<{ title?: string; composer?: string }>(), {
  title: undefined,
  composer: undefined,
});
</script>

<template>
  <header v-if="title || composer" class="score-header">
    <h1 v-if="title" class="score-title">{{ title }}</h1>
    <p v-if="composer" class="score-composer">{{ composer }}</p>
  </header>
</template>

<style scoped>
.score-header {
  text-align: center;
  font-family: Georgia, 'Times New Roman', serif;
}

.score-title {
  margin: 0 0 0.25rem;
  font-size: 1.6rem;
  font-weight: 600;
}

.score-composer {
  margin: 0;
  font-size: 1rem;
  font-style: italic;
}
</style>
