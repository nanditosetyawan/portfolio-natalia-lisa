import type { SiteSnapshot } from '../data/default/site'
import {
  EDITOR_SNAPSHOT_READER_VERSION,
  EDITOR_SNAPSHOT_SCHEMA_VERSION,
  type EditorSnapshot,
  type SnapshotEntityReference,
  type SnapshotValidationResult
} from '../types/editorSnapshot'

const clone = <T>(value: T): T => structuredClone(value)

function entityReferences(snapshot: SiteSnapshot): SnapshotEntityReference[] {
  const references: SnapshotEntityReference[] = []
  const add = (value: unknown, section: string, kind: SnapshotEntityReference['kind'], fallback: string) => {
    if (!value || typeof value !== 'object' || !('id' in value)) return
    const row = value as { id: string; title?: string; label?: string; name?: string; school?: string }
    references.push({ entityId: row.id, section, kind, label: row.title ?? row.label ?? row.name ?? row.school ?? fallback })
  }
  add(snapshot.content.portfolio, 'Portfolio', 'content', 'Portfolio')
  add(snapshot.content.profile, 'Portfolio', 'media', 'Profile')
  add(snapshot.content.about, 'About', 'content', 'About')
  snapshot.content.about.paragraphs.forEach((item) => add(item, 'About', 'content', 'Paragraph'))
  add(snapshot.content.education, 'Education', 'content', 'Education')
  snapshot.content.college.items.forEach((item) => add(item, 'College', 'content', 'College'))
  snapshot.content.shs.items.forEach((item) => add(item, 'SHS', 'content', 'SHS'))
  add(snapshot.content.experience, 'Experience', 'content', 'Experience')
  snapshot.content.experience.items.forEach((item) => add(item, 'Experience', 'content', 'Experience'))
  add(snapshot.content.certificate, 'Certificate', 'content', 'Certificate')
  add(snapshot.content.contact, 'Contact', 'content', 'Contact')
  add(snapshot.content.navigation, 'Navigation', 'navigation', 'Navigation')
  return references
}

export function createEditorSnapshot(snapshot: SiteSnapshot, revision: Partial<EditorSnapshot['revision']> = {}): EditorSnapshot {
  return {
    compatibility: { schemaVersion: EDITOR_SNAPSHOT_SCHEMA_VERSION, minimumReaderVersion: EDITOR_SNAPSHOT_READER_VERSION, maximumWriterVersion: EDITOR_SNAPSHOT_READER_VERSION },
    revision: { baseRevisionNumber: revision.baseRevisionNumber ?? null, draftRevisionNumber: revision.draftRevisionNumber ?? null },
    entities: entityReferences(snapshot),
    content: clone(snapshot.content),
    typography: {},
    layout: {},
    media: {
      references: snapshot.mediaAssets.map((asset) => ({ assetId: asset.id, uri: asset.source, mimeType: asset.mimeType, alt: asset.alt })),
      assignments: snapshot.mediaUsages.map((usage) => ({ entityId: usage.ownerId, role: usage.role, assetId: usage.mediaAssetId, objectPosition: usage.objectPosition }))
    },
    backgrounds: {},
    buttons: {},
    animations: {},
    visual: clone(snapshot.visual),
    behavior: clone(snapshot.behavior)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function validateEditorSnapshot(input: unknown): SnapshotValidationResult {
  const errors: string[] = []
  if (!isRecord(input)) return { valid: false, errors: ['Snapshot must be an object.'] }
  const compatibility = input.compatibility
  if (!isRecord(compatibility)) errors.push('compatibility is required.')
  else {
    if (compatibility.schemaVersion !== EDITOR_SNAPSHOT_SCHEMA_VERSION) errors.push(`Unsupported schema version: ${String(compatibility.schemaVersion)}.`)
    if (Number(compatibility.minimumReaderVersion) > EDITOR_SNAPSHOT_READER_VERSION) errors.push('Snapshot requires a newer reader.')
    if (Number(compatibility.maximumWriterVersion) < EDITOR_SNAPSHOT_READER_VERSION) errors.push('Snapshot was written by an incompatible writer.')
  }
  if (!isRecord(input.revision)) errors.push('revision is required.')
  if (!Array.isArray(input.entities)) errors.push('entities must be an array.')
  if (!isRecord(input.content)) errors.push('content is required.')
  for (const key of ['typography', 'layout', 'backgrounds', 'buttons', 'animations']) if (!isRecord(input[key])) errors.push(`${key} must be an object.`)
  if (!isRecord(input.media) || !Array.isArray(input.media.references) || !Array.isArray(input.media.assignments)) errors.push('media references and assignments are required.')
  if (!isRecord(input.visual)) errors.push('visual is required.')
  if (!isRecord(input.behavior)) errors.push('behavior is required.')
  return errors.length ? { valid: false, errors } : { valid: true, errors: [], value: clone(input as unknown as EditorSnapshot) }
}

export function serializeEditorSnapshot(snapshot: EditorSnapshot): string {
  const result = validateEditorSnapshot(snapshot)
  if (!result.valid) throw new Error(`Cannot serialize invalid EditorSnapshot: ${result.errors.join(' ')}`)
  return JSON.stringify(snapshot)
}

export function deserializeEditorSnapshot(serialized: string): EditorSnapshot {
  let parsed: unknown
  try { parsed = JSON.parse(serialized) } catch { throw new Error('EditorSnapshot JSON is invalid.') }
  const result = validateEditorSnapshot(parsed)
  if (!result.valid || !result.value) throw new Error(`Invalid EditorSnapshot: ${result.errors.join(' ')}`)
  return result.value
}

