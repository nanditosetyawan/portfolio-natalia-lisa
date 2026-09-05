<script setup lang="ts">
import { computed } from 'vue'
import PropertyColorControl from './PropertyColorControl.vue'
import PropertyInputControl from './PropertyInputControl.vue'

interface ShadowParts {
  x: number
  y: number
  blur: number
  spread: number
  color: string
  opacity: number
  custom: boolean
}

const props = withDefaults(defineProps<{
  modelValue: string | number | boolean | null
  disabled?: boolean
  label?: string
  allowSpread?: boolean
  themeColors?: string[]
}>(), { allowSpread: true, themeColors: () => [] })

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const fallback: ShadowParts = { x: 0, y: 8, blur: 24, spread: 0, color: '#49362f', opacity: 20, custom: false }

function channel(value: number): string {
  return Math.min(255, Math.max(0, Math.round(value))).toString(16).padStart(2, '0')
}

function parseColor(value: string): { color: string; opacity: number } | null {
  const input = value.trim()
  const hex = input.match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i)?.[1]
  if (hex) {
    const expanded = hex.length === 3 ? [...hex].map((part) => `${part}${part}`).join('') : hex
    return {
      color: `#${expanded.slice(0, 6)}`,
      opacity: expanded.length === 8 ? Math.round(Number.parseInt(expanded.slice(6, 8), 16) / 2.55) : 100
    }
  }
  const rgb = input.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i)
  if (!rgb) return null
  return {
    color: `#${channel(Number(rgb[1]))}${channel(Number(rgb[2]))}${channel(Number(rgb[3]))}`,
    opacity: Math.round(Math.min(1, Math.max(0, Number(rgb[4] ?? 1))) * 100)
  }
}

function parseShadow(value: string): ShadowParts {
  if (!value.trim()) return fallback
  if (value.includes(',') && !/^rgba?\([^)]*\)$/i.test(value.trim())) {
    const rgbaCommas = value.match(/rgba?\([^)]*\)/gi)?.join('') ?? ''
    if (value.replace(/rgba?\([^)]*\)/gi, '').includes(',')) return { ...fallback, custom: true }
    if (!rgbaCommas && value.includes(',')) return { ...fallback, custom: true }
  }
  const numeric = '(-?\\d+(?:\\.\\d+)?)(?:px)?'
  const pattern = props.allowSpread
    ? new RegExp(`^${numeric}\\s+${numeric}\\s+${numeric}(?:\\s+${numeric})?\\s+(.+)$`, 'i')
    : new RegExp(`^${numeric}\\s+${numeric}\\s+${numeric}\\s+(.+)$`, 'i')
  const match = value.trim().match(pattern)
  if (!match) return { ...fallback, custom: true }
  const colorIndex = props.allowSpread ? 5 : 4
  const parsedColor = parseColor(match[colorIndex] ?? '')
  if (!parsedColor) return { ...fallback, custom: true }
  return {
    x: Number(match[1]),
    y: Number(match[2]),
    blur: Math.max(0, Number(match[3])),
    spread: props.allowSpread ? Number(match[4] ?? 0) : 0,
    ...parsedColor,
    custom: false
  }
}

const rawValue = computed(() => typeof props.modelValue === 'string' ? props.modelValue : '')
const enabled = computed(() => Boolean(rawValue.value.trim()))
const parts = computed(() => parseShadow(rawValue.value))

function rgba(color: string, opacity: number): string {
  const hex = color.match(/^#([0-9a-f]{6})$/i)?.[1]
  if (!hex) return color
  const values = [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16))
  const alpha = Math.min(100, Math.max(0, opacity)) / 100
  return alpha >= .999 ? color : `rgba(${values[0]}, ${values[1]}, ${values[2]}, ${Number(alpha.toFixed(2))})`
}

function serialize(next: ShadowParts): string {
  const spread = props.allowSpread ? ` ${next.spread}px` : ''
  return `${next.x}px ${next.y}px ${next.blur}px${spread} ${rgba(next.color, next.opacity)}`
}

function update(patch: Partial<ShadowParts>): void {
  emit('update:modelValue', serialize({ ...parts.value, custom: false, ...patch }))
}

function toggle(event: Event): void {
  emit('update:modelValue', (event.target as HTMLInputElement).checked ? serialize(fallback) : '')
}
</script>

<template>
  <div class="shadow-control">
    <label class="effect-toggle">
      <input type="checkbox" :checked="enabled" :disabled="disabled" :aria-label="`${label ?? 'Shadow'} enabled`" @change="toggle" />
      <span>{{ enabled ? 'On' : 'Off' }}</span>
    </label>

    <template v-if="enabled">
      <p v-if="parts.custom" class="custom-note">This custom shadow is preserved. Use Advanced to edit its original value.</p>
      <button v-if="parts.custom" type="button" class="make-editable" :disabled="disabled" @click="emit('update:modelValue', serialize(fallback))">Use editable shadow</button>
      <template v-else>
        <div class="shadow-grid">
          <label><span>X</span><PropertyInputControl control="number" :model-value="parts.x" :disabled="disabled" label="Shadow X" @update:model-value="update({ x: Number($event) })" /></label>
          <label><span>Y</span><PropertyInputControl control="number" :model-value="parts.y" :disabled="disabled" label="Shadow Y" @update:model-value="update({ y: Number($event) })" /></label>
          <label><span>Blur</span><PropertyInputControl control="number" :model-value="parts.blur" :disabled="disabled" :minimum="0" label="Shadow blur" @update:model-value="update({ blur: Number($event) })" /></label>
          <label v-if="allowSpread"><span>Spread</span><PropertyInputControl control="number" :model-value="parts.spread" :disabled="disabled" label="Shadow spread" @update:model-value="update({ spread: Number($event) })" /></label>
        </div>
        <label class="shadow-color"><span>Color</span><PropertyColorControl :model-value="parts.color" :disabled="disabled" label="Shadow color" :theme-colors="themeColors" @update:model-value="update({ color: $event })" /></label>
        <label class="shadow-opacity"><span>Opacity</span><input type="range" min="0" max="100" step="1" :value="parts.opacity" :disabled="disabled" @input="update({ opacity: Number(($event.target as HTMLInputElement).value) })" /><output>{{ parts.opacity }}%</output></label>
      </template>
    </template>
  </div>
</template>

<style scoped>
.shadow-control { display: grid; gap: .55rem; }
.effect-toggle { min-height: 2.45rem; display: flex; align-items: center; justify-content: center; gap: .38rem; border: 1px solid rgba(73,54,47,.18); border-radius: 9px; background: #fff8ef; color: #72584f; font-size: .68rem; font-weight: 800; }
.effect-toggle input { width: 1rem; height: 1rem; accent-color: #b85b69; }
.shadow-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: .5rem; }
.shadow-grid label,.shadow-color { display: grid; gap: .25rem; min-width: 0; }
.shadow-grid label > span,.shadow-color > span,.shadow-opacity > span { color: #806b62; font-size: .58rem; font-weight: 850; }
.shadow-grid :deep(.property-input--numeric) { grid-template-columns: 1.45rem minmax(0,1fr); }
.shadow-grid :deep(.numeric-scrub) { font-size: .58rem; }
.shadow-opacity { display: grid; grid-template-columns: 3.2rem minmax(0,1fr) 2.35rem; align-items: center; gap: .45rem; }
.shadow-opacity input { min-width: 0; width: 100%; }.shadow-opacity output { color: #715a50; font-size: .62rem; text-align: right; }
.custom-note { margin: 0; color: #806b62; font-size: .64rem; line-height: 1.45; }
.make-editable { min-height: 2.2rem; }
</style>
