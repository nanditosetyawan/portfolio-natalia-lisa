<script setup lang="ts">
defineProps<{ modelValue: string | number | boolean | null; disabled?: boolean; label?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
</script>

<template>
  <input type="checkbox" :checked="Boolean(modelValue)" :disabled="disabled" :aria-label="label" @change="emit('update:modelValue', ($event.target as HTMLInputElement).checked)" />
</template>
