<script setup lang="ts">
import { computed } from 'vue'
import { DEFAULT_BORDER_VALUE, parseBorderValue, serializeBorderValue, type BorderValueParts } from '../../../../editor/borderValue'
import PropertyColorControl from './PropertyColorControl.vue'
import PropertyInputControl from './PropertyInputControl.vue'

interface EditableBorderParts extends BorderValueParts { custom: boolean }

const props = withDefaults(defineProps<{
  modelValue: string | number | boolean | null
  disabled?: boolean
  label?: string
  themeColors?: string[]
  textOutline?: boolean
}>(), { themeColors: () => [] })

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const fallback: EditableBorderParts = { ...DEFAULT_BORDER_VALUE, custom: false }
const styles = ['solid', 'dashed', 'dotted', 'double']

function parseBorder(value: string): EditableBorderParts {
  if (!value.trim()) return fallback
  const parsed = parseBorderValue(value)
  return parsed ? { ...parsed, custom: false } : { ...fallback, custom: true }
}

const rawValue = computed(() => typeof props.modelValue === 'string' ? props.modelValue : '')
const enabled = computed(() => Boolean(rawValue.value.trim()))
const parts = computed(() => parseBorder(rawValue.value))

function update(patch: Partial<EditableBorderParts>): void {
  const next = { ...parts.value, custom: false, ...patch }
  emit('update:modelValue', serializeBorderValue({
    width: next.width,
    style: props.textOutline ? 'solid' : next.style,
    color: next.color
  }))
}

function toggle(event: Event): void {
  emit('update:modelValue', (event.target as HTMLInputElement).checked ? serializeBorderValue(DEFAULT_BORDER_VALUE) : '')
}
</script>

<template>
  <div class="border-control">
    <label class="effect-toggle">
      <input type="checkbox" :checked="enabled" :disabled="disabled" :aria-label="`${label ?? (textOutline ? 'Text Outline' : 'Border')} enabled`" @change="toggle" />
      <span>{{ enabled ? 'On' : 'Off' }}</span>
    </label>
    <template v-if="enabled">
      <p v-if="parts.custom" class="custom-note">This custom border is preserved. Use Advanced to edit its original value.</p>
      <button v-if="parts.custom" type="button" :disabled="disabled" @click="emit('update:modelValue', serializeBorderValue(DEFAULT_BORDER_VALUE))">Use editable {{ textOutline ? 'outline' : 'border' }}</button>
      <template v-else>
        <div class="border-grid" :class="{ 'border-grid--text-outline': textOutline }">
          <label><span>Thickness</span><PropertyInputControl control="number" :model-value="parts.width" :disabled="disabled" :minimum="0" :label="textOutline ? 'Text outline thickness' : 'Border thickness'" @update:model-value="update({ width: Number($event) })" /></label>
          <label v-if="!textOutline"><span>Style</span><select :value="parts.style" :disabled="disabled" aria-label="Border style" @change="update({ style: ($event.target as HTMLSelectElement).value as BorderValueParts['style'] })"><option v-for="style in styles" :key="style" :value="style">{{ style.charAt(0).toUpperCase() + style.slice(1) }}</option></select></label>
        </div>
        <label class="border-color"><span>Color</span><PropertyColorControl :model-value="parts.color" :disabled="disabled" :label="textOutline ? 'Text outline color' : 'Border color'" :theme-colors="themeColors" @update:model-value="update({ color: $event })" /></label>
      </template>
    </template>
  </div>
</template>

<style scoped>
.border-control { display: grid; gap: .55rem; }
.effect-toggle { min-height: 2.45rem; display: flex; align-items: center; justify-content: center; gap: .38rem; border: 1px solid rgba(73,54,47,.18); border-radius: 9px; background: #fff8ef; color: #72584f; font-size: .68rem; font-weight: 800; }
.effect-toggle input { width: 1rem; height: 1rem; accent-color: #b85b69; }
.border-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: .5rem; }
.border-grid--text-outline { grid-template-columns: minmax(0,1fr); }
.border-grid label,.border-color { display: grid; gap: .25rem; min-width: 0; }
.border-grid label > span,.border-color > span { color: #806b62; font-size: .58rem; font-weight: 850; }
.border-grid :deep(.property-input--numeric) { grid-template-columns: 1.45rem minmax(0,1fr); }
.custom-note { margin: 0; color: #806b62; font-size: .64rem; line-height: 1.45; }
</style>
