<script setup lang="ts">
import { computed } from 'vue'
import type { EditorControl, EditorValue } from '../../../../types/editor'

const props = defineProps<{
  control: EditorControl
  modelValue: string | number | boolean | null
  disabled?: boolean
  placeholder?: string
  enabledValue?: EditorValue
  label?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const value = computed(() => typeof props.modelValue === 'string' ? props.modelValue : '')
const enabled = computed(() => Boolean(value.value.trim()))
const inputType = computed(() => props.control === 'toggle-color' ? 'color' : 'text')

function toggle(event: Event): void {
  const checked = (event.target as HTMLInputElement).checked
  emit('update:modelValue', checked ? String(props.enabledValue ?? (props.control === 'toggle-color' ? '#49362f' : '0 8px 24px rgba(73,54,47,.2)')) : '')
}
</script>

<template>
  <div class="toggle-value-control">
    <label class="effect-toggle">
      <input type="checkbox" :checked="enabled" :disabled="disabled" :aria-label="`${label ?? 'Property'} enabled`" @change="toggle" />
      <span>{{ enabled ? 'On' : 'Off' }}</span>
    </label>
    <input
      :type="inputType"
      :value="value || String(enabledValue ?? '')"
      :disabled="disabled || !enabled"
      :placeholder="placeholder"
      :aria-label="label"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
  </div>
</template>

<style scoped>
.toggle-value-control { display: grid; grid-template-columns: 4rem minmax(0,1fr); gap: .45rem; align-items: center; }
.effect-toggle { min-height: 2.55rem; display: flex; align-items: center; justify-content: center; gap: .32rem; border: 1px solid rgba(73,54,47,.2); border-radius: 8px; background: #fff8ef; color: #72584f; font-size: .66rem; font-weight: 800; }
.effect-toggle input { width: .95rem !important; height: .95rem !important; }
</style>
