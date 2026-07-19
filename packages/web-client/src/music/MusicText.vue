<script setup lang="ts">
import type { LaidOutText } from '@scoregrove/engraving/LayoutTree';

/**
 * One laid-out run of score text (tempo words, navigation instructions,
 * repeat counts, volta labels) in the score's serif text face.
 */
defineProps<{ note: LaidOutText }>();
</script>

<template>
  <text
    :x="note.x"
    :y="note.y"
    class="music-text"
    :font-size="note.size"
    :text-anchor="note.anchor"
    :font-style="note.italic ? 'italic' : 'normal'"
    :font-weight="note.bold ? 'bold' : 'normal'"
  >
    {{ note.text }}
  </text>
</template>
