<script setup lang="ts">
import { computed } from 'vue'
import type { EditorControl } from '../../../types/editor'

const props = defineProps<{
  property: {
    control: EditorControl
    label?: string
    options?: string[] | Array<{ label: string; value: string }>
    placeholder?: string
    accept?: string
  }
  value: string | number | boolean | null
  disabled?: boolean
}>()

const emit = defineEmits<{
  change: [value: string | number | boolean]
  file: [file: File]
  action: []
}>()

const componentByControl: Record<EditorControl, 'input' | 'textarea' | 'select' | 'button'> = {
  text: 'input', textarea: 'textarea', number: 'input', color: 'input', select: 'select', checkbox: 'input', file: 'input', button: 'button', custom: 'input'
}
const inputTypeByControl: Record<EditorControl, string> = {
  text: 'text', textarea: 'text', number: 'number', color: 'color', select: 'text', checkbox: 'checkbox', file: 'file', button: 'button', custom: 'text'
}
const valueReaderByControl: Partial<Record<EditorControl, (target: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement) => string | number | boolean>> = {
  text: (target) => target.value,
  textarea: (target) => target.value,
  number: (target) => Number(target.value),
  color: (target) => target.value,
  select: (target) => target.value,
  checkbox: (target) => (target as HTMLInputElement).checked,
  custom: (target) => target.value
}
const componentName = computed(() => componentByControl[props.property.control])
const inputType = computed(() => inputTypeByControl[props.property.control])
const checkedValue = computed(() => props.property.control === 'checkbox' ? Boolean(props.value) : undefined)
const valueAttribute = computed(() => ['checkbox', 'file', 'button'].includes(props.property.control) ? undefined : props.value ?? '')
const options = computed(() => (props.property.options ?? []).map((option) => typeof option === 'string' ? { label: option, value: option } : option))

function readValue(event: Event): string | number | boolean {
  const target = event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
  return valueReaderByControl[props.property.control]?.(target) ?? ''
}

function onInput(event: Event) {
  if (['text', 'textarea', 'number', 'color', 'custom'].includes(props.property.control)) emit('change', readValue(event))
}

function onChange(event: Event) {
  if (props.property.control === 'file') {
    const file = (event.target as HTMLInputElement).files?.[0]
    if (file) emit('file', file)
    return
  }
  if (['select', 'checkbox'].includes(props.property.control)) emit('change', readValue(event))
}

function onClick() {
  if (props.property.control === 'button') emit('action')
}
</script>

<template>
  <component
    :is="componentName"
    class="property-control"
    :type="inputType"
    :checked="checkedValue"
    :value="valueAttribute"
    :disabled="disabled"
    :placeholder="property.placeholder"
    :accept="property.accept"
    @input="onInput"
    @change="onChange"
    @click="onClick"
  >
    <option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option>
    <template v-if="property.control === 'button'">{{ property.label }}</template>
  </component>
</template>
