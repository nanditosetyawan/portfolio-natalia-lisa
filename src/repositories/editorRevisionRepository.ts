import { supabaseTableRows, supabaseRpc, isSupabaseConfigured } from '../lib/supabaseRest'
import { supabaseClient } from '../lib/supabaseClient'
import type { EditorSnapshot } from '../types/editorSnapshot'
import { deserializeEditorSnapshot, serializeEditorSnapshot, validateEditorSnapshot } from '../editor/editorSnapshot'
import type { DraftMediaReference } from '../types/editor'
import type { SnapshotMediaReference } from '../types/editorSnapshot'

export type RevisionStatus = 'draft' | 'published' | 'archived'

export interface RevisionRecord {
  id: string
  revision_number: number
  lock_version: number
  status: RevisionStatus
  snapshot: EditorSnapshot
  base_revision_number: number | null
  created_by: string
  created_at: string
  updated_at: string
  published_at: string | null
}

export interface DraftStatus {
  revisionId: string | null
  revisionNumber: number | null
  baseRevisionNumber: number | null
  hasDraft: boolean
  updatedAt: string | null
}

export interface SaveDraftInput {
  snapshot: EditorSnapshot
  mediaReferences: DraftMediaReference[]
  expectedBaseRevision: number | null
  expectedDraftLockVersion?: number | null
  draftRevisionId?: string | null
  createNew?: boolean
}

export interface DraftMediaUploadResult extends DraftMediaReference {
  previewUrl: string
}

export interface SaveDraftResult {
  revision: RevisionRecord
  mediaReferences: DraftMediaReference[]
}

export interface EditorDraftRepository {
  loadDraft(draftRevisionId?: string): Promise<SaveDraftResult | null>
  listDrafts(): Promise<SaveDraftResult[]>
  countDrafts(): Promise<number>
  saveDraft(input: SaveDraftInput): Promise<SaveDraftResult>
  uploadDraftMedia(file: File, draftScope: string): Promise<DraftMediaUploadResult>
  getDraftMediaUrl(reference: DraftMediaReference): Promise<string>
  discardDraft(draftRevisionId?: string): Promise<void>
  getDraftStatus(): Promise<DraftStatus>
}

export interface FavoriteRecord {
  id: string
  user_id: string
  revision_id: string
  created_at: string
}

export interface FavoriteDraft extends SaveDraftResult {
  favorite: FavoriteRecord
}

export interface FavoriteRepository {
  listFavorites(): Promise<FavoriteDraft[]>
  addFavorite(revisionId: string): Promise<FavoriteRecord>
  removeFavorite(revisionId: string): Promise<void>
  isFavorite(revisionId: string): Promise<boolean>
  countFavorites(): Promise<number>
}

export interface GuestPublishedRepository {
  loadPublishedSnapshot(): Promise<{ snapshot: EditorSnapshot; revision: RevisionRecord } | null>
}

export interface PublishValidationResult {
  valid: boolean
  errors: string[]
  draft: RevisionRecord | null
}

/** Phase 029C deliberately exposes validation only. It has no publish mutation method. */
export interface EditorPublishRepository {
  validateDraft(draftRevisionId: string): Promise<PublishValidationResult>
}

export class RevisionConflictError extends Error {
  readonly code = 'REVISION_CONFLICT'
  constructor(message = 'The draft is based on an older published revision.') {
    super(message)
    this.name = 'RevisionConflictError'
  }
}

export class DraftLimitError extends Error {
  readonly code = 'DRAFT_LIMIT'
  constructor() { super('Maximum 10 drafts reached. Delete an existing draft before creating a new one.'); this.name = 'DraftLimitError' }
}

export class FavoriteLimitError extends Error {
  readonly code = 'FAVORITE_LIMIT'
  constructor() { super('Maximum 8 favorites reached.'); this.name = 'FavoriteLimitError' }
}

function clone<T>(value: T): T { return structuredClone(value) }

function assertSnapshot(snapshot: EditorSnapshot): EditorSnapshot {
  const result = validateEditorSnapshot(snapshot)
  if (!result.valid) throw new Error(`Invalid editor snapshot: ${result.errors.join(' ')}`)
  return result.value as EditorSnapshot
}

function nextRevision(records: RevisionRecord[]): number {
  return records.reduce((max, record) => Math.max(max, record.revision_number), 0) + 1
}

function snapshotMediaReferences(snapshot: EditorSnapshot): DraftMediaReference[] {
  return snapshot.media.references
    .filter((reference) => Boolean(reference.storagePath && reference.bucket))
    .map((reference) => ({ assetId: reference.assetId, bucket: reference.bucket as string, storagePath: reference.storagePath as string, mimeType: reference.mimeType ?? '', width: reference.width ?? 0, height: reference.height ?? 0 }))
}

function withDraftMedia(snapshot: EditorSnapshot, references: DraftMediaReference[]): EditorSnapshot {
  const existing = new Map(snapshot.media.references.map((reference) => [reference.assetId, reference]))
  for (const reference of references) {
    const value: SnapshotMediaReference = { assetId: reference.assetId, uri: reference.storagePath, bucket: reference.bucket, storagePath: reference.storagePath, mimeType: reference.mimeType, width: reference.width, height: reference.height }
    existing.set(reference.assetId, value)
  }
  return { ...clone(snapshot), media: { ...clone(snapshot.media), references: [...existing.values()] } }
}

export class InMemoryEditorRevisionRepository implements EditorDraftRepository, GuestPublishedRepository, EditorPublishRepository, FavoriteRepository {
  private records: RevisionRecord[] = []
  private media = new Map<string, DraftMediaReference[]>()
  private favorites = new Map<string, FavoriteRecord>()
  private readonly actorId: string

  constructor(actorId = 'runtime-test-admin') { this.actorId = actorId }

  seedPublished(snapshot: EditorSnapshot, revisionNumber = 1): void {
    assertSnapshot(snapshot)
    this.records.push({ id: `published-${revisionNumber}`, revision_number: revisionNumber, lock_version: 1, status: 'published', snapshot: clone(snapshot), base_revision_number: revisionNumber - 1 || null, created_by: this.actorId, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), published_at: new Date().toISOString() })
  }

  async loadDraft(draftRevisionId?: string): Promise<SaveDraftResult | null> {
    const record = this.records.filter((candidate) => candidate.status === 'draft' && (!draftRevisionId || candidate.id === draftRevisionId)).sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0]
    return record ? { revision: clone(record), mediaReferences: clone(this.media.get(record.id) ?? snapshotMediaReferences(record.snapshot)) } : null
  }

  async listDrafts(): Promise<SaveDraftResult[]> {
    return this.records.filter((candidate) => candidate.status === 'draft').sort((a, b) => b.updated_at.localeCompare(a.updated_at)).map((revision) => ({ revision: clone(revision), mediaReferences: clone(this.media.get(revision.id) ?? snapshotMediaReferences(revision.snapshot)) }))
  }

  async countDrafts(): Promise<number> { return (await this.listDrafts()).length }

  async saveDraft(input: SaveDraftInput): Promise<SaveDraftResult> {
    assertSnapshot(input.snapshot)
    const published = this.records.filter((candidate) => candidate.status === 'published').sort((a, b) => b.revision_number - a.revision_number)[0]
    const currentBase = published?.revision_number ?? null
    if (currentBase !== input.expectedBaseRevision) throw new RevisionConflictError()
    const existing = input.createNew ? undefined : this.records.find((candidate) => candidate.status === 'draft' && candidate.id === input.draftRevisionId)
    if (!existing && !input.createNew && input.draftRevisionId) throw new Error('Draft revision was not found.')
    if (existing && existing.lock_version !== input.expectedDraftLockVersion) throw new RevisionConflictError('The Draft changed since it was loaded. Reload the latest Draft.')
    if (!existing && (await this.countDrafts()) >= 10) throw new DraftLimitError()
    const now = new Date().toISOString()
    const revision: RevisionRecord = existing
      ? { ...existing, snapshot: withDraftMedia(input.snapshot, input.mediaReferences), base_revision_number: input.expectedBaseRevision, lock_version: existing.lock_version + 1, updated_at: now }
      : { id: `draft-${nextRevision(this.records)}`, revision_number: nextRevision(this.records), lock_version: 1, status: 'draft', snapshot: withDraftMedia(input.snapshot, input.mediaReferences), base_revision_number: input.expectedBaseRevision, created_by: this.actorId, created_at: now, updated_at: now, published_at: null }
    this.records = [...this.records.filter((candidate) => candidate.id !== revision.id), revision]
    this.media.set(revision.id, clone(input.mediaReferences))
    return { revision: clone(revision), mediaReferences: clone(input.mediaReferences) }
  }

  async uploadDraftMedia(file: File, draftScope: string): Promise<DraftMediaUploadResult> {
    const assetId = crypto.randomUUID()
    const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin'
    const storagePath = `draft/${draftScope}/${assetId}.${extension}`
    const previewUrl = URL.createObjectURL(file)
    return { assetId, bucket: 'portfolio-media', storagePath, mimeType: file.type, width: 0, height: 0, previewUrl }
  }

  async getDraftMediaUrl(reference: DraftMediaReference): Promise<string> {
    if (!reference.previewUrl) throw new Error('In-memory Draft media is not persistent across a browser reload.')
    return reference.previewUrl
  }

  async discardDraft(draftRevisionId?: string): Promise<void> {
    const drafts = this.records.filter((candidate) => candidate.status === 'draft' && (!draftRevisionId || candidate.id === draftRevisionId))
    this.records = this.records.filter((candidate) => !drafts.some((draft) => draft.id === candidate.id))
    for (const draft of drafts) this.media.delete(draft.id)
    for (const [key, favorite] of this.favorites) if (drafts.some((draft) => draft.id === favorite.revision_id)) this.favorites.delete(key)
  }

  async listFavorites(): Promise<FavoriteDraft[]> {
    return [...this.favorites.values()].sort((a, b) => b.created_at.localeCompare(a.created_at)).flatMap((favorite) => {
      const draft = this.records.find((candidate) => candidate.id === favorite.revision_id && candidate.status === 'draft')
      return draft ? [{ favorite: clone(favorite), revision: clone(draft), mediaReferences: clone(this.media.get(draft.id) ?? snapshotMediaReferences(draft.snapshot)) }] : []
    })
  }

  async addFavorite(revisionId: string): Promise<FavoriteRecord> {
    const draft = this.records.find((candidate) => candidate.id === revisionId && candidate.status === 'draft')
    if (!draft) throw new Error('Draft revision was not found.')
    const existing = [...this.favorites.values()].find((favorite) => favorite.revision_id === revisionId && favorite.user_id === this.actorId)
    if (existing) return clone(existing)
    if (await this.countFavorites() >= 8) throw new FavoriteLimitError()
    const favorite = { id: `favorite-${crypto.randomUUID()}`, user_id: this.actorId, revision_id: revisionId, created_at: new Date().toISOString() }
    this.favorites.set(favorite.id, favorite)
    return clone(favorite)
  }

  async removeFavorite(revisionId: string): Promise<void> {
    for (const [key, favorite] of this.favorites) if (favorite.revision_id === revisionId && favorite.user_id === this.actorId) this.favorites.delete(key)
  }

  async isFavorite(revisionId: string): Promise<boolean> { return [...this.favorites.values()].some((favorite) => favorite.revision_id === revisionId && favorite.user_id === this.actorId) }
  async countFavorites(): Promise<number> { return [...this.favorites.values()].filter((favorite) => favorite.user_id === this.actorId).length }

  async getDraftStatus(): Promise<DraftStatus> {
    const draft = await this.loadDraft()
    return { revisionId: draft?.revision.id ?? null, revisionNumber: draft?.revision.revision_number ?? null, baseRevisionNumber: draft?.revision.base_revision_number ?? null, hasDraft: Boolean(draft), updatedAt: draft?.revision.updated_at ?? null }
  }

  async loadPublishedSnapshot(): Promise<{ snapshot: EditorSnapshot; revision: RevisionRecord } | null> {
    const revision = this.records.filter((candidate) => candidate.status === 'published').sort((a, b) => b.revision_number - a.revision_number)[0]
    return revision ? { snapshot: clone(revision.snapshot), revision: clone(revision) } : null
  }

  async validateDraft(draftRevisionId: string): Promise<PublishValidationResult> {
    const draft = this.records.find((candidate) => candidate.id === draftRevisionId && candidate.status === 'draft') ?? null
    const errors = draft ? [] : ['Draft revision was not found.']
    if (draft) {
      try { assertSnapshot(draft.snapshot) } catch (error) { errors.push(error instanceof Error ? error.message : 'Invalid snapshot.') }
    }
    return { valid: errors.length === 0, errors, draft: draft ? clone(draft) : null }
  }
}

type RevisionRow = Omit<RevisionRecord, 'revision_number' | 'lock_version' | 'snapshot'> & { revision_number: number | string; lock_version: number | string; snapshot: EditorSnapshot | string }

function fromRow(row: RevisionRow): RevisionRecord {
  const snapshot = typeof row.snapshot === 'string' ? deserializeEditorSnapshot(row.snapshot) : row.snapshot
  const normalized = assertSnapshot(snapshot)
  return { ...row, revision_number: Number(row.revision_number), lock_version: Number(row.lock_version ?? 1), snapshot: clone(normalized) }
}

export class SupabaseEditorDraftRepository implements EditorDraftRepository {
  async loadDraft(draftRevisionId?: string): Promise<SaveDraftResult | null> {
    const filter = draftRevisionId ? `&id=eq.${encodeURIComponent(draftRevisionId)}` : ''
    const rows = await supabaseTableRows<RevisionRow>('site_revisions', `?select=*&status=eq.draft${filter}&order=updated_at.desc&limit=1`)
    const row = rows[0]
    if (!row) return null
    const revision = fromRow(row)
    return { revision, mediaReferences: snapshotMediaReferences(revision.snapshot) }
  }

  async listDrafts(): Promise<SaveDraftResult[]> {
    const rows = await supabaseTableRows<RevisionRow>('site_revisions', '?select=*&status=eq.draft&order=updated_at.desc&limit=10')
    return rows.map((row) => { const revision = fromRow(row); return { revision, mediaReferences: snapshotMediaReferences(revision.snapshot) } })
  }

  async countDrafts(): Promise<number> { return (await supabaseTableRows<{ id: string }>('site_revisions', '?select=id&status=eq.draft')).length }

  async saveDraft(input: SaveDraftInput): Promise<SaveDraftResult> {
    assertSnapshot(input.snapshot)
    const snapshot = withDraftMedia(input.snapshot, input.mediaReferences)
    let saved: RevisionRow[]
    try {
      saved = await supabaseRpc<RevisionRow[]>('save_editor_draft', {
        p_draft_id: input.draftRevisionId ?? null,
        p_snapshot: JSON.parse(serializeEditorSnapshot(snapshot)),
        p_expected_base_revision: input.expectedBaseRevision,
        p_expected_lock_version: input.expectedDraftLockVersion ?? null,
        p_create_new: Boolean(input.createNew)
      })
    } catch (error) {
      if (error instanceof Error && (error.message.includes('older published revision') || error.message.includes('changed since it was loaded') || error.message.includes('(409)'))) throw new RevisionConflictError(error.message.includes('changed since it was loaded') ? 'The Draft changed since it was loaded. Reload the latest Draft.' : undefined)
      throw error
    }
    const revision = fromRow(saved[0])
    return { revision, mediaReferences: snapshotMediaReferences(revision.snapshot) }
  }

  async uploadDraftMedia(file: File, draftScope: string): Promise<DraftMediaUploadResult> {
    if (!file.type.startsWith('image/')) throw new Error('Only image files are allowed')
    if (file.size > 10 * 1024 * 1024) throw new Error('Image exceeds the 10 MB limit')
    const assetId = crypto.randomUUID()
    const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin'
    const storagePath = `draft/${draftScope}/${assetId}.${extension}`
    const { error } = await supabaseClient.storage.from('portfolio-media').upload(storagePath, file, { upsert: false, contentType: file.type })
    if (error) throw new Error(`Draft media upload failed: ${error.message}`)
    const { data, error: signedError } = await supabaseClient.storage.from('portfolio-media').createSignedUrl(storagePath, 3600)
    if (signedError) throw new Error(`Draft media preview failed: ${signedError.message}`)
    return { assetId, bucket: 'portfolio-media', storagePath, mimeType: file.type, width: 0, height: 0, previewUrl: data.signedUrl }
  }

  async getDraftMediaUrl(reference: DraftMediaReference): Promise<string> {
    const { data, error } = await supabaseClient.storage.from(reference.bucket).createSignedUrl(reference.storagePath, 3600)
    if (error) throw new Error(`Draft media preview failed: ${error.message}`)
    return data.signedUrl
  }

  async discardDraft(draftRevisionId?: string): Promise<void> {
    const draft = await this.loadDraft(draftRevisionId)
    if (draft) await supabaseRpc('discard_editor_draft', { p_draft_id: draft.revision.id })
  }

  async getDraftStatus(): Promise<DraftStatus> {
    const draft = await this.loadDraft()
    return { revisionId: draft?.revision.id ?? null, revisionNumber: draft?.revision.revision_number ?? null, baseRevisionNumber: draft?.revision.base_revision_number ?? null, hasDraft: Boolean(draft), updatedAt: draft?.revision.updated_at ?? null }
  }
}

export class SupabaseGuestPublishedRepository implements GuestPublishedRepository {
  async loadPublishedSnapshot(): Promise<{ snapshot: EditorSnapshot; revision: RevisionRecord } | null> {
    const rows = await supabaseTableRows<RevisionRow>('site_revisions', '?select=*&status=eq.published&order=revision_number.desc&limit=1')
    const row = rows[0]
    if (!row) return null
    const revision = fromRow(row)
    return { snapshot: clone(revision.snapshot), revision }
  }
}

export class SupabaseEditorPublishRepository implements EditorPublishRepository {
  async validateDraft(draftRevisionId: string): Promise<PublishValidationResult> {
    if (!isSupabaseConfigured()) throw new Error('Supabase environment is not configured')
    const rows = await supabaseTableRows<RevisionRow>('site_revisions', `?select=*&id=eq.${encodeURIComponent(draftRevisionId)}&status=eq.draft&limit=1`)
    const draft = rows[0] ? fromRow(rows[0]) : null
    const errors = draft ? [] : ['Draft revision was not found.']
    if (draft) {
      try { assertSnapshot(draft.snapshot) } catch (error) { errors.push(error instanceof Error ? error.message : 'Invalid snapshot.') }
    }
    return { valid: errors.length === 0, errors, draft }
  }
}

export class SupabaseFavoriteRepository implements FavoriteRepository {
  async listFavorites(): Promise<FavoriteDraft[]> {
    const favorites = await supabaseTableRows<FavoriteRecord>('editor_favorites', '?select=*&order=created_at.desc&limit=8')
    const drafts = await Promise.all(favorites.map(async (favorite) => {
      const draft = await editorDraftRepository.loadDraft(favorite.revision_id)
      return draft ? { ...draft, favorite } : null
    }))
    return drafts.filter((draft): draft is FavoriteDraft => Boolean(draft))
  }

  async addFavorite(revisionId: string): Promise<FavoriteRecord> {
    try { return await supabaseRpc<FavoriteRecord>('add_editor_favorite', { p_revision_id: revisionId }) } catch (error) {
      if (error instanceof Error && error.message.includes('Maximum 8 favorites reached')) throw new FavoriteLimitError()
      throw error
    }
  }

  async removeFavorite(revisionId: string): Promise<void> { await supabaseRpc('remove_editor_favorite', { p_revision_id: revisionId }) }
  async isFavorite(revisionId: string): Promise<boolean> { return Boolean(await supabaseTableRows<FavoriteRecord>('editor_favorites', `?select=id&revision_id=eq.${encodeURIComponent(revisionId)}&limit=1`).then((rows) => rows.length)) }
  async countFavorites(): Promise<number> { return (await supabaseTableRows<FavoriteRecord>('editor_favorites', '?select=id')).length }
}

const inMemoryRepository = new InMemoryEditorRevisionRepository()
const supabaseDraftRepository = new SupabaseEditorDraftRepository()
export const editorDraftRepository: EditorDraftRepository = isSupabaseConfigured() ? supabaseDraftRepository : inMemoryRepository

export const guestPublishedRepository: GuestPublishedRepository = isSupabaseConfigured()
  ? new SupabaseGuestPublishedRepository()
  : inMemoryRepository

export const favoriteRepository: FavoriteRepository = isSupabaseConfigured() ? new SupabaseFavoriteRepository() : inMemoryRepository
