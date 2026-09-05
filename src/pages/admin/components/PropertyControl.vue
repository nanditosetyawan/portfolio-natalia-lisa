<script setup lang="ts">
import { computed } from 'vue'
import type { PropertyRegistryEntry } from '../../../types/editor'
import { getPropertyControlRenderer } from './propertyControlRegistry'

const props = defineProps<{
  property: PropertyRegistryEntry
  value: string | number | boolean | null
  disabled?: boolean
  themeColors?: string[]
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
const showUnit = computed(() => Boolean(props.property.unit) && ['number', 'text', 'custom'].includes(props.property.control))
</script>

<template>
  <div class="property-control-shell" :class="{ 'property-control-shell--unit': showUnit }">
    <component
      :is="renderer"
      v-bind="property.controlOptions"
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
      :theme-colors="themeColors"
      @update:model-value="emit('change', $event)"
      @file="emit('file', $event)"
      @action="emit('action')"
    />
    <span v-if="showUnit" class="property-unit" aria-hidden="true">{{ property.unit }}</span>
  </div>
</template>

<style scoped>
.property-control-shell { min-width: 0; width: 100%; }
.property-control-shell--unit { display: grid; grid-template-columns: minmax(0,1fr) auto; align-items: center; gap: .4rem; }
.property-unit { min-width: 1.5rem; color: #8a756b; font-size: .62rem; font-weight: 800; text-align: left; }
</style>
