<script setup lang="ts">
import EditorView from './shell/EditorView.vue';
import PerformanceView from './shell/PerformanceView.vue';
import { useEditorStore } from './store/useEditorStore';

const store = useEditorStore();
</script>

<template>
  <EditorView v-if="store.state.view === 'editor'" />
  <PerformanceView v-else />
</template>
