<script setup lang="ts">
import { computed } from 'vue'
import type { EditorControl } from '../../../types/editor'

const props = defineProps<{
  property: { control: EditorControl; options?: string[] | Array<{ label: string; value: string }> }
  value: string | number | boolean
  disabled?: boolean
}>()

const emit = defineEmits<{ change: [value: string | number | boolean] }>()

const componentByControl: Record<EditorControl, 'input' | 'textarea' | 'select'> = {
  text: 'input', textarea: 'textarea', number: 'input', color: 'input', select: 'select', checkbox: 'input', file: 'input', custom: 'input'
}
const inputTypeByControl: Record<EditorControl, string> = {
  text: 'text', textarea: 'text', number: 'number', color: 'color', select: 'text', checkbox: 'checkbox', file: 'file', custom: 'text'
}
const valueReaderByControl: Record<EditorControl, (target: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement) => string | number | boolean> = {
  text: (target) => target.value,
  textarea: (target) => target.value,
  number: (target) => Number(target.value),
  color: (target) => target.value,
  select: (target) => target.value,
  checkbox: (target) => (target as HTMLInputElement).checked,
  file: (target) => (target as HTMLInputElement).value,
  custom: (target) => target.value
}
const componentName = computed(() => componentByControl[props.property.control])
const inputType = computed(() => inputTypeByControl[props.property.control])
const checkedValue = computed(() => props.property.control === 'checkbox' ? Boolean(props.value) : undefined)
const valueAttribute = computed(() => props.property.control === 'checkbox' ? undefined : props.value)
const options = computed(() => (props.property.options ?? []).map((option) => typeof option === 'string' ? { label: option, value: option } : option))

function readValue(event: Event): string | number | boolean {
  const target = event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
  return valueReaderByControl[props.property.control](target)
}

function change(event: Event) { emit('change', readValue(event)) }
</script>

<template>
  <component
    :is="componentName"
    class="property-control"
    :type="inputType"
    :checked="checkedValue"
    :value="valueAttribute"
    :disabled="disabled"
    @input="change"
    @change="change"
  >
    <option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option>
  </component>
</template>
