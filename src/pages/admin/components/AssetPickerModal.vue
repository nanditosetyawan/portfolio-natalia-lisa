<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { Search, X } from 'lucide-vue-next'
import { useMediaLibraryStore } from '../../../stores/mediaLibrary'
import type { MediaLibraryAsset, MediaLibraryFilter } from '../../../types/mediaLibrary'
import AssetVirtualGrid from './AssetVirtualGrid.vue'

const props = withDefaults(defineProps<{
  open: boolean
  targetLabel?: string
  currentAssetId?: string | null
  mode?: 'insert' | 'replace' | 'browse'
}>(), { mode: 'insert' })

const emit = defineEmits<{
  close: []
  apply: [asset: MediaLibraryAsset]
}>()

const library = useMediaLibraryStore()
const panel = ref<HTMLElement | null>(null)
const search = ref('')
const filter = ref<MediaLibraryFilter>('all')
const selectedId = ref<string | null>(null)

const tabs: Array<{ value: MediaLibraryFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'favorites', label: 'Favorites' },
  { value: 'recent', label: 'Recent' }
]

const assets = computed(() => library
  .queryAssets({ search: search.value, filter: filter.value, sort: 'newest' })
  .filter((asset) => props.mode === 'browse' || asset.mimeType.startsWith('image/')))
const selectedAsset = computed(() => library.assets.find((asset) => asset.id === selectedId.value) ?? null)
const title = computed(() => props.mode === 'browse'
  ? 'Browse Media'
  : props.mode === 'replace'
    ? 'Replace Selected Image'
    : 'Choose from Media')
const description = computed(() => props.mode === 'browse'
  ? 'Browse reusable assets in the existing Media Library.'
  : props.mode === 'replace'
    ? `Choose an existing asset for ${props.targetLabel || 'the selected image'}. Its layout and styling will be preserved.`
    : `Add an existing asset as another image in ${props.targetLabel ? `${props.targetLabel}'s section` : 'the selected section'}.`)
const actionLabel = computed(() => props.mode === 'browse'
  ? 'Show in Media Library'
  : props.mode === 'replace'
    ? 'Replace Image'
    : 'Add Image')

function selectAsset(asset: MediaLibraryAsset): void {
  selectedId.value = asset.id
}

function applyAsset(asset = selectedAsset.value): void {
  if (asset) emit('apply', asset)
}

function resetView(): void {
  search.value = ''
  filter.value = 'all'
}

function handleDialogKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    emit('close')
  }
}

watch(() => props.open, async (open) => {
  if (!open) return
  selectedId.value = props.currentAssetId ?? assets.value[0]?.id ?? null
  if (!library.lastLoadedAt && !library.loading) {
    try { await library.refresh() } catch { /* Error is rendered in the picker. */ }
  }
  if (!selectedId.value) selectedId.value = props.currentAssetId ?? assets.value[0]?.id ?? null
  await nextTick()
  panel.value?.focus()
})
</script>

<template>
  <div v-if="open" class="asset-picker-layer" @keydown="handleDialogKeydown">
    <section ref="panel" class="asset-picker" role="dialog" aria-modal="false" aria-labelledby="asset-picker-title" tabindex="-1">
      <header>
        <div>
          <span class="eyebrow">Asset Library</span>
          <h2 id="asset-picker-title">{{ title }}</h2>
          <p>{{ description }}</p>
        </div>
        <button type="button" class="close-button" aria-label="Close asset picker" @click="emit('close')"><X :size="18" /></button>
      </header>

      <label class="picker-search">
        <Search :size="16" aria-hidden="true" />
        <span class="sr-only">Search media</span>
        <input v-model="search" type="search" placeholder="Search name, type, usage or folder" autofocus />
      </label>

      <nav class="picker-tabs" aria-label="Asset picker filters">
        <button v-for="tab in tabs" :key="tab.value" type="button" :class="{ active: filter === tab.value }" :aria-pressed="filter === tab.value" @click="filter = tab.value">{{ tab.label }}</button>
      </nav>

      <p v-if="library.error" class="picker-error" role="alert">{{ library.error }} <button type="button" @click="void library.refresh()">Retry</button></p>

      <div class="picker-grid">
        <AssetVirtualGrid
          :assets="assets"
          :selected-ids="selectedId ? [selectedId] : []"
          :primary-id="selectedId"
          :busy="library.loading"
          @select="selectAsset($event)"
          @activate="applyAsset($event)"
          @favorite="library.toggleFavorite($event.id)"
          @reset="resetView"
        />
      </div>

      <footer>
        <div v-if="selectedAsset" class="picker-selection">
          <img v-if="selectedAsset.thumbnailUrl" :src="selectedAsset.thumbnailUrl" alt="" />
          <span><strong>{{ selectedAsset.name }}</strong><small>{{ selectedAsset.location }} · {{ selectedAsset.usageCount }} usages</small></span>
        </div>
        <span v-else class="picker-selection-empty">Select an asset</span>
        <div class="picker-actions">
          <button type="button" @click="emit('close')">Cancel</button>
          <button type="button" class="primary" :disabled="!selectedAsset" @click="applyAsset()">{{ actionLabel }}</button>
        </div>
      </footer>
    </section>
  </div>
</template>

<style scoped>
.asset-picker-layer { position: fixed; z-index: 2400; inset: 0; display: flex; justify-content: flex-end; padding: 1rem; pointer-events: none; background: linear-gradient(90deg,transparent 25%,rgba(49,37,32,.08)); }
.asset-picker { display: grid; grid-template-rows: auto auto auto minmax(260px,1fr) auto; gap: .8rem; width: min(720px,calc(100vw - 2rem)); min-height: 0; padding: 1.1rem; border: 1px solid rgba(91,67,57,.16); border-radius: 22px; background: #f8f4eb; color: #4e3932; box-shadow: 0 1.5rem 4rem rgba(49,37,32,.24); pointer-events: auto; outline: none; }
.asset-picker > header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; }
.asset-picker h2 { margin: .12rem 0 .18rem; font: 700 1.45rem/1.1 Georgia,serif; }
.asset-picker p { margin: 0; color: #8a7468; font-size: .72rem; }
.eyebrow { color: #b05b68; font-size: .58rem; font-weight: 900; letter-spacing: .13em; text-transform: uppercase; }
.close-button { display: grid; place-items: center; width: 2.25rem; height: 2.25rem; border: 1px solid rgba(91,67,57,.14); border-radius: 50%; background: #fffdf8; color: inherit; cursor: pointer; }
.picker-search { display: flex; align-items: center; gap: .55rem; padding: .65rem .75rem; border: 1px solid rgba(91,67,57,.17); border-radius: 12px; background: #fffdf8; color: #9b8277; }
.picker-search input { min-width: 0; flex: 1; border: 0; outline: 0; background: transparent; color: #4e3932; font: 500 .76rem system-ui; }
.picker-tabs { display: flex; gap: .4rem; }
.picker-tabs button { border: 1px solid rgba(91,67,57,.13); border-radius: 999px; padding: .38rem .7rem; background: rgba(255,253,248,.8); color: #795f55; font-size: .65rem; font-weight: 800; cursor: pointer; }
.picker-tabs button.active { border-color: #b85b69; background: #f4dfe0; color: #8f3e4c; }
.picker-grid { min-height: 0; overflow: hidden; }
.picker-error { padding: .55rem .65rem; border-radius: 10px; background: #fff0eb; color: #954c4c !important; }.picker-error button { border: 0; background: transparent; color: inherit; text-decoration: underline; cursor: pointer; }
.asset-picker > footer { display: flex; align-items: center; justify-content: space-between; gap: .75rem; padding-top: .75rem; border-top: 1px solid rgba(91,67,57,.12); }
.picker-selection { display: flex; align-items: center; gap: .55rem; min-width: 0; }.picker-selection img { width: 42px; height: 42px; object-fit: cover; border-radius: 9px; }.picker-selection span { display: grid; min-width: 0; }.picker-selection strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: .72rem; }.picker-selection small,.picker-selection-empty { color: #927d72; font-size: .62rem; }
.picker-actions { display: flex; gap: .45rem; }.picker-actions button { border: 1px solid rgba(91,67,57,.15); border-radius: 10px; padding: .58rem .9rem; background: #fffdf8; color: #604941; font-weight: 800; cursor: pointer; }.picker-actions button.primary { border-color: #a64c5c; background: #a64c5c; color: white; }.picker-actions button:disabled { opacity: .45; cursor: not-allowed; }
.asset-picker button:focus-visible,.asset-picker input:focus-visible { outline: 3px solid rgba(184,91,105,.32); outline-offset: 2px; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
@media (max-width: 720px) { .asset-picker-layer { padding: 0; }.asset-picker { width: 100vw; height: 100dvh; border-radius: 0; }.asset-picker > footer { align-items: flex-end; }.picker-selection { max-width: 48%; } }
</style>
