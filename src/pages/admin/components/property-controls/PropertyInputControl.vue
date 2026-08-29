<script setup lang="ts">
import { computed, onBeforeUnmount } from 'vue'
import type { EditorControl } from '../../../../types/editor'

const props = defineProps<{
  control: EditorControl
  modelValue: string | number | boolean | null
  disabled?: boolean
  placeholder?: string
  step?: number
  minimum?: number
  maximum?: number
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string | number] }>()
const inputTypeByControl: Partial<Record<EditorControl, string>> = { text: 'text', custom: 'text', number: 'number', color: 'color' }
const inputType = computed(() => inputTypeByControl[props.control] ?? 'text')
let dragStartX = 0
let dragStartValue = 0

function modifierStep(event: Pick<KeyboardEvent | WheelEvent | PointerEvent, 'shiftKey' | 'altKey'>): number {
  const base = props.step ?? 1
  return base * (event.shiftKey ? 10 : 1) * (event.altKey ? 0.1 : 1)
}

function normalizedNumber(value: number): number {
  const minimum = props.minimum ?? Number.NEGATIVE_INFINITY
  const maximum = props.maximum ?? Number.POSITIVE_INFINITY
  return Math.min(maximum, Math.max(minimum, Number(value.toFixed(4))))
}

function currentNumber(): number {
  const value = Number(props.modelValue)
  return Number.isFinite(value) ? value : 0
}

function nudge(direction: number, event: KeyboardEvent | WheelEvent): void {
  if (props.disabled || props.control !== 'number') return
  emit('update:modelValue', normalizedNumber(currentNumber() + modifierStep(event) * direction))
}

function update(event: Event): void {
  const value = (event.target as HTMLInputElement).value
  emit('update:modelValue', props.control === 'number' ? Number(value) : value)
}

function handleWheel(event: WheelEvent): void {
  if (props.control !== 'number' || props.disabled) return
  event.preventDefault()
  nudge(event.deltaY < 0 ? 1 : -1, event)
}

function handleKeydown(event: KeyboardEvent): void {
  if (props.control !== 'number' || !['ArrowUp', 'ArrowDown'].includes(event.key)) return
  event.preventDefault()
  nudge(event.key === 'ArrowUp' ? 1 : -1, event)
}

function beginDrag(event: PointerEvent): void {
  if (props.disabled || props.control !== 'number') return
  event.preventDefault()
  dragStartX = event.clientX
  dragStartValue = currentNumber()
  window.addEventListener('pointermove', dragValue)
  window.addEventListener('pointerup', endDrag, { once: true })
}

function dragValue(event: PointerEvent): void {
  const units = (event.clientX - dragStartX) / 4
  emit('update:modelValue', normalizedNumber(dragStartValue + units * modifierStep(event)))
}

function endDrag(): void {
  window.removeEventListener('pointermove', dragValue)
}

onBeforeUnmount(endDrag)
</script>

<template>
  <div class="property-input" :class="{ 'property-input--numeric': control === 'number' }">
    <button
      v-if="control === 'number'"
      type="button"
      class="numeric-scrub"
      :disabled="disabled"
      aria-label="Drag to change numeric value"
      title="Drag horizontally · Shift ×10 · Alt ×0.1"
      @pointerdown="beginDrag"
    >↔</button>
    <input
      :type="inputType"
      :value="modelValue ?? ''"
      :disabled="disabled"
      :placeholder="placeholder"
      :step="control === 'number' ? (step ?? 'any') : undefined"
      :min="control === 'number' ? minimum : undefined"
      :max="control === 'number' ? maximum : undefined"
      @input="update"
      @wheel="handleWheel"
      @keydown="handleKeydown"
    />
  </div>
</template>

<style scoped>
.property-input { min-width: 0; width: 100%; }
.property-input--numeric { display: grid; grid-template-columns: 1.85rem minmax(0,1fr); }
.numeric-scrub { width: 100%; min-width: 0; border: 1px solid rgba(73,54,47,.22); border-right: 0; border-radius: 8px 0 0 8px; padding: 0; background: #f5eee5; color: #8d5d51; cursor: ew-resize; font: 800 .72rem/1 system-ui; }
.numeric-scrub:disabled { cursor: not-allowed; }
.property-input--numeric input { border-radius: 0 8px 8px 0 !important; }
</style>
