<script setup lang="ts">
import { computed } from 'vue'
import type { PropertyRegistryEntry } from '../../../types/editor'
import { getPropertyControlRenderer } from './propertyControlRegistry'

const props = defineProps<{
  property: PropertyRegistryEntry
  value: string | number | boolean | null
  disabled?: boolean
}>()

const emit = defineEmits<{
  change: [value: string | number | boolean]
  file: [file: File]
  action: []
}>()

const renderer = computed(() => getPropertyControlRenderer(props.property.control))
const options = computed(() => (props.property.options ?? []).map((option) => (
  typeof option === 'string' ? { label: option, value: option } : option
)))
</script>

<template>
  <component
    :is="renderer"
    :control="property.control"
    :model-value="value"
    :disabled="disabled"
    :placeholder="property.placeholder"
    :accept="property.accept"
    :label="property.label"
    :options="options"
    :step="property.step"
    :minimum="property.minimum"
    :maximum="property.maximum"
    :enabled-value="property.enabledValue"
    @update:model-value="emit('change', $event)"
    @file="emit('file', $event)"
    @action="emit('action')"
  />
</template>
