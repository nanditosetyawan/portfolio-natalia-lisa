<script setup lang="ts">
import { computed } from 'vue'
import type { EditorControl } from '../../../../types/editor'

const props = defineProps<{
  control: EditorControl
  modelValue: string | number | boolean | null
  disabled?: boolean
  placeholder?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string | number] }>()
const inputTypeByControl: Partial<Record<EditorControl, string>> = { text: 'text', custom: 'text', number: 'number', color: 'color' }
const inputType = computed(() => inputTypeByControl[props.control] ?? 'text')

function update(event: Event): void {
  const value = (event.target as HTMLInputElement).value
  emit('update:modelValue', props.control === 'number' ? Number(value) : value)
}
</script>

<template>
  <input :type="inputType" :value="modelValue ?? ''" :disabled="disabled" :placeholder="placeholder" @input="update" />
</template>
