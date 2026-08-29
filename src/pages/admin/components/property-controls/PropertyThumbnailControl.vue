<script setup lang="ts">
defineProps<{ modelValue: string | number | boolean | null; disabled?: boolean; label?: string }>()
</script>

<template>
  <figure class="media-thumbnail" :class="{ empty: !modelValue }" aria-live="polite">
    <img v-if="typeof modelValue === 'string' && modelValue" :src="modelValue" :alt="`${label ?? 'Selected media'} preview`" />
    <span v-else>No media assigned</span>
  </figure>
</template>

<style scoped>
.media-thumbnail { width: 100%; height: 108px; margin: 0; overflow: hidden; display: grid; place-items: center; border: 1px solid rgba(73,54,47,.16); border-radius: 12px; background: linear-gradient(135deg,#fffaf4,#eee5d9); }
.media-thumbnail img { width: 100%; height: 100%; object-fit: cover; }
.media-thumbnail span { color: #927a6f; font-size: .68rem; font-weight: 700; }
</style>
