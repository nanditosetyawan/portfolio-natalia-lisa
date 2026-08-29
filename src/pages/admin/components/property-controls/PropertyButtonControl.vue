<script setup lang="ts">
defineProps<{ disabled?: boolean; label?: string }>()
const emit = defineEmits<{ action: [] }>()
</script>

<template>
  <button type="button" :disabled="disabled" @click="emit('action')">{{ label }}</button>
</template>
