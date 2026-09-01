<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { Heart, ImageOff, ShieldCheck } from 'lucide-vue-next'
import type { MediaLibraryAsset } from '../../../types/mediaLibrary'

const props = defineProps<{
  assets: MediaLibraryAsset[]
  selectedIds: string[]
  primaryId?: string | null
  busy?: boolean
}>()

const emit = defineEmits<{
  select: [asset: MediaLibraryAsset, mode: 'replace' | 'toggle' | 'range']
  activate: [asset: MediaLibraryAsset]
  favorite: [asset: MediaLibraryAsset]
}>()

const viewport = ref<HTMLElement | null>(null)
const viewportWidth = ref(0)
const viewportHeight = ref(0)
const scrollTop = ref(0)
let resizeObserver: ResizeObserver | null = null
let resizeFrameRequest = 0

const GAP = 16
const MIN_CARD_WIDTH = 190
const ROW_HEIGHT = 276
const OVERSCAN = 2

const columns = computed(() => Math.max(1, Math.floor((viewportWidth.value + GAP) / (MIN_CARD_WIDTH + GAP))))
const cardWidth = computed(() => Math.max(MIN_CARD_WIDTH, (viewportWidth.value - GAP * (columns.value - 1)) / columns.value))
const rowCount = computed(() => Math.ceil(props.assets.length / columns.value))
const canvasHeight = computed(() => Math.max(viewportHeight.value, rowCount.value * ROW_HEIGHT))
const startRow = computed(() => Math.max(0, Math.floor(scrollTop.value / ROW_HEIGHT) - OVERSCAN))
const endRow = computed(() => Math.min(rowCount.value, Math.ceil((scrollTop.value + viewportHeight.value) / ROW_HEIGHT) + OVERSCAN))
const visibleAssets = computed(() => props.assets.slice(startRow.value * columns.value, endRow.value * columns.value).map((asset, offset) => ({
  asset,
  index: startRow.value * columns.value + offset
})))

function updateMetrics(): void {
  if (!viewport.value) return
  const nextWidth = viewport.value.clientWidth
  const nextHeight = viewport.value.clientHeight
  if (viewportWidth.value !== nextWidth) viewportWidth.value = nextWidth
  if (viewportHeight.value !== nextHeight) viewportHeight.value = nextHeight
}

function scheduleMetrics(): void {
  if (resizeFrameRequest) return
  resizeFrameRequest = requestAnimationFrame(() => {
    resizeFrameRequest = 0
    updateMetrics()
  })
}

function cardStyle(index: number): Record<string, string> {
  const column = index % columns.value
  const row = Math.floor(index / columns.value)
  return {
    width: `${cardWidth.value}px`,
    transform: `translate(${column * (cardWidth.value + GAP)}px, ${row * ROW_HEIGHT}px)`
  }
}

function selectionMode(event: MouseEvent): 'replace' | 'toggle' | 'range' {
  if (event.shiftKey) return 'range'
  if (event.ctrlKey || event.metaKey) return 'toggle'
  return 'replace'
}

function select(asset: MediaLibraryAsset, event: MouseEvent): void {
  emit('select', asset, selectionMode(event))
}

function scrollIndexIntoView(index: number): void {
  if (!viewport.value) return
  const top = Math.floor(index / columns.value) * ROW_HEIGHT
  const bottom = top + ROW_HEIGHT
  if (top < viewport.value.scrollTop) viewport.value.scrollTop = top
  else if (bottom > viewport.value.scrollTop + viewport.value.clientHeight) viewport.value.scrollTop = bottom - viewport.value.clientHeight
}

function handleKeydown(event: KeyboardEvent, asset: MediaLibraryAsset): void {
  const index = props.assets.findIndex((candidate) => candidate.id === asset.id)
  if (index < 0) return
  let nextIndex = index
  if (event.key === 'ArrowRight') nextIndex += 1
  else if (event.key === 'ArrowLeft') nextIndex -= 1
  else if (event.key === 'ArrowDown') nextIndex += columns.value
  else if (event.key === 'ArrowUp') nextIndex -= columns.value
  else if (event.key === 'Home') nextIndex = 0
  else if (event.key === 'End') nextIndex = props.assets.length - 1
  else if (event.key === 'Enter') {
    event.preventDefault()
    emit('activate', asset)
    return
  } else if (event.key === ' ') {
    event.preventDefault()
    emit('select', asset, event.shiftKey ? 'range' : (event.ctrlKey || event.metaKey ? 'toggle' : 'replace'))
    return
  } else return
  event.preventDefault()
  nextIndex = Math.max(0, Math.min(props.assets.length - 1, nextIndex))
  const next = props.assets[nextIndex]
  if (!next) return
  emit('select', next, event.shiftKey ? 'range' : 'replace')
  scrollIndexIntoView(nextIndex)
  void nextTick(() => document.querySelector<HTMLElement>(`[data-asset-card-id="${CSS.escape(next.id)}"]`)?.focus())
}

function beginDrag(event: DragEvent, asset: MediaLibraryAsset): void {
  if (!event.dataTransfer) return
  event.dataTransfer.effectAllowed = 'copy'
  event.dataTransfer.setData('application/x-portfolio-asset', asset.id)
  event.dataTransfer.setData('text/plain', asset.id)
}

function formatBytes(value: number | null): string {
  if (value === null) return 'Unknown size'
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

function resolution(asset: MediaLibraryAsset): string {
  return asset.width && asset.height ? `${asset.width} × ${asset.height}` : 'Resolution unknown'
}

function aspectRatio(asset: MediaLibraryAsset): string {
  if (!asset.width || !asset.height) return '—'
  const divisor = greatestCommonDivisor(asset.width, asset.height)
  return `${Math.round(asset.width / divisor)}:${Math.round(asset.height / divisor)}`
}

function greatestCommonDivisor(left: number, right: number): number {
  let a = Math.round(left)
  let b = Math.round(right)
  while (b) [a, b] = [b, a % b]
  return Math.max(a, 1)
}

onMounted(() => {
  resizeObserver = new ResizeObserver(scheduleMetrics)
  if (viewport.value) resizeObserver.observe(viewport.value)
  updateMetrics()
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  if (resizeFrameRequest) cancelAnimationFrame(resizeFrameRequest)
})
</script>

<template>
  <div
    ref="viewport"
    class="asset-grid-viewport"
    role="grid"
    aria-label="Media assets"
    :aria-rowcount="rowCount"
    :aria-colcount="columns"
    :aria-busy="busy"
    @scroll="scrollTop = ($event.currentTarget as HTMLElement).scrollTop"
  >
    <div class="asset-grid-canvas" :style="{ height: `${canvasHeight}px` }">
      <article
        v-for="item in visibleAssets"
        :key="item.asset.id"
        class="asset-card"
        :class="{ 'is-selected': selectedIds.includes(item.asset.id) }"
        :style="cardStyle(item.index)"
        role="gridcell"
        :aria-selected="selectedIds.includes(item.asset.id)"
        :aria-rowindex="Math.floor(item.index / columns) + 1"
        :aria-colindex="(item.index % columns) + 1"
        :aria-label="`${item.asset.name}, ${resolution(item.asset)}, ${formatBytes(item.asset.fileSize)}, ${item.asset.usageCount} usages`"
        :tabindex="primaryId === item.asset.id || (!primaryId && item.index === 0) ? 0 : -1"
        :data-asset-card-id="item.asset.id"
        draggable="true"
        @click="select(item.asset, $event)"
        @dblclick="emit('activate', item.asset)"
        @keydown="handleKeydown($event, item.asset)"
        @dragstart="beginDrag($event, item.asset)"
      >
        <div class="asset-thumbnail">
          <img v-if="item.asset.thumbnailUrl" :src="item.asset.thumbnailUrl" :alt="item.asset.name" loading="lazy" decoding="async" />
          <ImageOff v-else :size="34" aria-hidden="true" />
          <span class="asset-kind">{{ item.asset.kind }}</span>
          <button
            type="button"
            class="favorite-button"
            :class="{ active: item.asset.isFavorite }"
            :aria-label="item.asset.isFavorite ? `Remove ${item.asset.name} from media favorites` : `Add ${item.asset.name} to media favorites`"
            :aria-pressed="item.asset.isFavorite"
            @click.stop="emit('favorite', item.asset)"
          ><Heart :size="16" :fill="item.asset.isFavorite ? 'currentColor' : 'none'" /></button>
        </div>
        <div class="asset-card-body">
          <strong :title="item.asset.name">{{ item.asset.name }}</strong>
          <span>{{ resolution(item.asset) }} · {{ aspectRatio(item.asset) }}</span>
          <span>{{ formatBytes(item.asset.fileSize) }} · {{ item.asset.usageCount }} {{ item.asset.usageCount === 1 ? 'usage' : 'usages' }}</span>
          <small :class="`safety-${item.asset.safety}`"><ShieldCheck :size="12" />{{ item.asset.safeToDelete ? 'Safe to delete' : item.asset.location }}</small>
        </div>
      </article>
    </div>
    <p v-if="!assets.length && !busy" class="empty-grid">No assets match this view.</p>
  </div>
</template>

<style scoped>
.asset-grid-viewport { position: relative; min-height: 360px; height: 100%; overflow: auto; overscroll-behavior: contain; outline: none; scrollbar-gutter: stable; }
.asset-grid-canvas { position: relative; min-width: 100%; }
.asset-card { position: absolute; top: 0; left: 0; height: 258px; overflow: hidden; border: 1px solid rgba(91,67,57,.14); border-radius: 17px; background: rgba(255,253,247,.92); color: #4e3932; box-shadow: 0 .2rem .6rem rgba(73,54,47,.04); cursor: pointer; transition: border-color .16s ease, box-shadow .16s ease, transform .16s ease; box-sizing: border-box; }
.asset-card:hover { border-color: rgba(184,91,105,.45); box-shadow: 0 .65rem 1.4rem rgba(73,54,47,.11); }
.asset-card.is-selected { border-color: #b85b69; box-shadow: 0 0 0 2px rgba(184,91,105,.18), 0 .7rem 1.5rem rgba(73,54,47,.12); }
.asset-card:focus-visible { outline: 3px solid rgba(184,91,105,.38); outline-offset: 2px; }
.asset-thumbnail { position: relative; display: grid; place-items: center; height: 164px; overflow: hidden; background: linear-gradient(135deg,#f0e9dc,#ddd2c0); color: #9d887d; }
.asset-thumbnail img { width: 100%; height: 100%; object-fit: cover; }
.asset-kind { position: absolute; left: .55rem; bottom: .5rem; padding: .22rem .45rem; border-radius: 999px; background: rgba(50,38,33,.78); color: #fff; font-size: .56rem; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
.favorite-button { position: absolute; top: .5rem; right: .5rem; display: grid; place-items: center; width: 2rem; height: 2rem; border: 1px solid rgba(255,255,255,.8); border-radius: 50%; background: rgba(255,253,247,.92); color: #7e6a60; cursor: pointer; }
.favorite-button.active { color: #b14d61; }
.favorite-button:focus-visible { outline: 3px solid rgba(184,91,105,.4); outline-offset: 2px; }
.asset-card-body { display: grid; gap: .2rem; padding: .72rem .78rem; }
.asset-card-body strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: .78rem; }
.asset-card-body span { color: #8c7568; font-size: .62rem; }
.asset-card-body small { display: inline-flex; align-items: center; gap: .22rem; width: fit-content; color: #8a7064; font-size: .58rem; font-weight: 800; }
.asset-card-body .safety-safe { color: #557a61; }
.asset-card-body .safety-published { color: #9f5964; }
.empty-grid { position: sticky; left: 0; display: grid; place-items: center; min-height: 320px; margin: 0; color: #8c7568; font-size: .8rem; }
@media (prefers-reduced-motion: reduce) { .asset-card { transition: none; } }
</style>
