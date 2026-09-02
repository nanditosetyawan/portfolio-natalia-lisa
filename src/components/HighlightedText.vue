<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ text: string; query: string }>()

const parts = computed(() => {
  const query = props.query.trim()
  if (!query) return [{ value: props.text, highlighted: false }]
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const expression = new RegExp(`(${escaped})`, 'gi')
  return props.text.split(expression).filter(Boolean).map((value) => ({
    value,
    highlighted: value.toLocaleLowerCase() === query.toLocaleLowerCase()
  }))
})
</script>

<template>
  <span><template v-for="(part, index) in parts" :key="`${index}-${part.value}`"><mark v-if="part.highlighted">{{ part.value }}</mark><template v-else>{{ part.value }}</template></template></span>
</template>
