<script setup lang="ts">
defineProps<{
  modelValue: string | number | boolean | null
  disabled?: boolean
  options?: Array<{ label: string; value: string }>
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<template>
  <div class="segmented-control" role="group">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      :disabled="disabled"
      :aria-pressed="modelValue === option.value"
      :class="{ active: modelValue === option.value }"
      @click="emit('update:modelValue', option.value)"
    >{{ option.label }}</button>
  </div>
</template>

<style scoped>
.segmented-control { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; border: 1px solid rgba(73,54,47,.2); border-radius: 9px; overflow: hidden; }
.segmented-control button { min-width: 0; border: 0 !important; border-radius: 0 !important; padding: .58rem .28rem !important; background: #fffaf4 !important; color: #72584f !important; font-size: .62rem !important; }
.segmented-control button + button { border-left: 1px solid rgba(73,54,47,.14) !important; }
.segmented-control button.active { background: #8d5d51 !important; color: #fff !important; }
</style>
