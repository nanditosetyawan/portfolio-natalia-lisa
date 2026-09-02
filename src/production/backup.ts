import { designTokenRegistry } from '../editor/designSystemRegistry'
import { serializeEditorSnapshot, validateEditorSnapshot } from '../editor/editorSnapshot'
import {
  editorDraftRepository,
  editorPublishRepository,
  favoriteRepository,
  type FavoriteRecord,
  type RevisionRecord
} from '../repositories/editorRevisionRepository'
import { useDesignSystemStore } from '../stores/designSystem'
import type { DesignSystemWorkspace, DesignTheme } from '../types/designSystem'
import type { EditorSnapshot } from '../types/editorSnapshot'
import { getRuntimeDiagnostics } from './monitoring'

export const PRODUCTION_BACKUP_FORMAT = 'tali-temali-production-backup' as const
export const PRODUCTION_BACKUP_VERSION = 1 as const

export interface ProductionBackup {
  format: typeof PRODUCTION_BACKUP_FORMAT
  version: typeof PRODUCTION_BACKUP_VERSION
  exportedAt: string
  application: { version: string; buildId: string }
  published: RevisionRecord | null
  drafts: RevisionRecord[]
  favorites: FavoriteRecord[]
  designSystem: DesignSystemWorkspace
  activeTheme: DesignTheme
  designTokens: Record<string, unknown>
  mediaManifest: Array<{ assetId: string; bucket: string | null; storagePath: string | null; mimeType: string | null; locations: Array<'draft' | 'published'> }>
}

export interface BackupValidationResult {
  valid: boolean
  kind: 'production-backup' | 'editor-snapshot' | 'design-system' | 'unknown'
  errors: string[]
  warnings: string[]
  summary: { drafts: number; favorites: number; published: number; themes: number; mediaReferences: number }
  value?: ProductionBackup | EditorSnapshot | DesignSystemWorkspace
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function snapshotMediaLocations(revisions: RevisionRecord[]): ProductionBackup['mediaManifest'] {
  const assets = new Map<string, ProductionBackup['mediaManifest'][number]>()
  for (const revision of revisions) {
    const location = revision.status === 'published' ? 'published' : 'draft'
    for (const reference of revision.snapshot.media.references) {
      const current = assets.get(reference.assetId) ?? {
        assetId: reference.assetId,
        bucket: reference.bucket ?? null,
        storagePath: reference.storagePath ?? null,
        mimeType: reference.mimeType ?? null,
        locations: []
      }
      if (!current.locations.includes(location)) current.locations.push(location)
      assets.set(reference.assetId, current)
    }
  }
  return [...assets.values()].sort((left, right) => left.assetId.localeCompare(right.assetId))
}

export async function createProductionBackup(): Promise<ProductionBackup> {
  const designSystem = useDesignSystemStore()
  designSystem.initialize()
  const [published, draftResults, favoriteResults] = await Promise.all([
    editorPublishRepository.getPublishedRevision(),
    editorDraftRepository.listDrafts(),
    favoriteRepository.listFavorites()
  ])
  const drafts = draftResults.map((result) => clone(result.revision))
  const favorites = favoriteResults.map((result) => clone(result.favorite))
  const allRevisions = [...drafts, ...(published ? [published] : [])]
  const activeTheme = clone(designSystem.activeTheme)
  return {
    format: PRODUCTION_BACKUP_FORMAT,
    version: PRODUCTION_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    application: { version: __APP_VERSION__, buildId: __APP_BUILD_ID__ },
    published: published ? clone(published) : null,
    drafts,
    favorites,
    designSystem: clone(designSystem.workspace),
    activeTheme,
    designTokens: Object.fromEntries(designTokenRegistry.map((token) => [token.id, activeTheme.tokens[token.id]])),
    mediaManifest: snapshotMediaLocations(allRevisions)
  }
}

function suspiciousKeyScan(value: unknown, path = '$', errors: string[] = []): string[] {
  if (Array.isArray(value)) {
    value.forEach((item, index) => suspiciousKeyScan(item, `${path}[${index}]`, errors))
    return errors
  }
  if (!isRecord(value)) return errors
  for (const [key, item] of Object.entries(value)) {
    if (/^(?:access_token|refresh_token|service_role|service_role_key|password|apikey|authorization)$/i.test(key)) errors.push(`${path}.${key} must not contain credentials.`)
    suspiciousKeyScan(item, `${path}.${key}`, errors)
  }
  return errors
}

function validateSnapshot(snapshot: unknown, path: string, errors: string[], requirePublishedPaths = false): snapshot is EditorSnapshot {
  const result = validateEditorSnapshot(snapshot)
  if (!result.valid || !result.value) {
    errors.push(...result.errors.map((error) => `${path}: ${error}`))
    return false
  }
  for (const [index, reference] of result.value.media.references.entries()) {
    if (/^(?:data|blob):/i.test(reference.uri)) errors.push(`${path}.media.references[${index}] contains an embedded or transient URL.`)
    if (requirePublishedPaths && (reference.bucket !== 'portfolio-media' || !reference.storagePath?.startsWith('published/'))) errors.push(`${path}.media.references[${index}] is not a published/* reference.`)
  }
  return true
}

function validThemeWorkspace(value: unknown, errors: string[]): value is DesignSystemWorkspace {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.themes) || !value.themes.length || typeof value.activeThemeId !== 'string') {
    errors.push('designSystem is invalid or uses an unsupported version.')
    return false
  }
  if (!value.themes.some((theme) => isRecord(theme) && theme.id === value.activeThemeId)) errors.push('designSystem.activeThemeId does not reference an exported Theme.')
  for (const [index, theme] of value.themes.entries()) {
    if (!isRecord(theme) || typeof theme.id !== 'string' || typeof theme.name !== 'string' || !isRecord(theme.tokens)) {
      errors.push(`designSystem.themes[${index}] is invalid.`)
      continue
    }
    for (const token of designTokenRegistry) {
      const validationError = token.validate(theme.tokens[token.id] as never)
      if (validationError) errors.push(`designSystem.themes[${index}].tokens.${token.id}: ${validationError}`)
    }
  }
  return errors.length === 0
}

export function validateBackupValue(input: unknown): BackupValidationResult {
  const baseSummary = { drafts: 0, favorites: 0, published: 0, themes: 0, mediaReferences: 0 }
  if (!isRecord(input)) return { valid: false, kind: 'unknown', errors: ['Imported data must be a JSON object.'], warnings: [], summary: baseSummary }

  if (input.format === PRODUCTION_BACKUP_FORMAT) {
    const errors = suspiciousKeyScan(input)
    const warnings: string[] = []
    if (input.version !== PRODUCTION_BACKUP_VERSION) errors.push(`Unsupported backup version: ${String(input.version)}.`)
    if (typeof input.exportedAt !== 'string' || Number.isNaN(Date.parse(input.exportedAt))) errors.push('exportedAt is invalid.')
    const drafts = Array.isArray(input.drafts) ? input.drafts : []
    const favorites = Array.isArray(input.favorites) ? input.favorites : []
    if (!Array.isArray(input.drafts)) errors.push('drafts must be an array.')
    if (!Array.isArray(input.favorites)) errors.push('favorites must be an array.')
    if (drafts.length > 10) errors.push('Backup exceeds the maximum of 10 Drafts.')
    if (favorites.length > 8) errors.push('Backup exceeds the maximum of 8 Favorites.')

    const draftIds = new Set<string>()
    drafts.forEach((candidate, index) => {
      if (!isRecord(candidate) || candidate.status !== 'draft' || typeof candidate.id !== 'string') {
        errors.push(`drafts[${index}] is not a Draft revision.`)
        return
      }
      if (draftIds.has(candidate.id)) errors.push(`drafts[${index}] duplicates revision ${candidate.id}.`)
      draftIds.add(candidate.id)
      validateSnapshot(candidate.snapshot, `drafts[${index}].snapshot`, errors)
    })

    if (input.published !== null) {
      if (!isRecord(input.published) || input.published.status !== 'published') errors.push('published is not a Published revision.')
      else validateSnapshot(input.published.snapshot, 'published.snapshot', errors, true)
    }
    favorites.forEach((candidate, index) => {
      if (!isRecord(candidate) || typeof candidate.revision_id !== 'string') errors.push(`favorites[${index}] is invalid.`)
      else if (!draftIds.has(candidate.revision_id)) errors.push(`favorites[${index}] references a Draft not included in this backup.`)
    })

    validThemeWorkspace(input.designSystem, errors)
    if (!Array.isArray(input.mediaManifest)) errors.push('mediaManifest must be an array.')
    else if (input.mediaManifest.some((entry) => !isRecord(entry) || typeof entry.assetId !== 'string')) errors.push('mediaManifest contains an invalid asset entry.')
    if (!input.published) warnings.push('No Published Snapshot is included.')
    if (!drafts.length) warnings.push('No Draft revisions are included.')
    const summary = {
      drafts: drafts.length,
      favorites: favorites.length,
      published: input.published ? 1 : 0,
      themes: isRecord(input.designSystem) && Array.isArray(input.designSystem.themes) ? input.designSystem.themes.length : 0,
      mediaReferences: Array.isArray(input.mediaManifest) ? input.mediaManifest.length : 0
    }
    return { valid: errors.length === 0, kind: 'production-backup', errors, warnings, summary, value: errors.length ? undefined : clone(input as unknown as ProductionBackup) }
  }

  const snapshotErrors: string[] = []
  if (validateSnapshot(input, 'snapshot', snapshotErrors)) {
    return { valid: true, kind: 'editor-snapshot', errors: [], warnings: ['Snapshot validated only; no data was imported.'], summary: { ...baseSummary, mediaReferences: input.media.references.length }, value: clone(input) }
  }

  const designErrors: string[] = []
  if (validThemeWorkspace(input, designErrors)) {
    return { valid: true, kind: 'design-system', errors: [], warnings: ['Design System backup validated only; no data was imported.'], summary: { ...baseSummary, themes: input.themes.length }, value: clone(input) }
  }

  return { valid: false, kind: 'unknown', errors: ['File is not a supported Production Backup, EditorSnapshot, or Design System workspace.', ...snapshotErrors.slice(0, 3), ...designErrors.slice(0, 3)], warnings: [], summary: baseSummary }
}

function u16(value: number): Uint8Array {
  return new Uint8Array([value & 0xff, (value >>> 8) & 0xff])
}

function u32(value: number): Uint8Array {
  return new Uint8Array([value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff])
}

function concat(parts: Uint8Array[]): Uint8Array {
  const output = new Uint8Array(parts.reduce((total, part) => total + part.length, 0))
  let offset = 0
  for (const part of parts) { output.set(part, offset); offset += part.length }
  return output
}

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index
  for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  return value >>> 0
})

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) crc = (crc >>> 8) ^ (crcTable[(crc ^ byte) & 0xff] ?? 0)
  return (crc ^ 0xffffffff) >>> 0
}

function dosDateTime(value = new Date()): { date: number; time: number } {
  const year = Math.max(1980, value.getFullYear())
  return {
    date: ((year - 1980) << 9) | ((value.getMonth() + 1) << 5) | value.getDate(),
    time: (value.getHours() << 11) | (value.getMinutes() << 5) | Math.floor(value.getSeconds() / 2)
  }
}

export function createZipArchive(entries: Array<{ name: string; content: string }>): Blob {
  const localParts: Uint8Array[] = []
  const centralParts: Uint8Array[] = []
  let offset = 0
  const timestamp = dosDateTime()
  for (const entry of entries) {
    const name = encoder.encode(entry.name.replace(/[^a-zA-Z0-9._/-]/g, '-'))
    const content = encoder.encode(entry.content)
    const checksum = crc32(content)
    const local = concat([u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(timestamp.time), u16(timestamp.date), u32(checksum), u32(content.length), u32(content.length), u16(name.length), u16(0), name, content])
    localParts.push(local)
    const central = concat([u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(timestamp.time), u16(timestamp.date), u32(checksum), u32(content.length), u32(content.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name])
    centralParts.push(central)
    offset += local.length
  }
  const central = concat(centralParts)
  const end = concat([u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length), u32(central.length), u32(offset), u16(0)])
  const archive = concat([...localParts, central, end])
  const blobBytes = new Uint8Array(archive.length)
  blobBytes.set(archive)
  return new Blob([blobBytes.buffer], { type: 'application/zip' })
}

function readU16(view: DataView, offset: number): number { return view.getUint16(offset, true) }
function readU32(view: DataView, offset: number): number { return view.getUint32(offset, true) }

function extractBackupJson(bytes: Uint8Array): string {
  if (bytes.length > 25 * 1024 * 1024) throw new Error('ZIP exceeds the 25 MB validation limit.')
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let endOffset = -1
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65_557); offset -= 1) {
    if (readU32(view, offset) === 0x06054b50) { endOffset = offset; break }
  }
  if (endOffset < 0) throw new Error('ZIP end record was not found.')
  const count = readU16(view, endOffset + 10)
  if (count > 20) throw new Error('ZIP contains too many entries.')
  let centralOffset = readU32(view, endOffset + 16)
  for (let index = 0; index < count; index += 1) {
    if (readU32(view, centralOffset) !== 0x02014b50) throw new Error('ZIP central directory is invalid.')
    const method = readU16(view, centralOffset + 10)
    const checksum = readU32(view, centralOffset + 16)
    const size = readU32(view, centralOffset + 24)
    const nameLength = readU16(view, centralOffset + 28)
    const extraLength = readU16(view, centralOffset + 30)
    const commentLength = readU16(view, centralOffset + 32)
    const localOffset = readU32(view, centralOffset + 42)
    const name = decoder.decode(bytes.slice(centralOffset + 46, centralOffset + 46 + nameLength))
    if (name === 'backup.json') {
      if (method !== 0) throw new Error('Compressed ZIP imports are not supported; use an app-generated package.')
      if (readU32(view, localOffset) !== 0x04034b50) throw new Error('ZIP local entry is invalid.')
      const localNameLength = readU16(view, localOffset + 26)
      const localExtraLength = readU16(view, localOffset + 28)
      const start = localOffset + 30 + localNameLength + localExtraLength
      const content = bytes.slice(start, start + size)
      if (crc32(content) !== checksum) throw new Error('ZIP backup checksum failed.')
      return decoder.decode(content)
    }
    centralOffset += 46 + nameLength + extraLength + commentLength
  }
  throw new Error('ZIP does not contain backup.json.')
}

export async function validateBackupFile(file: File): Promise<BackupValidationResult> {
  if (file.size > 25 * 1024 * 1024) return { valid: false, kind: 'unknown', errors: ['File exceeds the 25 MB validation limit.'], warnings: [], summary: { drafts: 0, favorites: 0, published: 0, themes: 0, mediaReferences: 0 } }
  try {
    const bytes = new Uint8Array(await file.arrayBuffer())
    const serialized = bytes[0] === 0x50 && bytes[1] === 0x4b ? extractBackupJson(bytes) : decoder.decode(bytes)
    return validateBackupValue(JSON.parse(serialized) as unknown)
  } catch (error) {
    return { valid: false, kind: 'unknown', errors: [error instanceof Error ? error.message : 'Backup file could not be read.'], warnings: [], summary: { drafts: 0, favorites: 0, published: 0, themes: 0, mediaReferences: 0 } }
  }
}

function safeTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '')
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadJson(value: unknown, filename: string): void {
  downloadBlob(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }), filename)
}

export function exportBackupJson(backup: ProductionBackup): void {
  downloadJson(backup, `portfolio-backup_${safeTimestamp()}.json`)
}

export function exportBackupZip(backup: ProductionBackup): void {
  const entries = [
    { name: 'backup.json', content: JSON.stringify(backup, null, 2) },
    { name: 'published-snapshot.json', content: backup.published ? serializeEditorSnapshot(backup.published.snapshot) : 'null' },
    { name: 'drafts.json', content: JSON.stringify(backup.drafts, null, 2) },
    { name: 'favorites.json', content: JSON.stringify(backup.favorites, null, 2) },
    { name: 'theme.json', content: JSON.stringify(backup.activeTheme, null, 2) },
    { name: 'design-tokens.json', content: JSON.stringify(backup.designTokens, null, 2) },
    { name: 'runtime-diagnostics.json', content: JSON.stringify(getRuntimeDiagnostics(), null, 2) },
    { name: 'README.txt', content: 'Tali-Temali production backup. Media binaries are not embedded; stable media references remain in the snapshots. Validate this package in Admin Maintenance before any recovery operation.' }
  ]
  downloadBlob(createZipArchive(entries), `portfolio-backup_${safeTimestamp()}.zip`)
}

export function exportBackupPart(backup: ProductionBackup, part: 'published' | 'drafts' | 'favorites' | 'theme' | 'tokens'): void {
  const values = {
    published: backup.published?.snapshot ?? null,
    drafts: backup.drafts,
    favorites: backup.favorites,
    theme: backup.activeTheme,
    tokens: backup.designTokens
  }
  downloadJson(values[part], `portfolio-${part}_${safeTimestamp()}.json`)
}
