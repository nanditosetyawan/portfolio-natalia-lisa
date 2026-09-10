<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import type { EditorControl } from '../../../../types/editor'

const props = defineProps<{
  control: EditorControl
  modelValue: string | number | boolean | null
  disabled?: boolean
  label?: string
  placeholder?: string
  step?: number
  minimum?: number
  maximum?: number
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string | number] }>()
const inputTypeByControl: Partial<Record<EditorControl, string>> = { text: 'text', custom: 'text', number: 'number', color: 'color' }
const inputType = computed(() => inputTypeByControl[props.control] ?? 'text')
const inputElement = ref<HTMLInputElement | null>(null)
const scrubElement = ref<HTMLButtonElement | null>(null)
const scrubActive = ref(false)
const dragThreshold = 3
let activePointerId: number | null = null
let dragStartX = 0
let lastPointerX = 0
let scrubValue = 0
let pointerLockPending = false
let pointerLockActive = false
let scrubSession = 0

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
  if (event.currentTarget !== document.activeElement) return
  event.preventDefault()
  nudge(event.deltaY < 0 ? 1 : -1, event)
}

function handleKeydown(event: KeyboardEvent): void {
  if (props.control !== 'number' || !['ArrowUp', 'ArrowDown'].includes(event.key)) return
  event.preventDefault()
  nudge(event.key === 'ArrowUp' ? 1 : -1, event)
}

function beginDrag(event: PointerEvent): void {
  if (props.disabled || props.control !== 'number' || event.button !== 0) return
  endDrag(true)
  scrubSession += 1
  activePointerId = event.pointerId
  dragStartX = event.clientX
  lastPointerX = event.clientX
  scrubValue = currentNumber()
  window.addEventListener('pointermove', dragValue)
  window.addEventListener('pointerup', handlePointerEnd)
  window.addEventListener('pointercancel', handlePointerEnd)
  window.addEventListener('blur', handleWindowBlur)
  document.addEventListener('pointerlockchange', handlePointerLockChange)
  document.addEventListener('pointerlockerror', handlePointerLockError)
  document.addEventListener('keydown', handleScrubKeydown, true)
}

function dragValue(event: PointerEvent): void {
  if (activePointerId !== event.pointerId || pointerLockActive) return
  const totalMovement = event.clientX - dragStartX
  if (!scrubActive.value && Math.abs(totalMovement) < dragThreshold) return
  if (!scrubActive.value) {
    scrubActive.value = true
    document.documentElement.classList.add('is-numeric-scrubbing')
    requestScrubPointerLock()
  }
  event.preventDefault()
  const movement = event.clientX - lastPointerX
  lastPointerX = event.clientX
  applyScrubMovement(movement, event)
}

function applyScrubMovement(
  movement: number,
  event: Pick<MouseEvent | PointerEvent, 'shiftKey' | 'altKey'>
): void {
  if (!movement) return
  scrubValue = normalizedNumber(scrubValue + (movement / 4) * modifierStep(event))
  emit('update:modelValue', scrubValue)
}

function requestScrubPointerLock(): void {
  const element = scrubElement.value
  if (!element || typeof element.requestPointerLock !== 'function' || document.pointerLockElement || pointerLockPending) return
  pointerLockPending = true
  const requestSession = scrubSession
  try {
    const result = element.requestPointerLock()
    if (result && typeof result.then === 'function') {
      void result.then(() => {
        if (requestSession !== scrubSession || activePointerId === null) {
          if (document.pointerLockElement === element && typeof document.exitPointerLock === 'function') document.exitPointerLock()
          return
        }
        pointerLockPending = false
      }).catch(() => {
        if (requestSession === scrubSession) pointerLockPending = false
      })
    }
  } catch {
    pointerLockPending = false
  }
}

function handlePointerLockChange(): void {
  const ownsLock = document.pointerLockElement === scrubElement.value
  pointerLockPending = false
  if (ownsLock) {
    pointerLockActive = true
    document.addEventListener('mousemove', handleLockedMovement)
    return
  }
  if (pointerLockActive) endDrag(false)
}

function handlePointerLockError(): void {
  pointerLockPending = false
}

function handleLockedMovement(event: MouseEvent): void {
  if (!pointerLockActive || document.pointerLockElement !== scrubElement.value) return
  event.preventDefault()
  applyScrubMovement(event.movementX, event)
}

function handlePointerEnd(event: PointerEvent): void {
  if (activePointerId !== event.pointerId) return
  const wasScrubbing = scrubActive.value
  endDrag(true)
  if (!wasScrubbing) inputElement.value?.focus()
}

function handleWindowBlur(): void {
  endDrag(true)
}

function handleScrubKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape') return
  event.preventDefault()
  endDrag(true)
}

function endDrag(exitLock = true): void {
  const ownsLock = document.pointerLockElement === scrubElement.value
  window.removeEventListener('pointermove', dragValue)
  window.removeEventListener('pointerup', handlePointerEnd)
  window.removeEventListener('pointercancel', handlePointerEnd)
  window.removeEventListener('blur', handleWindowBlur)
  document.removeEventListener('pointerlockchange', handlePointerLockChange)
  document.removeEventListener('pointerlockerror', handlePointerLockError)
  document.removeEventListener('mousemove', handleLockedMovement)
  document.removeEventListener('keydown', handleScrubKeydown, true)
  document.documentElement.classList.remove('is-numeric-scrubbing')
  activePointerId = null
  scrubSession += 1
  pointerLockPending = false
  pointerLockActive = false
  scrubActive.value = false
  if (exitLock && ownsLock && typeof document.exitPointerLock === 'function') document.exitPointerLock()
}

onBeforeUnmount(() => endDrag(true))
</script>

<template>
  <div class="property-input" :class="{ 'property-input--numeric': control === 'number' }">
    <button
      v-if="control === 'number'"
      ref="scrubElement"
      type="button"
      class="numeric-scrub"
      :class="{ 'numeric-scrub--active': scrubActive }"
      :disabled="disabled"
      :aria-label="`Drag to change ${label ?? 'numeric value'}`"
      :aria-pressed="scrubActive"
      title="Drag horizontally · Shift ×10 · Alt ×0.1"
      @pointerdown="beginDrag"
    >↔</button>
    <input
      ref="inputElement"
      :type="inputType"
      :value="modelValue ?? ''"
      :disabled="disabled"
      :placeholder="placeholder"
      :aria-label="label"
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
.numeric-scrub--active { background: #eadbd2; color: #a44955; }
.numeric-scrub:disabled { cursor: not-allowed; }
.property-input--numeric input { border-radius: 0 8px 8px 0 !important; }
:global(html.is-numeric-scrubbing), :global(html.is-numeric-scrubbing *) { cursor: ew-resize !important; user-select: none !important; }
</style>
