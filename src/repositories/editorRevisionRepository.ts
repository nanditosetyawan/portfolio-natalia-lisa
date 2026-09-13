import { supabaseTableRows, supabaseRpc, isSupabaseConfigured, supabasePublicStorageUrl } from '../lib/supabaseRest'
import type { EditorSnapshot } from '../types/editorSnapshot'
import { deserializeEditorSnapshot, serializeEditorSnapshot, validateEditorSnapshot } from '../editor/editorSnapshot'
import type { DraftMediaReference } from '../types/editor'
import type { SnapshotMediaReference } from '../types/editorSnapshot'

async function loadSupabaseClient() {
  return (await import('../lib/supabaseClient')).supabaseClient
}

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
  source_draft_revision_id: string | null
  published_by: string | null
  publish_note: string | null
  publication_kind: 'publish' | 'rollback' | null
  rollback_source_revision_id: string | null
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
  resolvePublishedMedia(snapshot: EditorSnapshot): Promise<EditorSnapshot>
}

export interface PublishValidationResult {
  valid: boolean
  errors: string[]
  draft: RevisionRecord | null
}

export interface PublishDraftInput {
  draftRevisionId: string
  expectedPublishedRevision: number | null
  expectedDraftLockVersion: number
  note?: string
}

export interface RollbackRevisionInput {
  targetRevisionId: string
  expectedPublishedRevision: number
  note?: string
}

export interface EditorPublishRepository {
  validateDraft(draftRevisionId: string): Promise<PublishValidationResult>
  publishDraft(input: PublishDraftInput): Promise<RevisionRecord>
  rollbackRevision(input: RollbackRevisionInput): Promise<RevisionRecord>
  getPublishedRevision(): Promise<RevisionRecord | null>
  getHistory(): Promise<RevisionRecord[]>
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

export class PublishConflictError extends Error {
  readonly code = 'PUBLISH_CONFLICT'
  constructor(message = 'The Published revision changed. Reload before trying again.') {
    super(message)
    this.name = 'PublishConflictError'
  }
}

export class PublishValidationError extends Error {
  readonly code = 'PUBLISH_VALIDATION'
  readonly errors: string[]
  constructor(errors: string[]) {
    super(errors.join(' '))
    this.name = 'PublishValidationError'
    this.errors = [...errors]
  }
}

function clone<T>(value: T): T { return structuredClone(value) }

function assertSnapshot(snapshot: EditorSnapshot): EditorSnapshot {
  const result = validateEditorSnapshot(snapshot)
  if (!result.valid) throw new Error(`Invalid editor snapshot: ${result.errors.join(' ')}`)
  return result.value as EditorSnapshot
}

function publishValidationErrors(snapshot: EditorSnapshot, requirePublishedPaths = false): string[] {
  const errors: string[] = []
  try { assertSnapshot(snapshot) } catch (error) {
    return [error instanceof Error ? error.message : 'Invalid EditorSnapshot.']
  }

  const requiredText: Array<[string, unknown]> = [
    ['Portfolio title', snapshot.content.portfolio.title],
    ['Profile name', snapshot.content.profile.name],
    ['About title', snapshot.content.about.title],
    ['Education title', snapshot.content.education.title],
    ['Experience title', snapshot.content.experience.title],
    ['Certificate title', snapshot.content.certificate.title],
    ['Contact line 1', snapshot.content.contact.line1],
    ['Contact line 2', snapshot.content.contact.line2],
    ['Contact button text', snapshot.content.contact.cta.text]
  ]
  for (const [label, value] of requiredText) if (typeof value !== 'string' || !value.trim()) errors.push(`${label} is required.`)

  const entityIds = snapshot.entities.map((entity) => entity.entityId)
  if (!entityIds.length) errors.push('At least one entity reference is required.')
  if (new Set(entityIds).size !== entityIds.length) errors.push('Entity references must use unique IDs.')

  const references = snapshot.media.references
  const referenceIds = references.map((reference) => reference.assetId)
  if (!references.length) errors.push('At least one media reference is required.')
  if (new Set(referenceIds).size !== referenceIds.length) errors.push('Media references must use unique asset IDs.')
  if (references.some((reference) => reference.uri.startsWith('data:') || reference.uri.startsWith('blob:'))) errors.push('Media references may not embed binary or transient browser URLs.')
  if (requirePublishedPaths && references.some((reference) => reference.bucket !== 'portfolio-media' || !reference.storagePath?.startsWith('published/') || reference.uri !== reference.storagePath)) errors.push('Published media must use portfolio-media/published/* references.')

  const assets = new Set(referenceIds)
  for (const assignment of snapshot.media.assignments) {
    if (!assets.has(assignment.assetId)) errors.push(`Media assignment ${assignment.entityId} references missing asset ${assignment.assetId}.`)
  }
  const profileUsageId = snapshot.content.profile.mediaUsageId
  if (!snapshot.media.assignments.some((assignment) => assignment.entityId === profileUsageId)) errors.push('The required profile image is missing.')
  return [...new Set(errors)]
}

function publishedRevisionNumber(records: RevisionRecord[]): number | null {
  return records.filter((record) => record.status === 'published').reduce<number | null>((latest, record) => latest === null || record.revision_number > latest ? record.revision_number : latest, null)
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

function extensionForMedia(mimeType: string | undefined, source: string): string {
  const fromPath = source.split(/[?#]/, 1)[0]?.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (fromPath && fromPath.length <= 8) return fromPath
  const byMime: Record<string, string> = {
    'image/avif': 'avif',
    'image/gif': 'gif',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/svg+xml': 'svg',
    'image/webp': 'webp'
  }
  return byMime[mimeType ?? ''] ?? 'bin'
}

function assertUsableMediaBlob(blob: Blob, expectedMimeType: string, label: string): void {
  if (blob.size <= 0) throw new Error(`${label} is empty.`)
  if (expectedMimeType && blob.type && blob.type !== expectedMimeType) throw new Error(`${label} MIME mismatch: expected ${expectedMimeType}, received ${blob.type}.`)
}

async function prepareSupabasePublishedSnapshot(snapshot: EditorSnapshot, revisionNumber: number): Promise<EditorSnapshot> {
  const supabaseClient = await loadSupabaseClient()
  const prepared = clone(snapshot)
  const attemptId = crypto.randomUUID()
  prepared.media.references = await Promise.all(prepared.media.references.map(async (reference) => {
    const expectedMimeType = reference.mimeType ?? ''
    if (!expectedMimeType.startsWith('image/')) throw new Error(`Media ${reference.assetId} has an unsupported MIME type.`)
    if (reference.bucket && reference.bucket !== 'portfolio-media') throw new Error(`Media ${reference.assetId} is stored in an unsupported bucket.`)

    if (reference.storagePath?.startsWith('published/')) {
      const { data, error } = await supabaseClient.storage.from('portfolio-media').download(reference.storagePath)
      if (error || !data) throw new Error(`Published media verification failed for ${reference.assetId}: ${error?.message ?? 'object not found'}`)
      assertUsableMediaBlob(data, expectedMimeType, `Published media ${reference.assetId}`)
      return { ...reference, uri: reference.storagePath, bucket: 'portfolio-media', storagePath: reference.storagePath }
    }

    const extension = extensionForMedia(expectedMimeType, reference.storagePath ?? reference.uri)
    const destination = `published/${revisionNumber}/${reference.assetId}-${attemptId}.${extension}`

    if (reference.storagePath) {
      if (!reference.storagePath.startsWith('draft/')) throw new Error(`Media ${reference.assetId} is outside the allowed draft/* staging prefix.`)
      const { data: sourceBlob, error: sourceError } = await supabaseClient.storage.from('portfolio-media').download(reference.storagePath)
      if (sourceError || !sourceBlob) throw new Error(`Draft media verification failed for ${reference.assetId}: ${sourceError?.message ?? 'object not found'}`)
      assertUsableMediaBlob(sourceBlob, expectedMimeType, `Draft media ${reference.assetId}`)
      const { error: copyError } = await supabaseClient.storage.from('portfolio-media').copy(reference.storagePath, destination)
      if (copyError) throw new Error(`Media preparation failed for ${reference.assetId}: ${copyError.message}`)
    } else {
      if (reference.uri.startsWith('data:') || reference.uri.startsWith('blob:')) throw new Error(`Media ${reference.assetId} uses a transient or embedded URL.`)
      const response = await fetch(reference.uri, { cache: 'no-store' })
      if (!response.ok) throw new Error(`Media source could not be loaded for ${reference.assetId} (${response.status}).`)
      const sourceBlob = await response.blob()
      assertUsableMediaBlob(sourceBlob, expectedMimeType, `Media source ${reference.assetId}`)
      const { error: uploadError } = await supabaseClient.storage.from('portfolio-media').upload(destination, sourceBlob, { upsert: false, contentType: expectedMimeType })
      if (uploadError) throw new Error(`Media preparation failed for ${reference.assetId}: ${uploadError.message}`)
    }

    const { data: preparedBlob, error: preparedError } = await supabaseClient.storage.from('portfolio-media').download(destination)
    if (preparedError || !preparedBlob) throw new Error(`Prepared media verification failed for ${reference.assetId}: ${preparedError?.message ?? 'object not found'}`)
    assertUsableMediaBlob(preparedBlob, expectedMimeType, `Prepared media ${reference.assetId}`)
    return { ...reference, uri: destination, bucket: 'portfolio-media', storagePath: destination }
  }))

  const errors = publishValidationErrors(prepared, true)
  if (errors.length) throw new PublishValidationError(errors)
  return prepared
}

export class InMemoryEditorRevisionRepository implements EditorDraftRepository, GuestPublishedRepository, EditorPublishRepository, FavoriteRepository {
  private records: RevisionRecord[] = []
  private media = new Map<string, DraftMediaReference[]>()
  private favorites = new Map<string, FavoriteRecord>()
  private publishedMediaUrls = new Map<string, string>()
  private readonly actorId: string

  constructor(actorId = 'runtime-test-admin') { this.actorId = actorId }

  seedPublished(snapshot: EditorSnapshot, revisionNumber = 1): void {
    const normalizedSnapshot = assertSnapshot(snapshot)
    const now = new Date().toISOString()
    this.records.push({ id: `published-${revisionNumber}`, revision_number: revisionNumber, lock_version: 1, status: 'published', snapshot: clone(normalizedSnapshot), base_revision_number: revisionNumber - 1 || null, created_by: this.actorId, created_at: now, updated_at: now, published_at: now, source_draft_revision_id: null, published_by: this.actorId, publish_note: null, publication_kind: 'publish', rollback_source_revision_id: null })
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
    const normalizedSnapshot = assertSnapshot(input.snapshot)
    const published = this.records.filter((candidate) => candidate.status === 'published').sort((a, b) => b.revision_number - a.revision_number)[0]
    const currentBase = published?.revision_number ?? null
    if (currentBase !== input.expectedBaseRevision) throw new RevisionConflictError()
    const existing = input.createNew ? undefined : this.records.find((candidate) => candidate.status === 'draft' && candidate.id === input.draftRevisionId)
    if (!existing && !input.createNew && input.draftRevisionId) throw new Error('Draft revision was not found.')
    if (existing && existing.lock_version !== input.expectedDraftLockVersion) throw new RevisionConflictError('The Draft changed since it was loaded. Reload the latest Draft.')
    if (!existing && (await this.countDrafts()) >= 10) throw new DraftLimitError()
    const now = new Date().toISOString()
    const revision: RevisionRecord = existing
      ? { ...existing, snapshot: withDraftMedia(normalizedSnapshot, input.mediaReferences), base_revision_number: input.expectedBaseRevision, lock_version: existing.lock_version + 1, updated_at: now }
      : { id: `draft-${nextRevision(this.records)}`, revision_number: nextRevision(this.records), lock_version: 1, status: 'draft', snapshot: withDraftMedia(normalizedSnapshot, input.mediaReferences), base_revision_number: input.expectedBaseRevision, created_by: this.actorId, created_at: now, updated_at: now, published_at: null, source_draft_revision_id: null, published_by: null, publish_note: null, publication_kind: null, rollback_source_revision_id: null }
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

  async resolvePublishedMedia(snapshot: EditorSnapshot): Promise<EditorSnapshot> {
    const resolved = clone(snapshot)
    resolved.media.references = resolved.media.references.map((reference) => ({
      ...reference,
      uri: reference.storagePath ? this.publishedMediaUrls.get(reference.storagePath) ?? reference.uri : reference.uri
    }))
    return resolved
  }

  async validateDraft(draftRevisionId: string): Promise<PublishValidationResult> {
    const draft = this.records.find((candidate) => candidate.id === draftRevisionId && candidate.status === 'draft') ?? null
    const errors = draft ? publishValidationErrors(draft.snapshot) : ['Draft revision was not found.']
    return { valid: errors.length === 0, errors, draft: draft ? clone(draft) : null }
  }

  async publishDraft(input: PublishDraftInput): Promise<RevisionRecord> {
    const validation = await this.validateDraft(input.draftRevisionId)
    if (!validation.valid || !validation.draft) throw new PublishValidationError(validation.errors)
    const currentPublished = publishedRevisionNumber(this.records)
    if (currentPublished !== input.expectedPublishedRevision) throw new PublishConflictError()
    if (validation.draft.base_revision_number !== currentPublished) throw new PublishConflictError('This Draft is based on an older Published revision.')
    if (validation.draft.lock_version !== input.expectedDraftLockVersion) throw new PublishConflictError('The Draft changed while Publish was being prepared.')

    const revisionNumber = (currentPublished ?? 0) + 1
    const prepared = clone(validation.draft.snapshot)
    prepared.media.references = prepared.media.references.map((reference) => {
      const extension = extensionForMedia(reference.mimeType, reference.storagePath ?? reference.uri)
      const storagePath = `published/${revisionNumber}/${reference.assetId}-${crypto.randomUUID()}.${extension}`
      this.publishedMediaUrls.set(storagePath, reference.uri)
      return { ...reference, uri: storagePath, bucket: 'portfolio-media', storagePath }
    })
    const preparedErrors = publishValidationErrors(prepared, true)
    if (preparedErrors.length) throw new PublishValidationError(preparedErrors)

    const now = new Date().toISOString()
    const revision: RevisionRecord = {
      id: `published-${revisionNumber}-${crypto.randomUUID()}`,
      revision_number: revisionNumber,
      lock_version: 1,
      status: 'published',
      snapshot: prepared,
      base_revision_number: currentPublished,
      created_by: this.actorId,
      created_at: now,
      updated_at: now,
      published_at: now,
      source_draft_revision_id: validation.draft.id,
      published_by: this.actorId,
      publish_note: input.note?.trim() || null,
      publication_kind: 'publish',
      rollback_source_revision_id: null
    }
    this.records.push(revision)
    return clone(revision)
  }

  async rollbackRevision(input: RollbackRevisionInput): Promise<RevisionRecord> {
    const currentPublished = publishedRevisionNumber(this.records)
    if (currentPublished !== input.expectedPublishedRevision) throw new PublishConflictError()
    const target = this.records.find((record) => record.id === input.targetRevisionId && record.status === 'published')
    if (!target) throw new PublishValidationError(['Published revision was not found.'])
    if (target.revision_number >= input.expectedPublishedRevision) throw new PublishValidationError(['Rollback must select an older Published revision.'])
    const now = new Date().toISOString()
    const revision: RevisionRecord = {
      ...clone(target),
      id: `published-${input.expectedPublishedRevision + 1}-${crypto.randomUUID()}`,
      revision_number: input.expectedPublishedRevision + 1,
      base_revision_number: input.expectedPublishedRevision,
      created_by: this.actorId,
      created_at: now,
      updated_at: now,
      published_at: now,
      published_by: this.actorId,
      publish_note: input.note?.trim() || null,
      publication_kind: 'rollback',
      rollback_source_revision_id: target.id
    }
    this.records.push(revision)
    return clone(revision)
  }

  async getPublishedRevision(): Promise<RevisionRecord | null> {
    return (await this.loadPublishedSnapshot())?.revision ?? null
  }

  async getHistory(): Promise<RevisionRecord[]> {
    return this.records.filter((record) => record.status === 'published').sort((left, right) => right.revision_number - left.revision_number).map(clone)
  }
}

type RevisionRow = Omit<RevisionRecord, 'revision_number' | 'lock_version' | 'snapshot'> & { revision_number: number | string; lock_version: number | string; snapshot: EditorSnapshot | string }

function fromRow(row: RevisionRow): RevisionRecord {
  const snapshot = typeof row.snapshot === 'string' ? deserializeEditorSnapshot(row.snapshot) : row.snapshot
  const normalized = assertSnapshot(snapshot)
  return {
    ...row,
    revision_number: Number(row.revision_number),
    lock_version: Number(row.lock_version ?? 1),
    snapshot: clone(normalized),
    source_draft_revision_id: row.source_draft_revision_id ?? null,
    published_by: row.published_by ?? null,
    publish_note: row.publish_note ?? null,
    publication_kind: row.publication_kind ?? null,
    rollback_source_revision_id: row.rollback_source_revision_id ?? null
  }
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
    const supabaseClient = await loadSupabaseClient()
    const { error } = await supabaseClient.storage.from('portfolio-media').upload(storagePath, file, { upsert: false, contentType: file.type })
    if (error) throw new Error(`Draft media upload failed: ${error.message}`)
    const { data, error: signedError } = await supabaseClient.storage.from('portfolio-media').createSignedUrl(storagePath, 3600)
    if (signedError) throw new Error(`Draft media preview failed: ${signedError.message}`)
    return { assetId, bucket: 'portfolio-media', storagePath, mimeType: file.type, width: 0, height: 0, previewUrl: data.signedUrl }
  }

  async getDraftMediaUrl(reference: DraftMediaReference): Promise<string> {
    const supabaseClient = await loadSupabaseClient()
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
    const rows = await supabaseRpc<RevisionRow[]>('get_active_published_snapshot')
    const row = rows[0]
    if (!row) return null
    const revision = fromRow(row)
    return { snapshot: clone(revision.snapshot), revision }
  }

  async resolvePublishedMedia(snapshot: EditorSnapshot): Promise<EditorSnapshot> {
    const resolved = clone(snapshot)
    resolved.media.references = resolved.media.references.map((reference) => {
      if (reference.bucket !== 'portfolio-media' || !reference.storagePath?.startsWith('published/')) throw new Error(`Guest Runtime rejected non-Published media ${reference.assetId}.`)
      const publicUrl = supabasePublicStorageUrl('portfolio-media', reference.storagePath)
      return { ...reference, uri: publicUrl }
    })
    return resolved
  }
}

export class SupabaseEditorPublishRepository implements EditorPublishRepository {
  async validateDraft(draftRevisionId: string): Promise<PublishValidationResult> {
    if (!isSupabaseConfigured()) throw new Error('Supabase environment is not configured')
    const rows = await supabaseTableRows<RevisionRow>('site_revisions', `?select=*&id=eq.${encodeURIComponent(draftRevisionId)}&status=eq.draft&limit=1`)
    const draft = rows[0] ? fromRow(rows[0]) : null
    const errors = draft ? publishValidationErrors(draft.snapshot) : ['Draft revision was not found.']
    return { valid: errors.length === 0, errors, draft }
  }

  async publishDraft(input: PublishDraftInput): Promise<RevisionRecord> {
    const validation = await this.validateDraft(input.draftRevisionId)
    if (!validation.valid || !validation.draft) throw new PublishValidationError(validation.errors)
    if (validation.draft.lock_version !== input.expectedDraftLockVersion) throw new PublishConflictError('The Draft changed while Publish was being prepared.')

    const nextPublishedRevision = (input.expectedPublishedRevision ?? 0) + 1
    const preparedSnapshot = await prepareSupabasePublishedSnapshot(validation.draft.snapshot, nextPublishedRevision)
    try {
      const rows = await supabaseRpc<RevisionRow[]>('publish_editor_draft', {
        p_draft_id: input.draftRevisionId,
        p_prepared_snapshot: JSON.parse(serializeEditorSnapshot(preparedSnapshot)),
        p_expected_published_revision: input.expectedPublishedRevision,
        p_expected_draft_lock_version: input.expectedDraftLockVersion,
        p_note: input.note?.trim() || null
      })
      if (!rows[0]) throw new Error('Publish did not return an activated revision.')
      return fromRow(rows[0])
    } catch (error) {
      if (error instanceof PublishValidationError) throw error
      const message = error instanceof Error ? error.message : 'Publish failed.'
      if (/changed|older Published revision|40001|409/i.test(message)) throw new PublishConflictError(message)
      if (/Snapshot|media|image|required|invalid|missing|MIME|Draft revision/i.test(message)) throw new PublishValidationError([message])
      throw error
    }
  }

  async rollbackRevision(input: RollbackRevisionInput): Promise<RevisionRecord> {
    try {
      const rows = await supabaseRpc<RevisionRow[]>('rollback_published_revision', {
        p_target_revision_id: input.targetRevisionId,
        p_expected_published_revision: input.expectedPublishedRevision,
        p_note: input.note?.trim() || null
      })
      if (!rows[0]) throw new Error('Rollback did not return an activated revision.')
      return fromRow(rows[0])
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Rollback failed.'
      if (/changed|40001|409/i.test(message)) throw new PublishConflictError(message)
      throw error
    }
  }

  async getPublishedRevision(): Promise<RevisionRecord | null> {
    return (await guestPublishedRepository.loadPublishedSnapshot())?.revision ?? null
  }

  async getHistory(): Promise<RevisionRecord[]> {
    const rows = await supabaseTableRows<RevisionRow>('site_revisions', '?select=*&status=eq.published&order=revision_number.desc')
    return rows.map(fromRow)
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

export const editorPublishRepository: EditorPublishRepository = isSupabaseConfigured()
  ? new SupabaseEditorPublishRepository()
  : inMemoryRepository

export const favoriteRepository: FavoriteRepository = isSupabaseConfigured() ? new SupabaseFavoriteRepository() : inMemoryRepository
