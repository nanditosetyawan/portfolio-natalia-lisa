<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Download, ExternalLink, FolderInput, Grid3X3, Heart, Pencil, Search, Trash2, Upload, X } from 'lucide-vue-next'
import AssetVirtualGrid from './components/AssetVirtualGrid.vue'
import { useMediaLibraryStore } from '../../stores/mediaLibrary'
import type { MediaAssetUsage, MediaLibraryAsset, MediaLibraryFilter, MediaLibrarySort } from '../../types/mediaLibrary'

const route = useRoute()
const router = useRouter()
const library = useMediaLibraryStore()

const search = ref('')
const filter = ref<MediaLibraryFilter>('all')
const sort = ref<MediaLibrarySort>('newest')
const selectedIds = ref<string[]>([])
const primaryId = ref<string | null>(null)
const selectionAnchorId = ref<string | null>(null)
const uploadInput = ref<HTMLInputElement | null>(null)
const statusMessage = ref('')
const showDeleteDialog = ref(false)
const showRenameDialog = ref(false)
const showMoveDialog = ref(false)
const renameValue = ref('')
const moveFolder = ref('')

const filters: Array<{ value: MediaLibraryFilter; label: string }> = [
  { value: 'all', label: 'All assets' },
  { value: 'images', label: 'Images' },
  { value: 'icons', label: 'Icons' },
  { value: 'backgrounds', label: 'Background' },
  { value: 'logos', label: 'Logo' },
  { value: 'unused', label: 'Unused' },
  { value: 'recent', label: 'Recently uploaded' },
  { value: 'favorites', label: 'Favorites' }
]

const visibleAssets = computed(() => library.queryAssets({ search: search.value, filter: filter.value, sort: sort.value }))
const selectedAssets = computed(() => selectedIds.value.flatMap((id) => {
  const asset = library.assets.find((candidate) => candidate.id === id)
  return asset ? [asset] : []
}))
const selectedAsset = computed(() => library.assets.find((asset) => asset.id === primaryId.value) ?? selectedAssets.value[0] ?? null)
const deletableSelection = computed(() => selectedAssets.value.filter((asset) => asset.safeToDelete))
const movableSelection = computed(() => selectedAssets.value.length > 0 && selectedAssets.value.every((asset) => asset.safeToDelete))

function filterCount(value: MediaLibraryFilter): number {
  return library.queryAssets({ search: '', filter: value, sort: 'name' }).length
}

function selectAsset(asset: MediaLibraryAsset, mode: 'replace' | 'toggle' | 'range'): void {
  const visibleIds = visibleAssets.value.map((candidate) => candidate.id)
  if (mode === 'range' && selectionAnchorId.value) {
    const start = visibleIds.indexOf(selectionAnchorId.value)
    const end = visibleIds.indexOf(asset.id)
    if (start >= 0 && end >= 0) selectedIds.value = visibleIds.slice(Math.min(start, end), Math.max(start, end) + 1)
    else selectedIds.value = [asset.id]
  } else if (mode === 'toggle') {
    selectedIds.value = selectedIds.value.includes(asset.id)
      ? selectedIds.value.filter((id) => id !== asset.id)
      : [...selectedIds.value, asset.id]
    selectionAnchorId.value = asset.id
  } else {
    selectedIds.value = [asset.id]
    selectionAnchorId.value = asset.id
  }
  primaryId.value = selectedIds.value.includes(asset.id) ? asset.id : selectedIds.value.at(-1) ?? null
}

function selectAllVisible(): void {
  selectedIds.value = visibleAssets.value.map((asset) => asset.id)
  primaryId.value = selectedIds.value[0] ?? null
  selectionAnchorId.value = primaryId.value
}

function clearSelection(): void {
  selectedIds.value = []
  primaryId.value = null
  selectionAnchorId.value = null
}

function activateAsset(asset: MediaLibraryAsset): void {
  selectAsset(asset, 'replace')
}

function favoriteSelection(force = true): void {
  for (const asset of selectedAssets.value) library.toggleFavorite(asset.id, force)
  statusMessage.value = force ? `${selectedAssets.value.length} asset(s) added to media favorites.` : 'Removed from media favorites.'
}

function beginRename(): void {
  if (!selectedAssets.value.length) return
  renameValue.value = selectedAssets.value.length === 1 ? selectedAssets.value[0]?.name ?? '' : 'Asset'
  showRenameDialog.value = true
}

async function confirmRename(): Promise<void> {
  const targets = [...selectedAssets.value]
  if (!targets.length) return
  try {
    for (const [index, asset] of targets.entries()) {
      const name = targets.length === 1 ? renameValue.value : `${renameValue.value.trim()} ${String(index + 1).padStart(2, '0')}`
      await library.rename(asset, name)
    }
    showRenameDialog.value = false
    statusMessage.value = targets.length === 1
      ? `Renamed to ${renameValue.value.trim()}. Stable references were unchanged.`
      : `${targets.length} assets renamed with numbered metadata. Stable references were unchanged.`
  } catch (error) {
    statusMessage.value = error instanceof Error ? error.message : 'Rename failed.'
  }
}

function beginMove(): void {
  if (!movableSelection.value) return
  moveFolder.value = ''
  showMoveDialog.value = true
}

async function confirmMove(): Promise<void> {
  try {
    for (const asset of selectedAssets.value) await library.move(asset, moveFolder.value)
    showMoveDialog.value = false
    statusMessage.value = `${selectedAssets.value.length} asset(s) moved. Stable references were preserved.`
  } catch (error) {
    statusMessage.value = error instanceof Error ? error.message : 'Move failed.'
  }
}

async function confirmDelete(): Promise<void> {
  const targets = [...deletableSelection.value]
  try {
    for (const asset of targets) await library.remove(asset)
    showDeleteDialog.value = false
    clearSelection()
    statusMessage.value = `${targets.length} unused asset(s) deleted.`
  } catch (error) {
    statusMessage.value = error instanceof Error ? error.message : 'Delete failed.'
  }
}

async function downloadSelection(): Promise<void> {
  try {
    for (const asset of selectedAssets.value) await library.download(asset)
    statusMessage.value = `${selectedAssets.value.length} download(s) started.`
  } catch (error) {
    statusMessage.value = error instanceof Error ? error.message : 'Download failed.'
  }
}

async function uploadFiles(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const files = [...(input.files ?? [])]
  if (!files.length) return
  statusMessage.value = `Uploading ${files.length} asset(s)…`
  try {
    const uploaded: MediaLibraryAsset[] = []
    for (const file of files) uploaded.push(await library.upload(file))
    selectedIds.value = uploaded.map((asset) => asset.id)
    primaryId.value = uploaded.at(-1)?.id ?? null
    selectionAnchorId.value = primaryId.value
    statusMessage.value = `${uploaded.length} asset(s) uploaded to draft/library.`
  } catch (error) {
    statusMessage.value = error instanceof Error ? error.message : 'Upload failed.'
  } finally {
    input.value = ''
  }
}

function openUsage(usage: MediaAssetUsage): void {
  const draft = usage.source === 'draft' && usage.revisionId ? usage.revisionId : 'new'
  void router.push({ name: 'admin-edit', query: { draft, object: usage.entityId, source: 'media-library' } })
}

function formatBytes(value: number | null): string {
  if (value === null) return 'Not available'
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / (1024 * 1024)).toFixed(2)} MB`
}

function formatDate(value: string | null): string {
  if (!value || Date.parse(value) <= 0) return 'Not available'
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function aspectRatio(asset: MediaLibraryAsset): string {
  if (!asset.width || !asset.height) return 'Not available'
  return `${(asset.width / asset.height).toFixed(2)}:1`
}

function applyRouteState(): void {
  const requestedFilter = typeof route.query.filter === 'string' ? route.query.filter : ''
  if (filters.some((item) => item.value === requestedFilter)) filter.value = requestedFilter as MediaLibraryFilter
  const assetId = typeof route.query.asset === 'string' ? route.query.asset : null
  if (assetId && library.assets.some((asset) => asset.id === assetId)) {
    selectedIds.value = [assetId]
    primaryId.value = assetId
    selectionAnchorId.value = assetId
  }
}

watch(filter, (value) => {
  const nextQuery = { ...route.query }
  if (value === 'all') delete nextQuery.filter
  else nextQuery.filter = value
  void router.replace({ query: nextQuery })
})

watch(visibleAssets, (assets) => {
  const visibleIds = new Set(assets.map((asset) => asset.id))
  selectedIds.value = selectedIds.value.filter((id) => visibleIds.has(id))
  if (primaryId.value && !visibleIds.has(primaryId.value)) primaryId.value = selectedIds.value[0] ?? null
})

onMounted(async () => {
  try {
    await library.refresh()
    applyRouteState()
  } catch {
    statusMessage.value = 'Asset data could not be loaded. Retry when the connection is available.'
  }
})
</script>

<template>
  <main class="media-library-page">
    <header class="library-header">
      <div>
        <span class="eyebrow">Admin workspace</span>
        <h1>Asset Library</h1>
        <p>Search, inspect and safely manage every portfolio image reference.</p>
      </div>
      <div class="header-actions">
        <button type="button" class="secondary" :disabled="library.loading" @click="void library.refresh()">Refresh</button>
        <button type="button" class="primary" :disabled="library.mutating" @click="uploadInput?.click()"><Upload :size="16" />Upload</button>
        <input ref="uploadInput" class="sr-only" type="file" accept="image/*" multiple aria-label="Upload media files" @change="uploadFiles" />
      </div>
    </header>

    <section class="library-tools" aria-label="Asset search and sorting">
      <label class="search-control">
        <Search :size="17" aria-hidden="true" />
        <span class="sr-only">Search assets</span>
        <input v-model="search" type="search" placeholder="Search filename, type, usage or folder" data-media-search />
      </label>
      <label class="sort-control">
        <span>Sort</span>
        <select v-model="sort" aria-label="Sort assets">
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="name">Name</option>
          <option value="size">Size</option>
          <option value="usage">Usage count</option>
        </select>
      </label>
      <span class="asset-total"><Grid3X3 :size="15" />{{ visibleAssets.length }} of {{ library.assets.length }}</span>
    </section>

    <nav class="filter-tabs" aria-label="Asset filters">
      <button v-for="item in filters" :key="item.value" type="button" :class="{ active: filter === item.value }" :aria-pressed="filter === item.value" @click="filter = item.value">
        <span>{{ item.label }}</span><small>{{ filterCount(item.value) }}</small>
      </button>
    </nav>

    <section v-if="selectedIds.length" class="bulk-toolbar" role="toolbar" aria-label="Selected asset actions">
      <strong>{{ selectedIds.length }} selected</strong>
      <button type="button" @click="favoriteSelection(true)"><Heart :size="14" />Favorite</button>
      <button type="button" @click="beginRename"><Pencil :size="14" />Rename</button>
      <button type="button" :disabled="!movableSelection" :title="!movableSelection ? 'Only unused draft/library assets can be moved.' : undefined" @click="beginMove"><FolderInput :size="14" />Move</button>
      <button type="button" @click="void downloadSelection()"><Download :size="14" />Download</button>
      <button type="button" class="danger" :disabled="!deletableSelection.length" :title="!deletableSelection.length ? 'Used, Published and built-in assets cannot be deleted.' : undefined" @click="showDeleteDialog = true"><Trash2 :size="14" />Delete</button>
      <button type="button" class="clear-selection" @click="clearSelection"><X :size="14" />Clear</button>
    </section>

    <p v-if="library.error" class="library-error" role="alert">{{ library.error }} <button type="button" @click="void library.refresh()">Retry</button></p>
    <p class="library-status" aria-live="polite">{{ statusMessage }}</p>

    <div class="library-workspace">
      <section class="asset-browser" aria-label="Asset grid">
        <div class="browser-heading">
          <span>{{ filter === 'all' ? 'All assets' : filters.find((item) => item.value === filter)?.label }}</span>
          <button type="button" :disabled="!visibleAssets.length" @click="selectAllVisible">Select all shown</button>
        </div>
        <AssetVirtualGrid
          :assets="visibleAssets"
          :selected-ids="selectedIds"
          :primary-id="primaryId"
          :busy="library.loading"
          @select="selectAsset"
          @activate="activateAsset"
          @favorite="library.toggleFavorite($event.id)"
        />
      </section>

      <aside class="asset-details" aria-label="Asset details" aria-live="polite">
        <template v-if="selectedAsset">
          <div class="detail-preview">
            <iframe v-if="selectedAsset.sourceUrl && selectedAsset.mimeType === 'application/pdf'" :src="selectedAsset.sourceUrl" :title="selectedAsset.name" style="width:100%;height:100%;border:0;background:#fff" />
            <img v-else-if="selectedAsset.sourceUrl" :src="selectedAsset.sourceUrl" :alt="selectedAsset.name" />
            <span v-else>Preview unavailable</span>
            <button type="button" :aria-label="selectedAsset.isFavorite ? 'Remove from media favorites' : 'Add to media favorites'" :aria-pressed="selectedAsset.isFavorite" @click="library.toggleFavorite(selectedAsset.id)">
              <Heart :size="17" :fill="selectedAsset.isFavorite ? 'currentColor' : 'none'" />
            </button>
          </div>
          <div class="detail-heading">
            <span>{{ selectedAsset.kind }}</span>
            <h2>{{ selectedAsset.name }}</h2>
            <code>{{ selectedAsset.id }}</code>
          </div>
          <dl class="metadata-list">
            <div><dt>Dimensions</dt><dd>{{ selectedAsset.width && selectedAsset.height ? `${selectedAsset.width} × ${selectedAsset.height}` : 'Not available' }}</dd></div>
            <div><dt>Aspect ratio</dt><dd>{{ aspectRatio(selectedAsset) }}</dd></div>
            <div><dt>File size</dt><dd>{{ formatBytes(selectedAsset.fileSize) }}</dd></div>
            <div><dt>Mime type</dt><dd>{{ selectedAsset.mimeType || 'Not available' }}</dd></div>
            <div><dt>Uploaded</dt><dd>{{ formatDate(selectedAsset.createdAt) }}</dd></div>
            <div><dt>Last used</dt><dd>{{ formatDate(selectedAsset.lastUsedAt) }}</dd></div>
            <div><dt>Usage count</dt><dd>{{ selectedAsset.usageCount }}</dd></div>
            <div><dt>Location</dt><dd><span class="location-badge">{{ selectedAsset.location }}</span></dd></div>
            <div><dt>Folder</dt><dd>{{ selectedAsset.folder }}</dd></div>
            <div><dt>Delete status</dt><dd :class="{ safe: selectedAsset.safeToDelete }">{{ selectedAsset.safeToDelete ? 'Safe to delete' : selectedAsset.safety }}</dd></div>
          </dl>
          <section class="usage-section">
            <div><h3>Used in</h3><span>{{ selectedAsset.usageCount }}</span></div>
            <button v-for="usage in selectedAsset.usages" :key="usage.id" type="button" @click="openUsage(usage)">
              <span><strong>{{ usage.label }}</strong><small>{{ usage.section }} · {{ usage.role }} · {{ usage.source }}</small></span>
              <ExternalLink :size="14" aria-hidden="true" />
            </button>
            <p v-if="!selectedAsset.usages.length">This asset is not referenced by a Draft or Published Snapshot.</p>
          </section>
          <div class="detail-actions">
            <button type="button" @click="beginRename"><Pencil :size="14" />Rename metadata</button>
            <button type="button" @click="void library.download(selectedAsset)"><Download :size="14" />Download</button>
          </div>
          <p class="favorite-note">Media favorites are an Admin UI preference saved in this browser and are separate from Draft Favorites.</p>
        </template>
        <div v-else class="empty-details">
          <Grid3X3 :size="32" aria-hidden="true" />
          <h2>Select an asset</h2>
          <p>Metadata, storage safety and Editor usage will appear here.</p>
        </div>
      </aside>
    </div>

    <div v-if="showRenameDialog" class="dialog-backdrop" @click.self="showRenameDialog = false">
      <form class="library-dialog" role="dialog" aria-modal="true" aria-labelledby="rename-title" @submit.prevent="void confirmRename()">
        <h2 id="rename-title">Rename asset metadata</h2>
        <p>The asset ID and every existing reference stay unchanged. Multiple assets receive a numbered suffix.</p>
        <label><span>{{ selectedAssets.length === 1 ? 'Name' : 'Name prefix' }}</span><input v-model="renameValue" maxlength="150" required autofocus /></label>
        <div><button type="button" @click="showRenameDialog = false">Cancel</button><button type="submit" class="primary" :disabled="library.mutating">Rename</button></div>
      </form>
    </div>

    <div v-if="showMoveDialog" class="dialog-backdrop" @click.self="showMoveDialog = false">
      <form class="library-dialog" role="dialog" aria-modal="true" aria-labelledby="move-title" @submit.prevent="void confirmMove()">
        <h2 id="move-title">Move unused assets</h2>
        <p>Move is available only before an asset is referenced. Leave blank for the library root.</p>
        <label><span>Folder under draft/library/</span><input v-model="moveFolder" placeholder="campaign/portraits" /></label>
        <div><button type="button" @click="showMoveDialog = false">Cancel</button><button type="submit" class="primary" :disabled="library.mutating">Move</button></div>
      </form>
    </div>

    <div v-if="showDeleteDialog" class="dialog-backdrop" @click.self="showDeleteDialog = false">
      <section class="library-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-title">
        <h2 id="delete-title">Delete unused assets?</h2>
        <p>{{ deletableSelection.length }} safe asset(s) will be removed from draft/library and metadata. Used or Published assets are never included.</p>
        <div><button type="button" @click="showDeleteDialog = false">Cancel</button><button type="button" class="danger-action" :disabled="library.mutating" @click="void confirmDelete()">Delete permanently</button></div>
      </section>
    </div>
  </main>
</template>

<style scoped>
.media-library-page { display:flex;flex-direction:column;gap:.8rem;height:100%;min-height:0;padding:1.15rem 1.25rem 1.4rem;box-sizing:border-box;overflow:hidden;background:#f5f0e6;color:#4e3932; }
.library-header { display:flex;align-items:center;justify-content:space-between;gap:1rem; }.library-header h1 { margin:.08rem 0 .15rem;font:700 clamp(1.55rem,2vw,2.2rem)/1.05 Georgia,serif; }.library-header p { margin:0;color:#897267;font-size:.72rem; }.eyebrow { color:#ac5261;font-size:.58rem;font-weight:900;letter-spacing:.15em;text-transform:uppercase; }
.header-actions { display:flex;gap:.5rem; }.header-actions button { display:inline-flex;align-items:center;justify-content:center;gap:.4rem;border:1px solid rgba(91,67,57,.15);border-radius:11px;padding:.62rem .85rem;background:#fffdf8;color:#604941;font-weight:800;cursor:pointer; }.header-actions .primary,.library-dialog .primary { border-color:#a94f5e;background:#a94f5e;color:#fff; }
.library-tools { display:grid;grid-template-columns:minmax(240px,1fr) auto auto;align-items:center;gap:.65rem; }.search-control { display:flex;align-items:center;gap:.55rem;padding:.62rem .75rem;border:1px solid rgba(91,67,57,.15);border-radius:12px;background:#fffdf8;color:#a08a7e; }.search-control input { width:100%;border:0;outline:0;background:transparent;color:#4e3932;font:500 .76rem system-ui; }.sort-control { display:flex;align-items:center;gap:.35rem;padding:.42rem .55rem;border:1px solid rgba(91,67,57,.15);border-radius:11px;background:#fffdf8;color:#8a7368;font-size:.65rem;font-weight:800; }.sort-control select { border:0;background:transparent;color:#4e3932;font:700 .68rem system-ui; }.asset-total { display:inline-flex;align-items:center;gap:.35rem;color:#80695e;font-size:.66rem;font-weight:800; }
.filter-tabs { display:flex;gap:.42rem;overflow-x:auto;padding-bottom:.1rem;scrollbar-width:thin; }.filter-tabs button { display:inline-flex;align-items:center;gap:.4rem;flex:0 0 auto;border:1px solid rgba(91,67,57,.12);border-radius:999px;padding:.4rem .7rem;background:rgba(255,253,248,.72);color:#765f55;font:800 .63rem system-ui;cursor:pointer; }.filter-tabs button small { display:grid;place-items:center;min-width:1.2rem;height:1.2rem;padding:0 .18rem;border-radius:999px;background:rgba(91,67,57,.08);font-size:.55rem; }.filter-tabs button.active { border-color:#b85b69;background:#f3dfe0;color:#8e3f4c; }
.bulk-toolbar { display:flex;align-items:center;gap:.4rem;overflow-x:auto;min-height:2.45rem;padding:.38rem .48rem;border:1px solid rgba(184,91,105,.24);border-radius:13px;background:#fff7f1;box-shadow:0 .35rem 1rem rgba(73,54,47,.06); }.bulk-toolbar strong { padding:0 .42rem;white-space:nowrap;color:#934653;font-size:.66rem; }.bulk-toolbar button { display:inline-flex;align-items:center;gap:.28rem;flex:0 0 auto;border:1px solid rgba(91,67,57,.13);border-radius:8px;padding:.43rem .58rem;background:#fffdf8;color:#644b42;font:800 .61rem system-ui;cursor:pointer; }.bulk-toolbar button.danger { color:#9b434a; }.bulk-toolbar .clear-selection { margin-left:auto; }.bulk-toolbar button:disabled { opacity:.4;cursor:not-allowed; }
.library-error { margin:0;padding:.55rem .7rem;border-radius:10px;background:#fff0eb;color:#98474c;font-size:.7rem; }.library-error button { border:0;background:transparent;color:inherit;text-decoration:underline;cursor:pointer; }.library-status { min-height:1em;margin:-.35rem 0;color:#826c62;font-size:.63rem; }
.library-workspace { display:grid;grid-template-columns:minmax(0,1fr) minmax(285px,22vw);gap:.8rem;flex:1;min-height:0; }.asset-browser { display:grid;grid-template-rows:auto minmax(0,1fr);min-width:0;min-height:0;padding:.72rem;border:1px solid rgba(91,67,57,.12);border-radius:20px;background:rgba(255,253,248,.58); }.browser-heading { display:flex;align-items:center;justify-content:space-between;padding:0 .1rem .65rem;color:#6d554b;font-size:.68rem;font-weight:900; }.browser-heading button { border:0;background:transparent;color:#a04b5a;font-size:.61rem;font-weight:800;cursor:pointer; }.browser-heading button:disabled { opacity:.4; }
.asset-details { min-height:0;overflow:auto;padding:.8rem;border:1px solid rgba(91,67,57,.12);border-radius:20px;background:rgba(255,253,248,.88);scrollbar-gutter:stable; }.detail-preview { position:relative;display:grid;place-items:center;min-height:190px;overflow:hidden;border-radius:15px;background:linear-gradient(135deg,#eee5d7,#d9cdbc);color:#8b756a;font-size:.68rem; }.detail-preview img { width:100%;height:210px;object-fit:contain; }.detail-preview button { position:absolute;top:.55rem;right:.55rem;display:grid;place-items:center;width:2.1rem;height:2.1rem;border:1px solid rgba(255,255,255,.8);border-radius:50%;background:rgba(255,253,248,.94);color:#ad4d5e;cursor:pointer; }.detail-heading { padding:.78rem .1rem .55rem;border-bottom:1px solid rgba(91,67,57,.1); }.detail-heading>span { color:#aa5361;font-size:.55rem;font-weight:900;letter-spacing:.12em;text-transform:uppercase; }.detail-heading h2 { margin:.16rem 0 .3rem;overflow-wrap:anywhere;font:700 1.08rem/1.15 Georgia,serif; }.detail-heading code { color:#998378;font-size:.58rem;overflow-wrap:anywhere; }
.metadata-list { display:grid;gap:0;margin:.55rem 0; }.metadata-list div { display:grid;grid-template-columns:42% 58%;gap:.35rem;padding:.39rem .12rem;border-bottom:1px solid rgba(91,67,57,.07);font-size:.62rem; }.metadata-list dt { color:#927b70; }.metadata-list dd { margin:0;overflow-wrap:anywhere;color:#594139;font-weight:800;text-align:right; }.metadata-list dd.safe { color:#557a61; }.location-badge { padding:.2rem .4rem;border-radius:999px;background:#f1dfe0;color:#914652; }
.usage-section { margin-top:.7rem; }.usage-section>div { display:flex;align-items:center;justify-content:space-between; }.usage-section h3 { margin:0;font-size:.7rem; }.usage-section>div span { display:grid;place-items:center;min-width:1.4rem;height:1.4rem;border-radius:50%;background:#eee3d7;font-size:.58rem;font-weight:900; }.usage-section button { display:flex;align-items:center;justify-content:space-between;gap:.5rem;width:100%;margin-top:.38rem;border:1px solid rgba(91,67,57,.1);border-radius:10px;padding:.5rem .55rem;background:#fffaf4;color:#604941;text-align:left;cursor:pointer; }.usage-section button span { display:grid; }.usage-section button strong { font-size:.64rem; }.usage-section button small { color:#957d72;font-size:.55rem; }.usage-section p { color:#917a70;font-size:.62rem;line-height:1.45; }.detail-actions { display:grid;grid-template-columns:1fr 1fr;gap:.4rem;margin-top:.75rem; }.detail-actions button { display:inline-flex;align-items:center;justify-content:center;gap:.3rem;border:1px solid rgba(91,67,57,.13);border-radius:9px;padding:.5rem;background:#fff9f1;color:#684e45;font-size:.59rem;font-weight:800;cursor:pointer; }.favorite-note { padding:.55rem;border-radius:9px;background:#f4ede3;color:#8c7569;font-size:.56rem;line-height:1.45; }.empty-details { display:grid;place-items:center;align-content:center;min-height:100%;color:#927c71;text-align:center; }.empty-details h2 { margin:.6rem 0 .15rem;font:700 1rem Georgia,serif; }.empty-details p { max-width:220px;margin:0;font-size:.65rem;line-height:1.5; }
.dialog-backdrop { position:fixed;z-index:3000;inset:0;display:grid;place-items:center;padding:1rem;background:rgba(47,36,31,.34);backdrop-filter:blur(3px); }.library-dialog { width:min(440px,100%);padding:1.15rem;border:1px solid rgba(91,67,57,.16);border-radius:19px;background:#fffaf3;color:#4e3932;box-shadow:0 1.5rem 4rem rgba(49,37,32,.24); }.library-dialog h2 { margin:0 0 .3rem;font:700 1.25rem Georgia,serif; }.library-dialog p { margin:0 0 1rem;color:#897267;font-size:.7rem;line-height:1.5; }.library-dialog label { display:grid;gap:.35rem;color:#765e54;font-size:.65rem;font-weight:800; }.library-dialog input { border:1px solid rgba(91,67,57,.18);border-radius:10px;padding:.65rem;background:#fff;color:inherit; }.library-dialog>div { display:flex;justify-content:flex-end;gap:.45rem;margin-top:1rem; }.library-dialog button { border:1px solid rgba(91,67,57,.14);border-radius:10px;padding:.58rem .82rem;background:#fff;color:#604941;font-weight:800;cursor:pointer; }.library-dialog .danger-action { border-color:#a44951;background:#a44951;color:#fff; }
button:focus-visible,input:focus-visible,select:focus-visible { outline:3px solid rgba(184,91,105,.34);outline-offset:2px; }.sr-only { position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0; }
@media (max-width:900px) { .media-library-page { overflow:auto; }.library-workspace { grid-template-columns:1fr;min-height:900px; }.asset-details { max-height:560px; }.library-tools { grid-template-columns:1fr auto; }.asset-total { grid-column:1/-1; }.bulk-toolbar .clear-selection { margin-left:0; } }
@media (max-width:560px) { .library-header { align-items:flex-start;flex-direction:column; }.header-actions { width:100%; }.header-actions button { flex:1; }.library-tools { grid-template-columns:1fr; }.sort-control { justify-content:space-between; }.asset-total { grid-column:auto; }.media-library-page { padding:.85rem; }.detail-actions { grid-template-columns:1fr; } }
</style>
