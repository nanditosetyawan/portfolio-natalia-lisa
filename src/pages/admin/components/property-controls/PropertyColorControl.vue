<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: string | number | boolean | null
  disabled?: boolean
  label?: string
  themeColors?: string[]
}>(), { themeColors: () => [] })
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

interface RgbaColor { r: number; g: number; b: number; a: number }
interface EyeDropperResult { sRGBHex: string }
interface EyeDropperInstance { open: () => Promise<EyeDropperResult> }
type EyeDropperConstructor = new () => EyeDropperInstance

const root = ref<HTMLElement | null>(null)
const popover = ref<HTMLElement | null>(null)
const open = ref(false)
const popoverStyle = ref<Record<string, string>>({})
const hexText = ref('#49362f')
const red = ref(73)
const green = ref(54)
const blue = ref(47)
const alpha = ref(1)
const recent = ref<string[]>([])
const eyedropper = computed(() => typeof window !== 'undefined' && 'EyeDropper' in window)
const globalColors = computed(() => [...new Set(props.themeColors.filter((color) => parseColor(color)))].slice(0, 12))

function clampChannel(value: number): number {
  return Math.min(255, Math.max(0, Math.round(Number.isFinite(value) ? value : 0)))
}

function clampAlpha(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 1))
}

function parseColor(value: string): RgbaColor | null {
  const input = value.trim()
  const hex = input.match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i)?.[1]
  if (hex) {
    const expanded = hex.length === 3 ? [...hex].map((part) => `${part}${part}`).join('') : hex
    return {
      r: Number.parseInt(expanded.slice(0, 2), 16),
      g: Number.parseInt(expanded.slice(2, 4), 16),
      b: Number.parseInt(expanded.slice(4, 6), 16),
      a: expanded.length === 8 ? Number.parseInt(expanded.slice(6, 8), 16) / 255 : 1
    }
  }
  const rgb = input.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i)
  return rgb ? { r: clampChannel(Number(rgb[1])), g: clampChannel(Number(rgb[2])), b: clampChannel(Number(rgb[3])), a: clampAlpha(Number(rgb[4] ?? 1)) } : null
}

function hexChannel(value: number): string {
  return clampChannel(value).toString(16).padStart(2, '0')
}

function colorValue(): string {
  const base = `#${hexChannel(red.value)}${hexChannel(green.value)}${hexChannel(blue.value)}`
  return alpha.value >= .999 ? base : `${base}${hexChannel(alpha.value * 255)}`
}

function sync(value: string): void {
  const parsed = parseColor(value)
  if (!parsed) {
    hexText.value = value || '#49362f'
    return
  }
  red.value = parsed.r
  green.value = parsed.g
  blue.value = parsed.b
  alpha.value = Number(parsed.a.toFixed(3))
  hexText.value = colorValue()
}

function remember(value: string): void {
  recent.value = [value, ...recent.value.filter((color) => color.toLowerCase() !== value.toLowerCase())].slice(0, 8)
  try { localStorage.setItem('portfolio-editor-recent-colors', JSON.stringify(recent.value)) } catch { /* browser storage is optional */ }
}

function publish(): void {
  const value = colorValue()
  hexText.value = value
  remember(value)
  emit('update:modelValue', value)
}

function updateHex(event: Event): void {
  const value = (event.target as HTMLInputElement).value
  hexText.value = value
  const parsed = parseColor(value)
  if (!parsed) return
  red.value = parsed.r
  green.value = parsed.g
  blue.value = parsed.b
  alpha.value = parsed.a
  remember(value)
  emit('update:modelValue', value)
}

function chooseNative(event: Event): void {
  sync((event.target as HTMLInputElement).value)
  publish()
}

function chooseRecent(value: string): void {
  sync(value)
  emit('update:modelValue', value)
}

function updateChannel(channel: 'red' | 'green' | 'blue', event: Event, commit = false): void {
  const target = event.target as HTMLInputElement
  if (!commit && target.value.trim() === '') return
  const normalized = clampChannel(Number(target.value))
  if (channel === 'red') red.value = normalized
  else if (channel === 'green') green.value = normalized
  else blue.value = normalized
  if (commit || Number(target.value) !== normalized) target.value = String(normalized)
  publish()
}

function updatePopoverPosition(): void {
  if (!open.value || !root.value || !popover.value) return
  const trigger = root.value.getBoundingClientRect()
  const rect = popover.value.getBoundingClientRect()
  const pad = 12
  const gap = 8
  const width = rect.width || Math.min(268, window.innerWidth - 32)
  const height = Math.min(rect.height || 380, window.innerHeight - pad * 2)

  const spaceBelow = window.innerHeight - trigger.bottom - pad
  const spaceAbove = trigger.top - pad

  let top: number
  let left = trigger.left

  if (spaceBelow >= height + gap) {
    top = trigger.bottom + gap
  } else if (spaceAbove >= height + gap) {
    top = trigger.top - height - gap
  } else {
    top = Math.max(pad, Math.min(window.innerHeight - height - pad, trigger.top - height / 2))
    if (trigger.right + gap + width <= window.innerWidth - pad) left = trigger.right + gap
  }

  left = Math.max(pad, Math.min(window.innerWidth - width - pad, left))
  popoverStyle.value = { top: `${Math.round(top)}px`, left: `${Math.round(left)}px` }
}

function handleViewportChange(event?: Event): void {
  if (!open.value) return
  if (event && popover.value && event.target instanceof Node && popover.value.contains(event.target)) return
  updatePopoverPosition()
}

async function pickFromScreen(): Promise<void> {
  if (!eyedropper.value) return
  try {
    const Constructor = (window as unknown as { EyeDropper: EyeDropperConstructor }).EyeDropper
    const result = await new Constructor().open()
    sync(result.sRGBHex)
    publish()
  } catch { /* User cancelled the browser picker. */ }
}

function closeOnOutside(event: PointerEvent): void {
  if (open.value && root.value && !root.value.contains(event.target as Node)) open.value = false
}

watch(() => props.modelValue, (value) => sync(typeof value === 'string' ? value : ''), { immediate: true })
watch([open, () => recent.value.length, () => globalColors.value.length], async ([isOpen]) => {
  if (!isOpen) return
  await nextTick()
  updatePopoverPosition()
})

onMounted(() => {
  try {
    const saved = JSON.parse(localStorage.getItem('portfolio-editor-recent-colors') ?? '[]')
    if (Array.isArray(saved)) recent.value = saved.filter((value): value is string => typeof value === 'string').slice(0, 8)
  } catch { /* Ignore malformed optional recent-color storage. */ }
  document.addEventListener('pointerdown', closeOnOutside)
  window.addEventListener('resize', handleViewportChange)
  window.addEventListener('scroll', handleViewportChange, true)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', closeOnOutside)
  window.removeEventListener('resize', handleViewportChange)
  window.removeEventListener('scroll', handleViewportChange, true)
})
</script>

<template>
  <div ref="root" class="color-control" :class="{ 'is-open': open }" @keydown.esc="open = false">
    <button
      type="button"
      class="color-summary"
      :disabled="disabled"
      :aria-expanded="open"
      aria-haspopup="dialog"
      @click="open = !open"
    >
      <span class="color-swatch" :style="{ backgroundColor: typeof modelValue === 'string' ? modelValue : '#49362f' }" />
      <span>{{ typeof modelValue === 'string' ? modelValue : '#49362f' }}</span>
    </button>

    <section v-if="open" ref="popover" class="color-popover" :style="popoverStyle" role="dialog" :aria-label="`${label ?? 'Property'} color picker`">
      <div v-if="globalColors.length" class="color-choices" aria-label="Global colors">
        <span>Global colors</span>
        <button v-for="color in globalColors" :key="color" type="button" :title="color" :aria-label="`Use global color ${color}`" :style="{ backgroundColor: color }" @click="chooseRecent(color)" />
      </div>
      <span class="custom-heading">Custom</span>
      <div class="picker-head">
        <input type="color" :value="colorValue().slice(0, 7)" aria-label="Visual color" @input="chooseNative" @change="chooseNative" />
        <label><span>HEX</span><input :value="hexText" spellcheck="false" @input="updateHex" @change="updateHex" /></label>
      </div>
      <div class="rgb-grid">
        <label><span>R</span><input type="number" :value="red" min="0" max="255" step="1" :disabled="disabled" @input="updateChannel('red', $event)" @blur="updateChannel('red', $event, true)" /></label>
        <label><span>G</span><input type="number" :value="green" min="0" max="255" step="1" :disabled="disabled" @input="updateChannel('green', $event)" @blur="updateChannel('green', $event, true)" /></label>
        <label><span>B</span><input type="number" :value="blue" min="0" max="255" step="1" :disabled="disabled" @input="updateChannel('blue', $event)" @blur="updateChannel('blue', $event, true)" /></label>
      </div>
      <label class="alpha-control"><span>Opacity</span><input v-model.number="alpha" type="range" min="0" max="1" step="0.01" @input="publish" /><output>{{ Math.round(alpha * 100) }}%</output></label>
      <button v-if="eyedropper" type="button" class="eyedropper" @click="pickFromScreen">Eyedropper</button>
      <div v-if="recent.length" class="recent-colors" aria-label="Recent colors">
        <span>Recent colors</span>
        <button v-for="color in recent" :key="color" type="button" :title="color" :aria-label="`Use recent color ${color}`" :style="{ backgroundColor: color }" @click="chooseRecent(color)" />
      </div>
    </section>
  </div>
</template>

<style scoped>
.color-control { position: relative; }
.color-control.is-open { z-index: 1400; }
.color-summary { width: 100%; display: grid !important; grid-template-columns: 1.45rem minmax(0,1fr); align-items: center; gap: .5rem; text-align: left; }
.color-summary > span:last-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 700 .68rem/1.2 ui-monospace,monospace; }
.color-swatch { width: 1.35rem; height: 1.35rem; border: 1px solid rgba(73,54,47,.22); border-radius: 5px; box-shadow: inset 0 0 0 2px rgba(255,255,255,.55); }
.color-popover { position: fixed; z-index: 1500; width: min(268px, calc(100vw - 2rem)); max-height: calc(100vh - 24px); overflow-y: auto; padding: .75rem; border: 1px solid rgba(73,54,47,.18); border-radius: 14px; background: #fffaf4; box-shadow: 0 16px 40px rgba(73,54,47,.22); }
.picker-head { display: grid; grid-template-columns: 2.7rem minmax(0,1fr); gap: .55rem; align-items: end; }
.picker-head > input[type='color'] { width: 2.7rem !important; height: 2.55rem; padding: .12rem !important; }
.picker-head label,.rgb-grid label { display: grid; gap: .2rem; margin: 0; }
.picker-head span,.rgb-grid span,.recent-colors > span,.color-choices > span,.alpha-control > span,.custom-heading { color: #8a7166; font-size: .55rem; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; }
.custom-heading { display: block; margin: .7rem 0 .35rem; }
.rgb-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: .4rem; margin-top: .55rem; }
.rgb-grid input,.picker-head input:not([type='color']) { min-width: 0; width: 100%; padding: .45rem !important; }
.alpha-control { display: grid; grid-template-columns: auto minmax(0,1fr) 2.3rem; align-items: center; gap: .45rem; margin-top: .65rem; }
.alpha-control input { width: 100%; }.alpha-control output { font-size: .62rem; text-align: right; }
.eyedropper { margin-top: .6rem; }
.recent-colors,.color-choices { display: grid; grid-template-columns: repeat(8,1fr); gap: .25rem; align-items: center; margin-top: .65rem; }
.color-choices { grid-template-columns: repeat(6,1fr); margin-top: 0; }
.recent-colors > span,.color-choices > span { grid-column: 1/-1; }
.recent-colors button,.color-choices button { aspect-ratio: 1; min-width: 0; padding: 0 !important; border-radius: 6px !important; }
</style>
