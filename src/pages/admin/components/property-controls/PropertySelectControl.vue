<script setup lang="ts">
defineProps<{
  modelValue: string | number | boolean | null
  disabled?: boolean
  placeholder?: string
  label?: string
  options?: Array<{ label: string; value: string }>
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<template>
  <select :value="modelValue ?? ''" :disabled="disabled" :aria-label="label" @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value)">
    <option v-if="placeholder" value="" disabled>{{ placeholder }}</option>
    <option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option>
  </select>
</template>
