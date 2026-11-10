import { supabaseClient } from '../lib/supabaseClient'
import { isSupabaseConfigured, supabasePublicStorageUrl, supabaseRestRequest, supabaseRpc, supabaseTableRows } from '../lib/supabaseRest'
import { validateMediaUploadFile } from '../lib/mediaUploadRules'
import type { LibraryMediaUpload, MediaAssetRow } from '../types/mediaLibrary'

export const PORTFOLIO_MEDIA_BUCKET = 'portfolio-media'
const localLibraryRows = new Map<string, MediaAssetRow>()
const localPreviewUrls = new Map<string, string>()

function legacyImageExtension(file: File): string {
  const extension = file.name.split('.').pop()?.toLowerCase()
  if (extension && /^[a-z0-9]+$/.test(extension)) return extension
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'
  return 'jpg'
}

function assertImage(file: File): void {
  if (!file.type.startsWith('image/')) throw new Error('Only image files are allowed')
  if (file.size > 10 * 1024 * 1024) throw new Error('Image exceeds the 10 MB limit')
}

function browserUrl(value: string | null | undefined): value is string {
  return Boolean(value
    && !/^\/?(?:draft|published)\//i.test(value)
    && (/^(?:https?:|blob:|data:)/i.test(value) || value.startsWith('/')))
}

export function resolveMediaSource(input: {
  uri?: string | null
  sourceUrl?: string | null
  bucket?: string | null
  storagePath?: string | null
}, transientUrl?: string | null): string {
  if (browserUrl(transientUrl)) return transientUrl
  if (input.bucket === PORTFOLIO_MEDIA_BUCKET && input.storagePath && isSupabaseConfigured()) {
    return supabasePublicStorageUrl(input.bucket, input.storagePath)
  }
  if (browserUrl(input.sourceUrl)) return input.sourceUrl
  return browserUrl(input.uri) ? input.uri : ''
}

function safeFileStem(value: string): string {
  const stem = value.replace(/\.[^.]+$/, '').trim().replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '')
  return stem.slice(0, 80) || 'asset'
}

function normalizedFolder(value: string): string {
  return value
    .split('/')
    .map((part) => part.trim().replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, ''))
    .filter(Boolean)
    .slice(0, 4)
    .join('/')
}

async function imageDimensions(file: File): Promise<{ width: number | null; height: number | null }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file)
      const dimensions = { width: bitmap.width || null, height: bitmap.height || null }
      bitmap.close()
      return dimensions
    } catch {
      // Chromium does not consistently decode SVG files through createImageBitmap.
      // The native Image path below supports the same valid asset without changing
      // the repository or storage contract.
    }
  }
  if (typeof Image === 'undefined' || typeof URL === 'undefined') return { width: null, height: null }
  const objectUrl = URL.createObjectURL(file)
  try {
    return await new Promise((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve({ width: image.naturalWidth || null, height: image.naturalHeight || null })
      image.onerror = () => reject(new Error('Image dimensions could not be read.'))
      image.src = objectUrl
    })
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export async function uploadPortfolioMedia(input: { file: File; entityType: string; entityId: string; mediaId: string }) {
  assertImage(input.file)
  const path = `portfolio/${input.entityType}/${input.entityId}/${input.mediaId}.${legacyImageExtension(input.file)}`
  const { error } = await supabaseClient.storage.from(PORTFOLIO_MEDIA_BUCKET).upload(path, input.file, { upsert: true, contentType: input.file.type })
  if (error) throw new Error(`Storage upload failed: ${error.message}`)
  const { data } = supabaseClient.storage.from(PORTFOLIO_MEDIA_BUCKET).getPublicUrl(path)
  return { bucket: PORTFOLIO_MEDIA_BUCKET, path, publicUrl: data.publicUrl, mimeType: input.file.type, fileSize: input.file.size }
}

export async function removePortfolioMedia(path: string): Promise<void> {
  const { error } = await supabaseClient.storage.from(PORTFOLIO_MEDIA_BUCKET).remove([path])
  if (error) throw new Error(`Storage delete failed: ${error.message}`)
}

/** Additive Asset Library boundary. Existing upload/remove contracts above remain unchanged. */
export async function listMediaAssetMetadata(): Promise<MediaAssetRow[]> {
  if (!isSupabaseConfigured()) return [...localLibraryRows.values()].map((row) => ({ ...row }))
  return supabaseTableRows<MediaAssetRow>('media_assets', '?select=*&order=updated_at.desc')
}

export async function resolveMediaAssetPreview(row: MediaAssetRow): Promise<string> {
  return resolveMediaSource({
    sourceUrl: row.source_url,
    bucket: row.storage_bucket,
    storagePath: row.storage_path
  }, localPreviewUrls.get(row.id))
}

export async function uploadLibraryMedia(file: File): Promise<LibraryMediaUpload> {
  const validation = validateMediaUploadFile(file, 'library')
  const assetId = crypto.randomUUID()
  const storagePath = `draft/library/${assetId}.${validation.extension}`
  const dimensions = validation.kind === 'image'
    ? await imageDimensions(file)
    : { width: null, height: null }
  const now = new Date().toISOString()
  const row: MediaAssetRow = {
    id: assetId,
    storage_bucket: PORTFOLIO_MEDIA_BUCKET,
    storage_path: storagePath,
    mime_type: validation.mimeType,
    file_size: file.size,
    width: dimensions.width,
    height: dimensions.height,
    alt_text: safeFileStem(file.name),
    source_url: null,
    created_at: now,
    updated_at: now
  }

  if (!isSupabaseConfigured()) {
    const previewUrl = URL.createObjectURL(file)
    localLibraryRows.set(assetId, row)
    localPreviewUrls.set(assetId, previewUrl)
    return { row: { ...row }, previewUrl }
  }

  const { error } = await supabaseClient.storage.from(PORTFOLIO_MEDIA_BUCKET).upload(storagePath, file, {
    upsert: false,
    contentType: validation.mimeType,
    cacheControl: '3600'
  })
  if (error) throw new Error(`Asset upload failed: ${error.message}`)
  try {
    await supabaseRestRequest('media_assets', { method: 'POST', body: row, prefer: 'return=minimal' })
  } catch (error) {
    await supabaseClient.storage.from(PORTFOLIO_MEDIA_BUCKET).remove([storagePath])
    throw error
  }
  const previewUrl = await resolveMediaAssetPreview(row)
  return { row, previewUrl }
}

export async function renameMediaAssetMetadata(input: { id: string; name: string; existing?: MediaAssetRow | null }): Promise<MediaAssetRow> {
  const name = input.name.trim().slice(0, 160)
  if (!name) throw new Error('Asset name is required.')
  const now = new Date().toISOString()
  const existing = input.existing ?? localLibraryRows.get(input.id) ?? null
  const row: MediaAssetRow = existing
    ? { ...existing, alt_text: name, updated_at: now }
    : { id: input.id, storage_bucket: null, storage_path: null, mime_type: '', file_size: null, width: null, height: null, alt_text: name, source_url: null, created_at: now, updated_at: now }
  if (!isSupabaseConfigured()) {
    localLibraryRows.set(row.id, row)
    return { ...row }
  }
  await supabaseRestRequest('media_assets', {
    method: 'POST',
    body: row,
    prefer: 'resolution=merge-duplicates,return=minimal'
  })
  return row
}

export function isManagedLibraryPath(path: string | null): boolean {
  return Boolean(path?.startsWith('draft/library/'))
}

export async function moveLibraryMedia(input: { row: MediaAssetRow; folder: string }): Promise<MediaAssetRow> {
  if (!input.row.storage_bucket || !input.row.storage_path || !isManagedLibraryPath(input.row.storage_path)) {
    throw new Error('Only unused Asset Library uploads can be moved.')
  }
  const folder = normalizedFolder(input.folder)
  const filename = input.row.storage_path.split('/').pop()
  if (!filename) throw new Error('Asset storage path is invalid.')
  const nextPath = `draft/library/${folder ? `${folder}/` : ''}${filename}`
  if (nextPath === input.row.storage_path) return { ...input.row }
  if (!isSupabaseConfigured()) {
    const updated = { ...input.row, storage_path: nextPath, updated_at: new Date().toISOString() }
    localLibraryRows.set(updated.id, updated)
    return updated
  }
  const { error } = await supabaseClient.storage.from(input.row.storage_bucket).move(input.row.storage_path, nextPath)
  if (error) throw new Error(`Asset move failed: ${error.message}`)
  const updated = { ...input.row, storage_path: nextPath, updated_at: new Date().toISOString() }
  try {
    await supabaseRestRequest('media_assets', {
      method: 'PATCH',
      query: `?id=eq.${encodeURIComponent(input.row.id)}`,
      body: { storage_path: nextPath, updated_at: updated.updated_at },
      prefer: 'return=minimal'
    })
  } catch (error) {
    await supabaseClient.storage.from(input.row.storage_bucket).move(nextPath, input.row.storage_path)
    throw error
  }
  return updated
}

export async function deleteLibraryMedia(row: MediaAssetRow): Promise<void> {
  if (row.storage_path && !isManagedLibraryPath(row.storage_path)) throw new Error('Only unused Asset Library uploads can be deleted.')
  if (!isSupabaseConfigured()) {
    const preview = localPreviewUrls.get(row.id)
    if (preview) URL.revokeObjectURL(preview)
    localPreviewUrls.delete(row.id)
    localLibraryRows.delete(row.id)
    return
  }
  await supabaseRestRequest('media_assets', {
    method: 'DELETE',
    query: `?id=eq.${encodeURIComponent(row.id)}`,
    prefer: 'return=minimal'
  })
  if (row.storage_bucket && row.storage_path) {
    const { error } = await supabaseClient.storage.from(row.storage_bucket).remove([row.storage_path])
    if (error) {
      await supabaseRestRequest('media_assets', {
        method: 'POST',
        body: row,
        prefer: 'resolution=merge-duplicates,return=minimal'
      }).catch(() => undefined)
      throw new Error(`Asset delete failed: ${error.message}`)
    }
  }
}

export async function downloadMediaAsset(input: { row: MediaAssetRow | null; url: string }): Promise<Blob> {
  if (input.row?.storage_bucket && input.row.storage_path && isSupabaseConfigured()) {
    const { data, error } = await supabaseClient.storage.from(input.row.storage_bucket).download(input.row.storage_path)
    if (error) throw new Error(`Asset download failed: ${error.message}`)
    return data
  }
  if (!input.url) throw new Error('Asset does not have a downloadable source.')
  const response = await fetch(input.url)
  if (!response.ok) throw new Error(`Asset download failed (${response.status}).`)
  return response.blob()
}

export const STORAGE_CLEANUP_GRACE_PERIOD_MS = 60 * 60 * 1000
const STORAGE_SCAN_PREFIXES = ['draft', 'published', 'portfolio'] as const
const STORAGE_LIST_PAGE_SIZE = 1000
const STORAGE_REMOVE_BATCH_SIZE = 50

export type StorageScanPrefix = (typeof STORAGE_SCAN_PREFIXES)[number]

export interface StorageOrphanFile {
  path: string
  prefix: StorageScanPrefix
  sizeBytes: number
  createdAt: string | null
  isRecent: boolean
}

export interface StorageCleanupScanResult {
  scannedAt: string
  gracePeriodMs: number
  totalObjects: number
  referencedCount: number
  dbReferencedCount: number
  sessionProtectedCount: number
  orphans: StorageOrphanFile[]
  recentOrphans: StorageOrphanFile[]
  orphanTotalBytes: number
  recentOrphanBytes: number
}

export interface StorageCleanupDeleteResult {
  deletedCount: number
  freedBytes: number
  skippedReferencedCount: number
  failedBatches: number
  errors: string[]
}

function extractPortfolioMediaCandidate(rawValue: string | null | undefined): string | null {
  if (!rawValue) return null
  const withoutFragment = rawValue.trim().split('#', 1)[0]?.split('?', 1)[0] ?? ''
  if (!withoutFragment || /^(?:data|blob):/i.test(withoutFragment)) return null
  const trimmed = withoutFragment.replace(/^\/+/, '')
  const storageMatch = trimmed.match(/^(?:[a-z]+:\/\/[^/]+\/|[^/]*[.:][^/]*\/)?storage\/v1\/(?:object|render\/image)\/(?:(?:public|sign|authenticated)\/)?portfolio-media\/(.+)$/i)
  const bucketPrefixMatch = !storageMatch ? trimmed.match(/^portfolio-media\/((?:draft|published|portfolio)\/.+)$/i) : null
  const candidate = (storageMatch?.[1] ?? bucketPrefixMatch?.[1] ?? trimmed).replace(/^\/+/, '')
  return /^(?:draft|published|portfolio)\/.+$/i.test(candidate) ? candidate : null
}

function safeDecodeComponent(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function pathMatchKeys(rawPath: string): string[] {
  const keys = new Set<string>()
  const addForm = (value: string) => {
    const cleaned = value.replace(/^\/+/, '')
    if (!cleaned) return
    keys.add(cleaned)
    keys.add(cleaned.normalize('NFC'))
  }
  addForm(rawPath)
  addForm(safeDecodeComponent(rawPath))
  return [...keys]
}

function addProtectedPathVariants(target: Set<string>, rawValue: string | null | undefined): void {
  const candidate = extractPortfolioMediaCandidate(rawValue)
  if (!candidate) return
  for (const key of pathMatchKeys(candidate)) {
    target.add(key)
  }
}

function isPathProtected(storagePath: string, protectedSet: Set<string>): boolean {
  return pathMatchKeys(storagePath).some((key) => protectedSet.has(key))
}

export function normalizePortfolioMediaPath(rawValue: string | null | undefined): string | null {
  const candidate = extractPortfolioMediaCandidate(rawValue)
  if (!candidate) return null
  const cleaned = safeDecodeComponent(candidate).replace(/^\/+/, '')
  return /^(?:draft|published|portfolio)\/.+$/i.test(cleaned) ? cleaned : null
}

export function collectCandidatePathsFromValue(root: unknown, maxDepth = 10): string[] {
  const found = new Set<string>()
  const visited = new WeakSet<object>()
  const walk = (node: unknown, depth: number) => {
    if (depth > maxDepth || node === null || node === undefined) return
    if (typeof node === 'string') {
      const trimmed = node.trim()
      if (trimmed.length > 0 && trimmed.length <= 4096 && !/^(?:data|blob):/i.test(trimmed)) {
        if (extractPortfolioMediaCandidate(trimmed)) found.add(trimmed)
      }
      return
    }
    if (typeof node !== 'object') return
    if (visited.has(node)) return
    visited.add(node)
    if (Array.isArray(node)) {
      for (const item of node) walk(item, depth + 1)
      return
    }
    for (const value of Object.values(node as Record<string, unknown>)) walk(value, depth + 1)
  }
  walk(root, 0)
  return [...found]
}

function parseEntryBytes(metadata: Record<string, unknown> | null | undefined): number {
  const raw = metadata?.size
  const numeric = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : 0
  return Number.isFinite(numeric) && numeric > 0 ? Math.trunc(numeric) : 0
}

function newestIsoTimestamp(updatedAt: string | null | undefined, createdAt: string | null | undefined): string | null {
  const updatedMs = updatedAt ? Date.parse(updatedAt) : Number.NaN
  const createdMs = createdAt ? Date.parse(createdAt) : Number.NaN
  if (Number.isFinite(updatedMs) && Number.isFinite(createdMs)) {
    return updatedMs >= createdMs ? (updatedAt as string) : (createdAt as string)
  }
  if (Number.isFinite(updatedMs)) return updatedAt as string
  if (Number.isFinite(createdMs)) return createdAt as string
  return null
}

function prefixOfPath(storagePath: string): StorageScanPrefix {
  if (storagePath.startsWith('draft/')) return 'draft'
  if (storagePath.startsWith('published/')) return 'published'
  return 'portfolio'
}

async function fetchReferencedStoragePathSets(extraProtectedPaths?: Iterable<string>): Promise<{
  dbSet: Set<string>
  sessionSet: Set<string>
}> {
  const rawPaths = await supabaseRpc<string[]>('list_referenced_storage_paths')
  if (!Array.isArray(rawPaths)) {
    throw new Error('Daftar referensi Storage tidak valid. Pembersihan dibatalkan demi keamanan.')
  }
  const dbSet = new Set<string>()
  for (const rawPath of rawPaths) {
    if (typeof rawPath === 'string') addProtectedPathVariants(dbSet, rawPath)
  }
  const sessionSet = new Set<string>()
  if (extraProtectedPaths) {
    for (const rawPath of extraProtectedPaths) {
      if (typeof rawPath === 'string') addProtectedPathVariants(sessionSet, rawPath)
    }
  }
  return { dbSet, sessionSet }
}

async function listPrefixObjects(prefix: StorageScanPrefix): Promise<Array<{ path: string; sizeBytes: number; createdAt: string | null }>> {
  const collected: Array<{ path: string; sizeBytes: number; createdAt: string | null }> = []
  const queue: string[] = [prefix]
  const visitedFolders = new Set<string>()

  while (queue.length > 0) {
    const folder = queue.shift()!
    if (visitedFolders.has(folder)) continue
    visitedFolders.add(folder)

    let offset = 0
    const seenRawEntryKeys = new Set<string>()
    while (true) {
      const { data, error } = await supabaseClient.storage.from(PORTFOLIO_MEDIA_BUCKET).list(folder, {
        limit: STORAGE_LIST_PAGE_SIZE,
        offset
      })
      if (error) throw new Error(`Gagal memindai folder "${folder}": ${error.message}`)
      const entries = data ?? []
      if (entries.length === 0) break
      const prevSeenSize = seenRawEntryKeys.size
      for (const entry of entries) {
        if (!entry.name) continue
        const cleanSegment = entry.name.replace(/^\/+/, '')
        if (!cleanSegment) continue
        const entryKey = `${entry.id ?? 'folder'}:${cleanSegment}`
        if (seenRawEntryKeys.has(entryKey)) continue
        seenRawEntryKeys.add(entryKey)
        if (cleanSegment === '.emptyFolderPlaceholder' || cleanSegment.endsWith('/.emptyFolderPlaceholder')) continue
        const fullPath = `${folder}/${cleanSegment}`
        if (entry.id === null) {
          queue.push(fullPath)
          continue
        }
        if (!/^(?:draft|published|portfolio)\/.+$/i.test(fullPath)) continue
        collected.push({
          path: fullPath,
          sizeBytes: parseEntryBytes(entry.metadata as Record<string, unknown> | null | undefined),
          createdAt: newestIsoTimestamp(entry.updated_at, entry.created_at)
        })
      }
      if (seenRawEntryKeys.size === prevSeenSize) break
      offset += entries.length
    }
  }

  return collected
}

export async function scanOrphanedStorageFiles(options: {
  gracePeriodMs?: number
  nowMs?: number
  extraProtectedPaths?: Iterable<string>
} = {}): Promise<StorageCleanupScanResult> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase Storage tidak dikonfigurasi pada mode lokal ini.')
  }

  const gracePeriodMs = options.gracePeriodMs ?? STORAGE_CLEANUP_GRACE_PERIOD_MS
  const nowMs = options.nowMs ?? Date.now()
  // Fail-closed: load DB + active-session whitelist before scanning; abort immediately on RPC error.
  const { dbSet, sessionSet } = await fetchReferencedStoragePathSets(options.extraProtectedPaths)

  const prefixLists = await Promise.all(STORAGE_SCAN_PREFIXES.map((prefix) => listPrefixObjects(prefix)))
  const seenPaths = new Set<string>()
  const orphans: StorageOrphanFile[] = []
  const recentOrphans: StorageOrphanFile[] = []
  let dbReferencedCount = 0
  let sessionProtectedCount = 0
  let orphanTotalBytes = 0
  let recentOrphanBytes = 0

  for (const entries of prefixLists) {
    for (const entry of entries) {
      if (seenPaths.has(entry.path)) continue
      seenPaths.add(entry.path)
      if (isPathProtected(entry.path, dbSet)) {
        dbReferencedCount += 1
        continue
      }
      if (isPathProtected(entry.path, sessionSet)) {
        sessionProtectedCount += 1
        continue
      }
      const createdMs = entry.createdAt ? Date.parse(entry.createdAt) : Number.NaN
      const isRecent = !Number.isFinite(createdMs) || (nowMs - createdMs) < gracePeriodMs
      const record: StorageOrphanFile = {
        path: entry.path,
        prefix: prefixOfPath(entry.path),
        sizeBytes: entry.sizeBytes,
        createdAt: entry.createdAt,
        isRecent
      }
      if (isRecent) {
        recentOrphans.push(record)
        recentOrphanBytes += record.sizeBytes
      } else {
        orphans.push(record)
        orphanTotalBytes += record.sizeBytes
      }
    }
  }

  orphans.sort((left, right) => left.path.localeCompare(right.path))
  recentOrphans.sort((left, right) => left.path.localeCompare(right.path))

  return {
    scannedAt: new Date(nowMs).toISOString(),
    gracePeriodMs,
    totalObjects: seenPaths.size,
    referencedCount: dbReferencedCount + sessionProtectedCount,
    dbReferencedCount,
    sessionProtectedCount,
    orphans,
    recentOrphans,
    orphanTotalBytes,
    recentOrphanBytes
  }
}

export async function deleteOrphanedStorageFiles(
  files: StorageOrphanFile[],
  options: { extraProtectedPaths?: Iterable<string> } = {}
): Promise<StorageCleanupDeleteResult> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase Storage tidak dikonfigurasi pada mode lokal ini.')
  }

  const uniqueFiles = new Map<string, StorageOrphanFile>()
  for (const file of files) {
    const rawKey = file.path.trim().replace(/^\/+/, '')
    if (/^(?:draft|published|portfolio)\/.+$/i.test(rawKey) && !uniqueFiles.has(rawKey)) {
      uniqueFiles.set(rawKey, { ...file, path: rawKey })
    }
  }

  if (uniqueFiles.size === 0) {
    return { deletedCount: 0, freedBytes: 0, skippedReferencedCount: 0, failedBatches: 0, errors: [] }
  }

  // Re-check DB + active session references immediately before deletion to avoid TOCTOU races.
  const { dbSet, sessionSet } = await fetchReferencedStoragePathSets(options.extraProtectedPaths)
  const safeToDelete: StorageOrphanFile[] = []
  let skippedReferencedCount = 0

  for (const file of uniqueFiles.values()) {
    if (isPathProtected(file.path, dbSet) || isPathProtected(file.path, sessionSet)) {
      skippedReferencedCount += 1
      continue
    }
    safeToDelete.push(file)
  }

  let deletedCount = 0
  let freedBytes = 0
  let failedBatches = 0
  const errors: string[] = []

  for (let index = 0; index < safeToDelete.length; index += STORAGE_REMOVE_BATCH_SIZE) {
    const batch = safeToDelete.slice(index, index + STORAGE_REMOVE_BATCH_SIZE)
    const { error } = await supabaseClient.storage
      .from(PORTFOLIO_MEDIA_BUCKET)
      .remove(batch.map((item) => item.path))
    if (error) {
      failedBatches += 1
      errors.push(error.message)
      continue
    }
    deletedCount += batch.length
    freedBytes += batch.reduce((sum, item) => sum + item.sizeBytes, 0)
  }

  return { deletedCount, freedBytes, skippedReferencedCount, failedBatches, errors }
}
