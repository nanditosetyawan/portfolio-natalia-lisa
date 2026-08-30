import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { createDefaultSiteSnapshot } from '../data/default/site'
import { createEditorSnapshot } from '../editor/editorSnapshot'
import {
  deleteLibraryMedia,
  downloadMediaAsset,
  isManagedLibraryPath,
  listMediaAssetMetadata,
  moveLibraryMedia,
  renameMediaAssetMetadata,
  resolveMediaAssetPreview,
  uploadLibraryMedia
} from '../repositories/mediaRepository'
import { editorDraftRepository, editorPublishRepository, type RevisionRecord } from '../repositories/editorRevisionRepository'
import type { EditorSnapshot, SnapshotMediaReference } from '../types/editorSnapshot'
import type {
  MediaAssetKind,
  MediaAssetRow,
  MediaAssetUsage,
  MediaLibraryAsset,
  MediaLibraryFilter,
  MediaLibrarySort
} from '../types/mediaLibrary'

const FAVORITES_KEY = 'portfolio:media-favorites:v1'

interface AssetAccumulator {
  reference: SnapshotMediaReference | null
  row: MediaAssetRow | null
  usages: MediaAssetUsage[]
  locations: Set<'draft' | 'published'>
  builtIn: boolean
}

function parseNumber(value: number | string | null): number | null {
  if (value === null || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function fileName(path: string | null): string {
  return path?.split('/').pop()?.replace(/\.[^.]+$/, '') ?? ''
}

function titleCase(value: string): string {
  return value.replace(/[._:-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function classifyAsset(name: string, mimeType: string, usages: MediaAssetUsage[]): MediaAssetKind {
  const haystack = `${name} ${mimeType} ${usages.map((usage) => `${usage.role} ${usage.label}`).join(' ')}`.toLowerCase()
  if (mimeType.includes('svg') || /\bicon\b/.test(haystack)) return 'icon'
  if (/\blogo\b/.test(haystack)) return 'logo'
  if (/background|backdrop|wallpaper/.test(haystack)) return 'background'
  return 'image'
}

function usageLabel(snapshot: EditorSnapshot, entityId: string): { label: string; section: string } {
  const entity = snapshot.entities.find((candidate) => candidate.entityId === entityId)
  if (entity) return { label: entity.label, section: entity.section }
  return { label: titleCase(entityId), section: titleCase(entityId.split(/[-.:]/)[0] ?? 'Media') }
}

function safeFavoriteIds(): Set<string> {
  if (typeof localStorage === 'undefined') return new Set()
  try {
    const parsed = JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? '[]')
    return new Set(Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [])
  } catch {
    return new Set()
  }
}

function sourceLocation(locations: Set<'draft' | 'published'>): MediaLibraryAsset['location'] {
  if (locations.has('draft') && locations.has('published')) return 'Both'
  if (locations.has('published')) return 'Published'
  if (locations.has('draft')) return 'Draft'
  return 'Library'
}

function appendSnapshot(
  target: Map<string, AssetAccumulator>,
  snapshot: EditorSnapshot,
  source: MediaAssetUsage['source'],
  revision: RevisionRecord | null,
  builtIn = false
): void {
  const references = new Map(snapshot.media.references.map((reference) => [reference.assetId, reference]))
  for (const reference of snapshot.media.references) {
    const accumulator = target.get(reference.assetId) ?? { reference: null, row: null, usages: [], locations: new Set(), builtIn: false }
    accumulator.reference = reference
    accumulator.builtIn ||= builtIn
    if (source === 'draft' || source === 'published') accumulator.locations.add(source)
    target.set(reference.assetId, accumulator)
  }
  for (const assignment of snapshot.media.assignments) {
    if (!references.has(assignment.assetId)) continue
    const accumulator = target.get(assignment.assetId)
    if (!accumulator) continue
    const identity = usageLabel(snapshot, assignment.entityId)
    accumulator.usages.push({
      id: `${source}:${revision?.id ?? 'template'}:${assignment.entityId}:${assignment.role}`,
      entityId: assignment.entityId,
      label: identity.label,
      section: identity.section,
      role: assignment.role,
      source,
      revisionId: revision?.id ?? null,
      revisionNumber: revision?.revision_number ?? null,
      usedAt: revision?.updated_at ?? null
    })
  }
  for (const [entityId, background] of Object.entries(snapshot.backgrounds)) {
    const assetId = background.imageAssetId
    if (!assetId || !references.has(assetId)) continue
    const accumulator = target.get(assetId)
    if (!accumulator) continue
    const identity = usageLabel(snapshot, entityId)
    accumulator.usages.push({
      id: `${source}:${revision?.id ?? 'template'}:${entityId}:background`,
      entityId,
      label: identity.label,
      section: identity.section,
      role: 'background',
      source,
      revisionId: revision?.id ?? null,
      revisionNumber: revision?.revision_number ?? null,
      usedAt: revision?.updated_at ?? null
    })
  }
}

export const useMediaLibraryStore = defineStore('media-library', () => {
  const assets = ref<MediaLibraryAsset[]>([])
  const rows = ref<Record<string, MediaAssetRow>>({})
  const favoriteIds = ref<Set<string>>(safeFavoriteIds())
  const loading = ref(false)
  const mutating = ref(false)
  const error = ref('')
  const lastLoadedAt = ref<string | null>(null)

  const favoriteCount = computed(() => assets.value.filter((asset) => asset.isFavorite).length)

  function persistFavorites(): void {
    if (typeof localStorage !== 'undefined') localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favoriteIds.value]))
  }

  function synchronizeFavorites(): void {
    assets.value = assets.value.map((asset) => ({ ...asset, isFavorite: favoriteIds.value.has(asset.id) }))
  }

  async function refresh(): Promise<void> {
    loading.value = true
    error.value = ''
    try {
      const [metadataRows, drafts, published] = await Promise.all([
        listMediaAssetMetadata(),
        editorDraftRepository.listDrafts(),
        editorPublishRepository.getPublishedRevision()
      ])
      const accumulators = new Map<string, AssetAccumulator>()
      appendSnapshot(accumulators, createEditorSnapshot(createDefaultSiteSnapshot()), 'default', null, true)
      for (const draft of drafts) appendSnapshot(accumulators, draft.revision.snapshot, 'draft', draft.revision)
      if (published) appendSnapshot(accumulators, published.snapshot, 'published', published)

      for (const row of metadataRows) {
        const accumulator = accumulators.get(row.id) ?? { reference: null, row: null, usages: [], locations: new Set(), builtIn: false }
        accumulator.row = row
        accumulators.set(row.id, accumulator)
      }
      rows.value = Object.fromEntries(metadataRows.map((row) => [row.id, row]))

      const nextAssets = await Promise.all([...accumulators.entries()].map(async ([id, accumulator]): Promise<MediaLibraryAsset> => {
        const storagePath = accumulator.row?.storage_path ?? accumulator.reference?.storagePath ?? null
        const bucket = accumulator.row?.storage_bucket ?? accumulator.reference?.bucket ?? null
        const mimeType = accumulator.row?.mime_type || accumulator.reference?.mimeType || ''
        const name = accumulator.row?.alt_text || accumulator.reference?.alt || fileName(storagePath) || titleCase(id)
        let sourceUrl = accumulator.reference?.uri ?? accumulator.row?.source_url ?? ''
        if (accumulator.row) {
          try { sourceUrl = await resolveMediaAssetPreview(accumulator.row) || sourceUrl } catch { /* Keep canonical reference URL. */ }
        }
        const location = sourceLocation(accumulator.locations)
        const publishedUsage = location === 'Published' || location === 'Both'
        const managed = isManagedLibraryPath(storagePath)
        const safeToDelete = managed && !accumulator.builtIn && !publishedUsage && accumulator.usages.length === 0
        const safety: MediaLibraryAsset['safety'] = accumulator.builtIn
          ? 'built-in'
          : publishedUsage
            ? 'published'
            : accumulator.usages.length
              ? (location === 'Draft' ? 'draft-only' : 'used')
              : safeToDelete ? 'safe' : 'used'
        const usedDates = accumulator.usages.map((usage) => usage.usedAt).filter((value): value is string => Boolean(value))
        return {
          id,
          name,
          kind: classifyAsset(name, mimeType, accumulator.usages),
          mimeType,
          sourceUrl,
          thumbnailUrl: sourceUrl,
          bucket,
          storagePath,
          folder: storagePath?.split('/').slice(0, -1).join('/') ?? 'Built-in',
          width: accumulator.row?.width ?? accumulator.reference?.width ?? null,
          height: accumulator.row?.height ?? accumulator.reference?.height ?? null,
          fileSize: parseNumber(accumulator.row?.file_size ?? null),
          createdAt: accumulator.row?.created_at ?? null,
          updatedAt: accumulator.row?.updated_at ?? null,
          lastUsedAt: usedDates.sort().at(-1) ?? null,
          location,
          safety,
          safeToDelete,
          isBuiltIn: accumulator.builtIn,
          isFavorite: favoriteIds.value.has(id),
          metadataPersisted: Boolean(accumulator.row),
          usages: accumulator.usages.sort((left, right) => (right.usedAt ?? '').localeCompare(left.usedAt ?? '')),
          usageCount: accumulator.usages.length
        }
      }))
      assets.value = nextAssets.sort((left, right) => left.name.localeCompare(right.name))
      lastLoadedAt.value = new Date().toISOString()
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Asset Library could not be loaded.'
      throw cause
    } finally {
      loading.value = false
    }
  }

  function toggleFavorite(assetId: string, force?: boolean): void {
    const next = force ?? !favoriteIds.value.has(assetId)
    const favorites = new Set(favoriteIds.value)
    if (next) favorites.add(assetId)
    else favorites.delete(assetId)
    favoriteIds.value = favorites
    persistFavorites()
    synchronizeFavorites()
  }

  async function upload(file: File): Promise<MediaLibraryAsset> {
    mutating.value = true
    error.value = ''
    try {
      const result = await uploadLibraryMedia(file)
      await refresh()
      const asset = assets.value.find((candidate) => candidate.id === result.row.id)
      if (!asset) throw new Error('Uploaded asset was not indexed.')
      return asset
    } finally {
      mutating.value = false
    }
  }

  async function rename(asset: MediaLibraryAsset, name: string): Promise<void> {
    mutating.value = true
    try {
      const row = await renameMediaAssetMetadata({ id: asset.id, name, existing: rows.value[asset.id] ?? null })
      rows.value = { ...rows.value, [asset.id]: row }
      assets.value = assets.value.map((candidate) => candidate.id === asset.id ? { ...candidate, name: row.alt_text, metadataPersisted: true, updatedAt: row.updated_at } : candidate)
    } finally {
      mutating.value = false
    }
  }

  async function move(asset: MediaLibraryAsset, folder: string): Promise<void> {
    if (!asset.safeToDelete) throw new Error('Move is blocked while this asset is used or Published.')
    const row = rows.value[asset.id]
    if (!row) throw new Error('Asset metadata is not persisted.')
    mutating.value = true
    try {
      const updated = await moveLibraryMedia({ row, folder })
      rows.value = { ...rows.value, [asset.id]: updated }
      assets.value = assets.value.map((candidate) => candidate.id === asset.id ? {
        ...candidate,
        storagePath: updated.storage_path,
        folder: updated.storage_path?.split('/').slice(0, -1).join('/') ?? candidate.folder,
        updatedAt: updated.updated_at
      } : candidate)
    } finally {
      mutating.value = false
    }
  }

  async function remove(asset: MediaLibraryAsset): Promise<void> {
    if (!asset.safeToDelete) throw new Error('Delete is blocked because this asset is used, built in, or Published.')
    const row = rows.value[asset.id]
    if (!row) throw new Error('Asset metadata is not persisted.')
    mutating.value = true
    try {
      await deleteLibraryMedia(row)
      favoriteIds.value.delete(asset.id)
      persistFavorites()
      delete rows.value[asset.id]
      assets.value = assets.value.filter((candidate) => candidate.id !== asset.id)
    } finally {
      mutating.value = false
    }
  }

  async function download(asset: MediaLibraryAsset): Promise<void> {
    const blob = await downloadMediaAsset({ row: rows.value[asset.id] ?? null, url: asset.sourceUrl })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${asset.name || asset.id}.${asset.mimeType.split('/')[1]?.replace('svg+xml', 'svg') || 'bin'}`
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  function queryAssets(input: { search: string; filter: MediaLibraryFilter; sort: MediaLibrarySort }): MediaLibraryAsset[] {
    const search = input.search.trim().toLocaleLowerCase()
    const recentBoundary = Date.now() - 7 * 24 * 60 * 60 * 1000
    const filtered = assets.value.filter((asset) => {
      if (input.filter === 'images' && asset.kind !== 'image') return false
      if (input.filter === 'icons' && asset.kind !== 'icon') return false
      if (input.filter === 'backgrounds' && asset.kind !== 'background') return false
      if (input.filter === 'logos' && asset.kind !== 'logo') return false
      if (input.filter === 'unused' && asset.usageCount !== 0) return false
      if (input.filter === 'favorites' && !asset.isFavorite) return false
      if (input.filter === 'recent' && (!asset.createdAt || Date.parse(asset.createdAt) < recentBoundary)) return false
      if (!search) return true
      const haystack = [asset.name, asset.id, asset.kind, asset.mimeType, asset.folder, asset.location, asset.safety, ...asset.usages.flatMap((usage) => [usage.label, usage.section, usage.role])].join(' ').toLocaleLowerCase()
      return haystack.includes(search)
    })
    return filtered.sort((left, right) => {
      if (input.sort === 'oldest') return (left.createdAt ?? '').localeCompare(right.createdAt ?? '') || left.id.localeCompare(right.id)
      if (input.sort === 'name') return left.name.localeCompare(right.name) || left.id.localeCompare(right.id)
      if (input.sort === 'size') return (right.fileSize ?? -1) - (left.fileSize ?? -1) || left.id.localeCompare(right.id)
      if (input.sort === 'usage') return right.usageCount - left.usageCount || left.id.localeCompare(right.id)
      return (right.createdAt ?? '').localeCompare(left.createdAt ?? '') || left.id.localeCompare(right.id)
    })
  }

  return {
    assets,
    rows,
    favoriteIds,
    favoriteCount,
    loading,
    mutating,
    error,
    lastLoadedAt,
    refresh,
    queryAssets,
    toggleFavorite,
    upload,
    rename,
    move,
    remove,
    download
  }
})
