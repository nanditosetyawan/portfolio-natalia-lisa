<script setup lang="ts">
import { computed } from 'vue'
import PropertyColorControl from './PropertyColorControl.vue'
import PropertyInputControl from './PropertyInputControl.vue'

interface BorderParts { width: number; style: string; color: string; custom: boolean }

const props = withDefaults(defineProps<{
  modelValue: string | number | boolean | null
  disabled?: boolean
  label?: string
  themeColors?: string[]
}>(), { themeColors: () => [] })

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const fallback: BorderParts = { width: 1, style: 'solid', color: '#49362f', custom: false }
const styles = ['solid', 'dashed', 'dotted', 'double']

function parseBorder(value: string): BorderParts {
  if (!value.trim()) return fallback
  const match = value.trim().match(/^(\d+(?:\.\d+)?)(?:px)?\s+(solid|dashed|dotted|double)\s+(#[0-9a-f]{3,8}|rgba?\([^)]*\))$/i)
  return match ? { width: Number(match[1]), style: match[2].toLowerCase(), color: match[3], custom: false } : { ...fallback, custom: true }
}

const rawValue = computed(() => typeof props.modelValue === 'string' ? props.modelValue : '')
const enabled = computed(() => Boolean(rawValue.value.trim()))
const parts = computed(() => parseBorder(rawValue.value))

function serialize(next: BorderParts): string {
  return `${Math.max(0, next.width)}px ${next.style} ${next.color}`
}

function update(patch: Partial<BorderParts>): void {
  emit('update:modelValue', serialize({ ...parts.value, custom: false, ...patch }))
}

function toggle(event: Event): void {
  emit('update:modelValue', (event.target as HTMLInputElement).checked ? serialize(fallback) : '')
}
</script>

<template>
  <div class="border-control">
    <label class="effect-toggle">
      <input type="checkbox" :checked="enabled" :disabled="disabled" :aria-label="`${label ?? 'Border'} enabled`" @change="toggle" />
      <span>{{ enabled ? 'On' : 'Off' }}</span>
    </label>
    <template v-if="enabled">
      <p v-if="parts.custom" class="custom-note">This custom border is preserved. Use Advanced to edit its original value.</p>
      <button v-if="parts.custom" type="button" :disabled="disabled" @click="emit('update:modelValue', serialize(fallback))">Use editable border</button>
      <template v-else>
        <div class="border-grid">
          <label><span>Thickness</span><PropertyInputControl control="number" :model-value="parts.width" :disabled="disabled" :minimum="0" label="Border thickness" @update:model-value="update({ width: Number($event) })" /></label>
          <label><span>Style</span><select :value="parts.style" :disabled="disabled" aria-label="Border style" @change="update({ style: ($event.target as HTMLSelectElement).value })"><option v-for="style in styles" :key="style" :value="style">{{ style.charAt(0).toUpperCase() + style.slice(1) }}</option></select></label>
        </div>
        <label class="border-color"><span>Color</span><PropertyColorControl :model-value="parts.color" :disabled="disabled" label="Border color" :theme-colors="themeColors" @update:model-value="update({ color: $event })" /></label>
      </template>
    </template>
  </div>
</template>

<style scoped>
.border-control { display: grid; gap: .55rem; }
.effect-toggle { min-height: 2.45rem; display: flex; align-items: center; justify-content: center; gap: .38rem; border: 1px solid rgba(73,54,47,.18); border-radius: 9px; background: #fff8ef; color: #72584f; font-size: .68rem; font-weight: 800; }
.effect-toggle input { width: 1rem; height: 1rem; accent-color: #b85b69; }
.border-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: .5rem; }
.border-grid label,.border-color { display: grid; gap: .25rem; min-width: 0; }
.border-grid label > span,.border-color > span { color: #806b62; font-size: .58rem; font-weight: 850; }
.border-grid :deep(.property-input--numeric) { grid-template-columns: 1.45rem minmax(0,1fr); }
.custom-note { margin: 0; color: #806b62; font-size: .64rem; line-height: 1.45; }
</style>
