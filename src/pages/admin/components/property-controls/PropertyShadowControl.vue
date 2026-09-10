<script setup lang="ts">
import { computed } from 'vue'
import {
  DEFAULT_SHADOW_VALUE,
  parseShadowValue,
  serializeShadowValue,
  type ShadowValueParts
} from '../../../../editor/shadowValue'
import PropertyColorControl from './PropertyColorControl.vue'
import PropertyInputControl from './PropertyInputControl.vue'

const props = withDefaults(defineProps<{
  modelValue: string | number | boolean | null
  disabled?: boolean
  label?: string
  allowSpread?: boolean
  themeColors?: string[]
}>(), { allowSpread: true, themeColors: () => [] })

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const rawValue = computed(() => typeof props.modelValue === 'string' ? props.modelValue : '')
const enabled = computed(() => Boolean(rawValue.value.trim()))
const parts = computed(() => parseShadowValue(rawValue.value, props.allowSpread))

function serialize(next: ShadowValueParts): string {
  return serializeShadowValue(next, props.allowSpread)
}

function update(patch: Partial<ShadowValueParts>): void {
  emit('update:modelValue', serialize({ ...parts.value, custom: false, ...patch }))
}

function toggle(event: Event): void {
  emit('update:modelValue', (event.target as HTMLInputElement).checked ? serialize(DEFAULT_SHADOW_VALUE) : '')
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
      <button v-if="parts.custom" type="button" class="make-editable" :disabled="disabled" @click="emit('update:modelValue', serialize(DEFAULT_SHADOW_VALUE))">Use editable shadow</button>
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
