export type MediaAssetKind = 'image' | 'icon' | 'background' | 'logo'
export type MediaAssetLocation = 'Draft' | 'Published' | 'Both' | 'Library'
export type MediaAssetSafety = 'safe' | 'draft-only' | 'used' | 'published' | 'built-in'
export type MediaLibrarySort = 'newest' | 'oldest' | 'name' | 'size' | 'usage'
export type MediaLibraryFilter = 'all' | 'images' | 'icons' | 'backgrounds' | 'logos' | 'unused' | 'recent' | 'favorites'

export interface MediaAssetRow {
  id: string
  storage_bucket: string | null
  storage_path: string | null
  mime_type: string
  file_size: number | string | null
  width: number | null
  height: number | null
  alt_text: string
  source_url: string | null
  created_at: string
  updated_at: string
}

export interface MediaAssetUsage {
  id: string
  entityId: string
  label: string
  section: string
  role: string
  source: 'draft' | 'published' | 'default' | 'legacy'
  revisionId: string | null
  revisionNumber: number | null
  usedAt: string | null
}

export interface MediaLibraryAsset {
  id: string
  name: string
  kind: MediaAssetKind
  mimeType: string
  sourceUrl: string
  thumbnailUrl: string
  bucket: string | null
  storagePath: string | null
  folder: string
  width: number | null
  height: number | null
  fileSize: number | null
  createdAt: string | null
  updatedAt: string | null
  lastUsedAt: string | null
  location: MediaAssetLocation
  safety: MediaAssetSafety
  safeToDelete: boolean
  isBuiltIn: boolean
  isFavorite: boolean
  metadataPersisted: boolean
  usages: MediaAssetUsage[]
  usageCount: number
}

export interface LibraryMediaUpload {
  row: MediaAssetRow
  previewUrl: string
}

export interface AssetLibraryQuery {
  search: string
  filter: MediaLibraryFilter
  sort: MediaLibrarySort
}
