import { supabaseTableRows, supabaseRestRequest, isSupabaseConfigured } from '../lib/supabaseRest'
import { supabaseClient } from '../lib/supabaseClient'
import type { EditorSnapshot } from '../types/editorSnapshot'
import { deserializeEditorSnapshot, serializeEditorSnapshot, validateEditorSnapshot } from '../editor/editorSnapshot'
import type { DraftMediaReference } from '../types/editor'

export type RevisionStatus = 'draft' | 'published' | 'archived'

export interface RevisionRecord {
  id: string
  revision_number: number
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
}

export interface SaveDraftResult {
  revision: RevisionRecord
  mediaReferences: DraftMediaReference[]
}

export interface EditorDraftRepository {
  loadDraft(): Promise<SaveDraftResult | null>
  saveDraft(input: SaveDraftInput): Promise<SaveDraftResult>
  discardDraft(): Promise<void>
  getDraftStatus(): Promise<DraftStatus>
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

function clone<T>(value: T): T { return structuredClone(value) }

function assertSnapshot(snapshot: EditorSnapshot): void {
  const result = validateEditorSnapshot(snapshot)
  if (!result.valid) throw new Error(`Invalid editor snapshot: ${result.errors.join(' ')}`)
}

function nextRevision(records: RevisionRecord[]): number {
  return records.reduce((max, record) => Math.max(max, record.revision_number), 0) + 1
}

export class InMemoryEditorRevisionRepository implements EditorDraftRepository, GuestPublishedRepository, EditorPublishRepository {
  private records: RevisionRecord[] = []
  private media = new Map<string, DraftMediaReference[]>()
  private readonly actorId: string

  constructor(actorId = 'runtime-test-admin') { this.actorId = actorId }

  seedPublished(snapshot: EditorSnapshot, revisionNumber = 1): void {
    assertSnapshot(snapshot)
    this.records.push({ id: `published-${revisionNumber}`, revision_number: revisionNumber, status: 'published', snapshot: clone(snapshot), base_revision_number: revisionNumber - 1 || null, created_by: this.actorId, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), published_at: new Date().toISOString() })
  }

  async loadDraft(): Promise<SaveDraftResult | null> {
    const record = this.records.filter((candidate) => candidate.status === 'draft').sort((a, b) => b.revision_number - a.revision_number)[0]
    return record ? { revision: clone(record), mediaReferences: clone(this.media.get(record.id) ?? []) } : null
  }

  async saveDraft(input: SaveDraftInput): Promise<SaveDraftResult> {
    assertSnapshot(input.snapshot)
    const published = this.records.filter((candidate) => candidate.status === 'published').sort((a, b) => b.revision_number - a.revision_number)[0]
    const currentBase = published?.revision_number ?? null
    if (currentBase !== input.expectedBaseRevision) throw new RevisionConflictError()
    const existing = this.records.find((candidate) => candidate.status === 'draft')
    const now = new Date().toISOString()
    const revision: RevisionRecord = existing
      ? { ...existing, snapshot: clone(input.snapshot), base_revision_number: input.expectedBaseRevision, updated_at: now }
      : { id: `draft-${nextRevision(this.records)}`, revision_number: nextRevision(this.records), status: 'draft', snapshot: clone(input.snapshot), base_revision_number: input.expectedBaseRevision, created_by: this.actorId, created_at: now, updated_at: now, published_at: null }
    this.records = [...this.records.filter((candidate) => candidate.id !== revision.id), revision]
    this.media.set(revision.id, clone(input.mediaReferences))
    return { revision: clone(revision), mediaReferences: clone(input.mediaReferences) }
  }

  async discardDraft(): Promise<void> {
    const drafts = this.records.filter((candidate) => candidate.status === 'draft')
    this.records = this.records.filter((candidate) => candidate.status !== 'draft')
    for (const draft of drafts) this.media.delete(draft.id)
  }

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

type RevisionRow = Omit<RevisionRecord, 'revision_number' | 'snapshot'> & { revision_number: number | string; snapshot: EditorSnapshot | string }

async function currentUserId(): Promise<string> {
  const { data } = await supabaseClient.auth.getUser()
  if (!data.user) throw new Error('Authenticated editor user is required')
  return data.user.id
}

function fromRow(row: RevisionRow): RevisionRecord {
  const snapshot = typeof row.snapshot === 'string' ? deserializeEditorSnapshot(row.snapshot) : row.snapshot
  assertSnapshot(snapshot)
  return { ...row, revision_number: Number(row.revision_number), snapshot: clone(snapshot) }
}

export class SupabaseEditorDraftRepository implements EditorDraftRepository {
  async loadDraft(): Promise<SaveDraftResult | null> {
    const rows = await supabaseTableRows<RevisionRow>('site_revisions', '?select=*&status=eq.draft&order=updated_at.desc&limit=1')
    const row = rows[0]
    return row ? { revision: fromRow(row), mediaReferences: [] } : null
  }

  async saveDraft(input: SaveDraftInput): Promise<SaveDraftResult> {
    assertSnapshot(input.snapshot)
    const actorId = await currentUserId()
    const current = await this.loadDraft()
    const published = await supabaseTableRows<RevisionRow>('site_revisions', '?select=revision_number&status=eq.published&order=revision_number.desc&limit=1')
    const currentBase = published[0] ? Number(published[0].revision_number) : null
    if (currentBase !== input.expectedBaseRevision) throw new RevisionConflictError()
    const now = new Date().toISOString()
    const row = { id: current?.revision.id ?? crypto.randomUUID(), revision_number: current?.revision.revision_number ?? (currentBase ?? 0) + 1, status: 'draft', snapshot: input.snapshot, base_revision_number: input.expectedBaseRevision, created_by: actorId, updated_at: now }
    const saved = await supabaseRestRequest<RevisionRow[]>('site_revisions', { method: 'POST', query: '?on_conflict=id', body: { ...row, snapshot: JSON.parse(serializeEditorSnapshot(input.snapshot)) }, prefer: 'resolution=merge-duplicates,return=representation' })
    const revision = fromRow(saved[0] ?? row as RevisionRow)
    return { revision, mediaReferences: clone(input.mediaReferences) }
  }

  async discardDraft(): Promise<void> {
    const draft = await this.loadDraft()
    if (draft) await supabaseRestRequest('site_revisions', { method: 'DELETE', query: `?id=eq.${encodeURIComponent(draft.revision.id)}`, prefer: 'return=minimal' })
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
