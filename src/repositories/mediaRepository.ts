import { supabaseClient } from '../lib/supabaseClient'
import { isSupabaseConfigured, supabaseRestRequest, supabaseTableRows } from '../lib/supabaseRest'
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
  return Boolean(value && (/^(?:https?:|blob:|data:)/i.test(value) || value.startsWith('/')))
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
  const local = localPreviewUrls.get(row.id)
  if (local) return local
  if (browserUrl(row.source_url)) return row.source_url
  if (!row.storage_bucket || !row.storage_path) return ''
  if (row.storage_path.startsWith('draft/')) {
    const { data, error } = await supabaseClient.storage.from(row.storage_bucket).createSignedUrl(row.storage_path, 3600)
    if (error) throw new Error(`Draft media preview failed: ${error.message}`)
    return data.signedUrl
  }
  const { data } = supabaseClient.storage.from(row.storage_bucket).getPublicUrl(row.storage_path)
  return data.publicUrl
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
