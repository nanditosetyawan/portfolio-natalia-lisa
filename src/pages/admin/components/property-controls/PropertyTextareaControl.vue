<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ modelValue: string | number | boolean | null; disabled?: boolean; placeholder?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const textValue = computed(() => props.modelValue === null ? '' : String(props.modelValue))
</script>

<template>
  <textarea :value="textValue" :disabled="disabled" :placeholder="placeholder" @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)" />
</template>
