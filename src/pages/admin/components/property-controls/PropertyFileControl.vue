<script setup lang="ts">
defineProps<{ disabled?: boolean; accept?: string }>()
const emit = defineEmits<{ file: [file: File] }>()
function update(event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) emit('file', file)
}
</script>

<template>
  <input type="file" :disabled="disabled" :accept="accept" @change="update" />
</template>
