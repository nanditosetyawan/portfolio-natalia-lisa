<script setup lang="ts">
import { computed } from 'vue'
import PropertyButtonControl from './PropertyButtonControl.vue'

const props = defineProps<{
  modelValue: string | number | boolean | null
  disabled?: boolean
  label?: string
}>()
const emit = defineEmits<{ action: [] }>()

interface TimelineSummary {
  mode: 'parallel' | 'sequential'
  duration: number
  delay: number
  tracks: string[]
}

const summary = computed<TimelineSummary>(() => {
  try {
    const value = JSON.parse(String(props.modelValue ?? '')) as Partial<TimelineSummary>
    return {
      mode: value.mode === 'sequential' ? 'sequential' : 'parallel',
      duration: Math.max(0, Number(value.duration) || 0),
      delay: Math.max(0, Number(value.delay) || 0),
      tracks: Array.isArray(value.tracks) ? value.tracks.filter((track): track is string => typeof track === 'string') : []
    }
  } catch {
    return { mode: 'parallel', duration: 0, delay: 0, tracks: [] }
  }
})

const totalDuration = computed(() => Math.max(1,
  summary.value.mode === 'sequential'
    ? summary.value.delay + summary.value.tracks.length * summary.value.duration
    : summary.value.delay + summary.value.duration
))

function previewTimeline(): void {
  emit('action')
}

function trackStyle(index: number): Record<string, string> {
  const start = summary.value.delay + (summary.value.mode === 'sequential' ? index * summary.value.duration : 0)
  return {
    marginInlineStart: `${Math.min(90, (start / totalDuration.value) * 100)}%`,
    width: `${Math.max(6, Math.min(100, (summary.value.duration / totalDuration.value) * 100))}%`
  }
}
</script>

<template>
  <div class="timeline-control" :aria-label="label">
    <div class="timeline-heading">
      <strong>{{ summary.mode }}</strong>
      <span>{{ summary.delay }} ms delay</span>
    </div>
    <div v-if="summary.tracks.length" class="timeline-tracks" role="list" aria-label="Animation timeline tracks">
      <div v-for="(track, index) in summary.tracks" :key="track" class="timeline-track" role="listitem">
        <span>{{ track }}</span>
        <div><i :style="trackStyle(index)" /></div>
      </div>
    </div>
    <p v-else>No active animation tracks.</p>
    <PropertyButtonControl
      :disabled="disabled || !summary.tracks.length"
      label="Preview timeline"
      @action="previewTimeline"
    />
  </div>
</template>

<style scoped>
.timeline-control { display: grid; gap: .55rem; width: 100%; }
.timeline-heading { display: flex; align-items: center; justify-content: space-between; gap: .5rem; color: #745d52; font-size: .62rem; }
.timeline-heading strong { text-transform: capitalize; }
.timeline-heading span { color: #a08a80; }
.timeline-tracks { display: grid; gap: .38rem; }
.timeline-track { display: grid; grid-template-columns: 4.4rem minmax(0, 1fr); align-items: center; gap: .4rem; color: #715a50; font-size: .58rem; }
.timeline-track > div { height: .42rem; overflow: hidden; border-radius: 999px; background: rgba(91, 67, 57, .08); }
.timeline-track i { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, #d47a82, #ff9a86); }
.timeline-control p { margin: 0; color: #9a867d; font-size: .62rem; }
.timeline-control button { min-height: 2.1rem; border: 1px solid rgba(184, 91, 105, .25); border-radius: 10px; background: #fff8f1; color: #8e3f4c; font-size: .64rem; font-weight: 800; cursor: pointer; }
.timeline-control button:disabled { cursor: not-allowed; opacity: .48; }
.timeline-control button:focus-visible { outline: 2px solid #b85b69; outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { .timeline-track i { transition: none; } }
</style>
