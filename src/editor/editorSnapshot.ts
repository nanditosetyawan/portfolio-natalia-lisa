import { createDefaultSiteSnapshot, type SiteSnapshot } from '../data/default/site'
import { defaultContact, type DefaultContactDetail } from '../data/default/contact'
import type { CertificateCard } from '../data/default/certificates'
import type { MediaUsage, PhotoAreaEntity } from '../types/site'
import { validateRegisteredProperties } from './propertyRegistry'
import { validateEncodedAnimationName } from './animationRegistry'
import {
  EDITOR_SNAPSHOT_MINIMUM_SUPPORTED_VERSION,
  EDITOR_SNAPSHOT_READER_VERSION,
  EDITOR_SNAPSHOT_SCHEMA_VERSION,
  type EditorSnapshot,
  type SnapshotEntityReference,
  type SnapshotValidationResult
} from '../types/editorSnapshot'
import {
  MAX_DYNAMIC_INSTANCES_PER_SECTION,
  MAX_DYNAMIC_INSTANCES_PER_SNAPSHOT,
  normalizeEditorSectionId
} from './editorInstances'

const clone = <T>(value: T): T => {
  try { return structuredClone(value) }
  catch { return JSON.parse(JSON.stringify(value)) as T }
}

const defaultEditorSession = (): EditorSnapshot['session'] => ({
  selectedEntityId: '',
  selectedSection: '',
  activeAccordion: '',
  previewScrollTop: 0,
  previewScrollLeft: 0,
  zoom: 0.6,
  userZoom: null,
  propertySearch: '',
  objectStates: {},
  expandedLayers: []
})

function entityReferences(snapshot: SiteSnapshot): SnapshotEntityReference[] {
  const references: SnapshotEntityReference[] = []
  const add = (value: unknown, section: string, kind: SnapshotEntityReference['kind'], fallback: string) => {
    if (!value || typeof value !== 'object' || !('id' in value)) return
    const row = value as { id: string; title?: string; label?: string; name?: string; school?: string }
    references.push({ entityId: row.id, section, kind, label: row.title ?? row.label ?? row.name ?? row.school ?? fallback })
  }
  add(snapshot.content.portfolio, 'Portfolio', 'content', 'Portfolio')
  if (snapshot.content.profile?.mediaUsageId) {
    references.push({
      entityId: snapshot.content.profile.mediaUsageId,
      section: 'Portfolio',
      kind: 'media',
      label: 'Profile'
    })
  }
  add(snapshot.content.about, 'About', 'content', 'About')
  snapshot.content.about.paragraphs.forEach((item) => add(item, 'About', 'content', 'Paragraph'))
  add(snapshot.content.education, 'Education', 'content', 'Education')
  snapshot.content.college.items.forEach((item) => add(item, 'College', 'content', 'College'))
  snapshot.content.shs.items.forEach((item) => add(item, 'SHS', 'content', 'SHS'))
  add(snapshot.content.experience, 'Experience', 'content', 'Experience')
  snapshot.content.experience.items.forEach((item) => add(item, 'Experience', 'content', 'Experience'))
  add(snapshot.content.certificate, 'Certificate', 'content', 'Certificate')
  add(snapshot.content.contact, 'Contact', 'content', 'Contact')
  const d = snapshot.content.contact.detail
  if (d) {
    if (d.sectionId) references.push({ entityId: d.sectionId, section: 'Contact Detail', kind: 'background', label: 'Contact Detail Section' })
    if (d.mainPhotoId) references.push({ entityId: d.mainPhotoId, section: 'Contact Detail', kind: 'media', label: 'Main Photo' })
    if (d.welcomeGroupId) references.push({ entityId: d.welcomeGroupId, section: 'Contact Detail', kind: 'container', label: 'Welcome Group' })
    if (d.title?.id) references.push({ entityId: d.title.id, section: 'Contact Detail', kind: 'text', label: 'Name' })
    if (d.subtitle?.id) references.push({ entityId: d.subtitle.id, section: 'Contact Detail', kind: 'text', label: 'Role' })
    if (d.description?.id) references.push({ entityId: d.description.id, section: 'Contact Detail', kind: 'text', label: 'Description' })
    if (d.socialLinks?.whatsapp?.id) references.push({ entityId: d.socialLinks.whatsapp.id, section: 'Contact Detail', kind: 'button', label: 'WhatsApp' })
    if (d.socialLinks?.linkedin?.id) references.push({ entityId: d.socialLinks.linkedin.id, section: 'Contact Detail', kind: 'button', label: 'LinkedIn' })
    if (d.socialLinks?.cv?.id) references.push({ entityId: d.socialLinks.cv.id, section: 'Contact Detail', kind: 'button', label: 'CV' })
    if (d.messageSectionId) references.push({ entityId: d.messageSectionId, section: 'Text Me', kind: 'background', label: 'Text Me Section' })
    if (d.messageCardId) references.push({ entityId: d.messageCardId, section: 'Text Me', kind: 'container', label: 'Message Card' })
    if (d.message?.title?.id) references.push({ entityId: d.message.title.id, section: 'Text Me', kind: 'text', label: 'Text Me Title' })
    if (d.messageFieldsId) references.push({ entityId: d.messageFieldsId, section: 'Text Me', kind: 'container', label: 'Message Fields' })
    if (d.message?.submitButton?.id) references.push({ entityId: d.message.submitButton.id, section: 'Text Me', kind: 'button', label: 'Submit Button' })
    if (d.messagePhotoId) references.push({ entityId: d.messagePhotoId, section: 'Text Me', kind: 'media', label: 'Message Photo' })
  }
  add(snapshot.content.navigation, 'Navigation', 'navigation', 'Navigation')
  return references
}

export function createEditorSnapshot(snapshot: SiteSnapshot, revision: Partial<EditorSnapshot['revision']> = {}): EditorSnapshot {
  const references = entityReferences(snapshot)
  const created: EditorSnapshot = {
    compatibility: { schemaVersion: EDITOR_SNAPSHOT_SCHEMA_VERSION, minimumReaderVersion: EDITOR_SNAPSHOT_MINIMUM_SUPPORTED_VERSION, maximumWriterVersion: EDITOR_SNAPSHOT_READER_VERSION },
    revision: { baseRevisionNumber: revision.baseRevisionNumber ?? null, draftRevisionNumber: revision.draftRevisionNumber ?? null },
    entities: references,
    instances: [],
    content: clone(snapshot.content),
    certificateCards: [],
    typography: Object.fromEntries(references.map(ref => [ref.entityId, {}])),
    layout: Object.fromEntries(references.map(ref => [ref.entityId, {}])),
    media: {
      references: snapshot.mediaAssets.map((asset) => ({ assetId: asset.id, uri: asset.source, mimeType: asset.mimeType, alt: asset.alt })),
      assignments: snapshot.mediaUsages.map((usage) => ({ entityId: usage.id, role: usage.role, assetId: usage.mediaAssetId, objectPosition: usage.objectPosition })),
      styles: Object.fromEntries(snapshot.mediaUsages.map(usage => [usage.id, { hoverEnabled: false, outlineEnabled: false, outlineWidth: 1, aspectRatioLocked: false }]))
    },
    backgrounds: Object.fromEntries(references.map(ref => [ref.entityId, { boxShadow: 'none' }])),
    buttons: Object.fromEntries(references.map(ref => [ref.entityId, {}])),
    animations: Object.fromEntries(references.map(ref => [ref.entityId, { name: 'none' }])),
    session: defaultEditorSession(),
    visual: clone(snapshot.visual),
    behavior: clone(snapshot.behavior)
  }
  normalizeContactDetailSnapshot(created as unknown as Record<string, unknown>)
  return created
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

const COLOR_PATTERN = /^(?:#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})|rgba?\([^)]{1,80}\)|hsla?\([^)]{1,80}\)|transparent|currentColor)$/i
const CSS_LENGTH_PATTERN = /^-?\d+(?:\.\d+)?(?:px|rem|em|%|vw|vh|vmin|vmax|ch|ex)?$/i
const CSS_LENGTH_FUNCTION_PATTERN = /^(?:calc|clamp|min|max|var|fit-content)\([^;{}]{1,256}\)$/i
const ENTITY_ID_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,127}$/i

function validCssLength(value: unknown, allowAuto = false): boolean {
  return (typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 100000)
    || (typeof value === 'string' && ((allowAuto && value === 'auto') || CSS_LENGTH_PATTERN.test(value) || CSS_LENGTH_FUNCTION_PATTERN.test(value)))
}

function validString(value: unknown, maximum = 256, allowEmpty = false): boolean {
  return typeof value === 'string' && value.length <= maximum && (allowEmpty || value.trim().length > 0)
}

function normalizeLegacyProfileObject(snapshot: Record<string, unknown>): void {
  const profile = isRecord(snapshot.content) && isRecord(snapshot.content.profile) ? snapshot.content.profile : null
  const legacyId = profile && typeof profile.id === 'string' ? profile.id : ''
  const mediaId = profile && typeof profile.mediaUsageId === 'string' ? profile.mediaUsageId : ''
  if (!legacyId || !mediaId || legacyId === mediaId) return

  if (Array.isArray(snapshot.entities) && snapshot.entities.some((entity) => isRecord(entity) && entity.entityId === legacyId)) {
    const hasMediaEntity = snapshot.entities.some((entity) => isRecord(entity) && entity.entityId === mediaId)
    const fallbackLabel = typeof profile?.name === 'string' && profile.name.trim() ? profile.name.trim() : 'Profile'
    snapshot.entities = snapshot.entities.flatMap((entity) => {
      if (!isRecord(entity) || entity.entityId !== legacyId) return [entity]
      return hasMediaEntity ? [] : [{ entityId: mediaId, section: 'Portfolio', kind: 'media', label: typeof entity.label === 'string' && entity.label.trim() ? entity.label : fallbackLabel }]
    })
  }

  for (const domainKey of ['layout', 'backgrounds', 'animations'] as const) {
    const domain = snapshot[domainKey]
    if (!isRecord(domain) || !isRecord(domain[legacyId])) continue
    const source = domain[legacyId] as Record<string, unknown>
    const target = isRecord(domain[mediaId]) ? { ...(domain[mediaId] as Record<string, unknown>) } : {}
    for (const [key, value] of Object.entries(source)) {
      if (domainKey === 'backgrounds' && key === 'boxShadow' && value === 'none') continue
      if (domainKey === 'animations' && key === 'name' && value === 'none') continue
      if (target[key] === undefined) target[key] = value
    }
    if (Object.keys(target).length) domain[mediaId] = target
    delete domain[legacyId]
  }
  for (const domainKey of ['typography', 'buttons'] as const) {
    if (isRecord(snapshot[domainKey])) delete (snapshot[domainKey] as Record<string, unknown>)[legacyId]
  }
  if (isRecord(snapshot.session)) {
    if (snapshot.session.selectedEntityId === legacyId) snapshot.session.selectedEntityId = mediaId
    if (isRecord(snapshot.session.objectStates) && isRecord(snapshot.session.objectStates[legacyId])) {
      if (!snapshot.session.objectStates[mediaId]) snapshot.session.objectStates[mediaId] = snapshot.session.objectStates[legacyId]
      delete snapshot.session.objectStates[legacyId]
    }
  }
}

export function validateEditorSnapshot(input: unknown): SnapshotValidationResult {
  const errors: string[] = []
  if (!isRecord(input)) return { valid: false, errors: ['Snapshot must be an object.'] }
  const normalized = clone(input)
  normalizeLegacyProfileObject(normalized)
  normalizeContactDetailSnapshot(normalized)
  if (!isRecord(normalized.session)) normalized.session = defaultEditorSession()
  else {
    if (!('userZoom' in normalized.session)) normalized.session.userZoom = typeof normalized.session.zoom === 'number' && normalized.session.zoom > 0 ? normalized.session.zoom : null
    if (!isRecord(normalized.session.objectStates)) normalized.session.objectStates = {}
    if (!Array.isArray(normalized.session.expandedLayers)) normalized.session.expandedLayers = []
  }
  const compatibility = normalized.compatibility
  let sourceSchemaVersion: number | null = null
  if (!isRecord(compatibility)) errors.push('compatibility is required.')
  else {
    sourceSchemaVersion = Number(compatibility.schemaVersion)
    if (!Number.isInteger(sourceSchemaVersion)
      || sourceSchemaVersion < EDITOR_SNAPSHOT_MINIMUM_SUPPORTED_VERSION
      || sourceSchemaVersion > EDITOR_SNAPSHOT_SCHEMA_VERSION) errors.push(`Unsupported schema version: ${String(compatibility.schemaVersion)}.`)
    if (Number(compatibility.minimumReaderVersion) > EDITOR_SNAPSHOT_READER_VERSION) errors.push('Snapshot requires a newer reader.')
    if (!Number.isInteger(Number(compatibility.minimumReaderVersion)) || Number(compatibility.minimumReaderVersion) < 1) errors.push('Snapshot minimumReaderVersion is invalid.')
    if (!Number.isInteger(Number(compatibility.maximumWriterVersion)) || Number(compatibility.maximumWriterVersion) < 1) errors.push('Snapshot maximumWriterVersion is invalid.')
  }
  if (!isRecord(normalized.revision)) errors.push('revision is required.')
  if (!Array.isArray(normalized.entities)) errors.push('entities must be an array.')
  else normalized.entities.forEach((entity, index) => {
    if (!isRecord(entity) || typeof entity.entityId !== 'string' || !ENTITY_ID_PATTERN.test(entity.entityId) || typeof entity.section !== 'string' || typeof entity.kind !== 'string' || typeof entity.label !== 'string') errors.push(`entities[${index}] is invalid.`)
  })
  if (sourceSchemaVersion === 1 && !Array.isArray(normalized.instances)) normalized.instances = []
  if (!Array.isArray(normalized.instances)) errors.push('instances must be an array.')
  else {
    if (normalized.instances.length > MAX_DYNAMIC_INSTANCES_PER_SNAPSHOT) errors.push(`instances exceeds the maximum of ${MAX_DYNAMIC_INSTANCES_PER_SNAPSHOT}.`)
    const fixedIds = new Set(Array.isArray(normalized.entities)
      ? normalized.entities.flatMap((entity) => isRecord(entity) && typeof entity.entityId === 'string' ? [entity.entityId] : [])
      : [])
    const instanceIds = new Set<string>()
    const sectionCounts = new Map<string, number>()
    normalized.instances.forEach((instance, index) => {
      if (!isRecord(instance)) {
        errors.push(`instances[${index}] is invalid.`)
        return
      }
      const instanceId = typeof instance.instanceId === 'string' ? instance.instanceId : ''
      const sectionId = typeof instance.sectionId === 'string' ? normalizeEditorSectionId(instance.sectionId) : ''
      if (!ENTITY_ID_PATTERN.test(instanceId)
        || instance.type !== 'image'
        || !ENTITY_ID_PATTERN.test(sectionId)
        || !validString(instance.label, 128)
        || typeof instance.order !== 'number'
        || !Number.isInteger(instance.order)
        || instance.order < 0
        || instance.order > 100000
        || !validString(instance.createdAt, 64)
        || !Number.isFinite(Date.parse(String(instance.createdAt)))
        || !isRecord(instance.source)
        || instance.source.kind !== 'media-assignment'
        || instance.source.assignmentEntityId !== instanceId) errors.push(`instances[${index}] is invalid.`)
      if (fixedIds.has(instanceId) || instanceIds.has(instanceId)) errors.push(`instances[${index}].instanceId is not unique.`)
      instanceIds.add(instanceId)
      if (sectionId) sectionCounts.set(sectionId, (sectionCounts.get(sectionId) ?? 0) + 1)
    })
    for (const [sectionId, count] of sectionCounts) {
      if (count > MAX_DYNAMIC_INSTANCES_PER_SECTION) errors.push(`instances for ${sectionId} exceed the maximum of ${MAX_DYNAMIC_INSTANCES_PER_SECTION}.`)
    }
  }
  if (!isRecord(normalized.content)) errors.push('content is required.')
  if (!Array.isArray(normalized.certificateCards)) normalized.certificateCards = []
  for (const key of ['typography', 'layout', 'backgrounds', 'buttons', 'animations']) if (!isRecord(normalized[key])) errors.push(`${key} must be an object.`)
  if (isRecord(normalized.media) && !isRecord(normalized.media.styles)) normalized.media.styles = {}
  if (!isRecord(normalized.media) || !Array.isArray(normalized.media.references) || !Array.isArray(normalized.media.assignments) || !isRecord(normalized.media.styles)) errors.push('media references, assignments, and styles are required.')
  if (!isRecord(normalized.visual)) errors.push('visual is required.')
  if (!isRecord(normalized.behavior)) errors.push('behavior is required.')
  const session = normalized.session as Record<string, unknown>
  if (!isRecord(session) || typeof session.selectedEntityId !== 'string' || typeof session.selectedSection !== 'string' || typeof session.activeAccordion !== 'string' || typeof session.previewScrollTop !== 'number' || !Number.isFinite(session.previewScrollTop) || session.previewScrollTop < 0 || typeof session.previewScrollLeft !== 'number' || !Number.isFinite(session.previewScrollLeft) || session.previewScrollLeft < 0 || typeof session.zoom !== 'number' || !Number.isFinite(session.zoom) || session.zoom <= 0 || session.zoom > 4 || !(session.userZoom === null || (typeof session.userZoom === 'number' && Number.isFinite(session.userZoom) && session.userZoom > 0 && session.userZoom <= 4)) || typeof session.propertySearch !== 'string' || !isRecord(session.objectStates) || !Array.isArray(session.expandedLayers) || session.expandedLayers.some((value) => typeof value !== 'string')) errors.push('session contains invalid values.')
  if (isRecord(session.objectStates)) {
    for (const [entityId, state] of Object.entries(session.objectStates)) {
      if (!ENTITY_ID_PATTERN.test(entityId) || !isRecord(state) || typeof state.locked !== 'boolean' || typeof state.hidden !== 'boolean') errors.push(`session.objectStates.${entityId} is invalid.`)
    }
  }
  if (Array.isArray(normalized.certificateCards)) {
    normalized.certificateCards.forEach((card, index) => {
      if (!isRecord(card) || typeof card.id !== 'string' || typeof card.title !== 'string' || typeof card.date !== 'string' || typeof card.description !== 'string') errors.push(`certificateCards[${index}] is invalid.`)
    })
  }
  for (const [key, settings] of Object.entries(normalized.typography ?? {})) {
    if (!isRecord(settings)) { errors.push(`typography.${key} is invalid.`); continue }
    if (settings.fontSize !== undefined && (typeof settings.fontSize !== 'string' || !validCssLength(settings.fontSize) || (CSS_LENGTH_PATTERN.test(settings.fontSize) && Number.parseFloat(settings.fontSize) <= 0))) errors.push(`typography.${key}.fontSize is invalid.`)
    if (settings.fontWeight !== undefined && (typeof settings.fontWeight !== 'number' || !Number.isInteger(settings.fontWeight) || settings.fontWeight < 100 || settings.fontWeight > 900)) errors.push(`typography.${key}.fontWeight is invalid.`)
    if (settings.color !== undefined && (typeof settings.color !== 'string' || !COLOR_PATTERN.test(settings.color))) errors.push(`typography.${key}.color is invalid.`)
    if (settings.hoverColor !== undefined && (typeof settings.hoverColor !== 'string' || !COLOR_PATTERN.test(settings.hoverColor))) errors.push(`typography.${key}.hoverColor is invalid.`)
    if (settings.fontFamily !== undefined && !validString(settings.fontFamily, 160)) errors.push(`typography.${key}.fontFamily is invalid.`)
    if (settings.lineHeight !== undefined && !(settings.lineHeight === 'normal' || validCssLength(settings.lineHeight))) errors.push(`typography.${key}.lineHeight is invalid.`)
    if (settings.letterSpacing !== undefined && !(settings.letterSpacing === 'normal' || validCssLength(settings.letterSpacing))) errors.push(`typography.${key}.letterSpacing is invalid.`)
    if (settings.textShadow !== undefined && !validString(settings.textShadow, 256, true)) errors.push(`typography.${key}.textShadow is invalid.`)
    if (settings.textAlign !== undefined && !['left', 'center', 'right', 'justify'].includes(String(settings.textAlign))) errors.push(`typography.${key}.textAlign is invalid.`)
    if (settings.fontStyle !== undefined && !['normal', 'italic'].includes(String(settings.fontStyle))) errors.push(`typography.${key}.fontStyle is invalid.`)
  }
  for (const [key, settings] of Object.entries(normalized.layout ?? {})) {
    if (!isRecord(settings)) { errors.push(`layout.${key} is invalid.`); continue }
    if (settings.positionMode !== undefined && !['flow', 'absolute'].includes(String(settings.positionMode))) errors.push(`layout.${key}.positionMode is invalid.`)
    for (const field of ['x', 'y']) if (settings[field] !== undefined && !validCssLength(settings[field])) errors.push(`layout.${key}.${field} is invalid.`)
    for (const field of ['width', 'height']) if (settings[field] !== undefined && !validCssLength(settings[field], true)) errors.push(`layout.${key}.${field} is invalid.`)
    if (settings.rotation !== undefined && !((typeof settings.rotation === 'number' && Number.isFinite(settings.rotation) && Math.abs(settings.rotation) <= 36000) || (typeof settings.rotation === 'string' && /^-?\d+(?:\.\d+)?(?:deg|rad|turn)$/i.test(settings.rotation)))) errors.push(`layout.${key}.rotation is invalid.`)
    for (const field of ['margin', 'padding']) if (settings[field] !== undefined && !validString(settings[field], 128, true)) errors.push(`layout.${key}.${field} is invalid.`)
    if (settings.alignment !== undefined && !['start', 'center', 'end', 'stretch', 'space-between', 'space-around'].includes(String(settings.alignment))) errors.push(`layout.${key}.alignment is invalid.`)
    if (settings.display !== undefined && !['block', 'inline', 'inline-block', 'flex', 'grid', 'none'].includes(String(settings.display))) errors.push(`layout.${key}.display is invalid.`)
    if (settings.visibility !== undefined && !['visible', 'hidden'].includes(String(settings.visibility))) errors.push(`layout.${key}.visibility is invalid.`)
    if (settings.zIndex !== undefined && (typeof settings.zIndex !== 'number' || !Number.isInteger(settings.zIndex) || settings.zIndex < -10000 || settings.zIndex > 10000)) errors.push(`layout.${key}.zIndex is invalid.`)
  }
  if (isRecord(normalized.media)) {
    const referenceAssetIds = new Set<string>()
    for (const [index, reference] of (normalized.media.references as unknown[]).entries()) {
      if (!isRecord(reference) || typeof reference.assetId !== 'string' || !ENTITY_ID_PATTERN.test(reference.assetId) || !validString(reference.uri, 2048)) { errors.push(`media.references[${index}] is invalid.`); continue }
      if (referenceAssetIds.has(reference.assetId)) errors.push(`media.references[${index}].assetId is not unique.`)
      else referenceAssetIds.add(reference.assetId)
      if (reference.bucket !== undefined && !validString(reference.bucket, 128)) errors.push(`media.references[${index}].bucket is invalid.`)
      if (reference.storagePath !== undefined && (typeof reference.storagePath !== 'string' || !validString(reference.storagePath, 1024) || reference.storagePath.startsWith('/') || reference.storagePath.includes('..'))) errors.push(`media.references[${index}].storagePath is invalid.`)
      for (const field of ['width', 'height']) if (reference[field] !== undefined && (typeof reference[field] !== 'number' || !Number.isFinite(reference[field]) || reference[field] < 0 || reference[field] > 100000)) errors.push(`media.references[${index}].${field} is invalid.`)
    }
    const assignmentEntityIds = new Set<string>()
    for (const [index, assignment] of (normalized.media.assignments as unknown[]).entries()) {
      if (!isRecord(assignment) || typeof assignment.entityId !== 'string' || !ENTITY_ID_PATTERN.test(assignment.entityId) || !validString(assignment.role, 128) || typeof assignment.assetId !== 'string' || !ENTITY_ID_PATTERN.test(assignment.assetId) || (assignment.objectPosition !== undefined && !validString(assignment.objectPosition, 128))) errors.push(`media.assignments[${index}] is invalid.`)
      else if (assignmentEntityIds.has(assignment.entityId)) errors.push(`media.assignments[${index}].entityId is not unique.`)
      else {
        assignmentEntityIds.add(assignment.entityId)
        if (!referenceAssetIds.has(assignment.assetId)) errors.push(`media.assignments[${index}] references a missing media asset.`)
      }
    }
    for (const [key, settings] of Object.entries(normalized.media.styles as Record<string, unknown>)) {
      if (!isRecord(settings)) { errors.push(`media.styles.${key} is invalid.`); continue }
      for (const field of ['hoverEnabled', 'outlineEnabled']) if (settings[field] !== undefined && typeof settings[field] !== 'boolean') errors.push(`media.styles.${key}.${field} is invalid.`)
      if (settings.outlineWidth !== undefined && (typeof settings.outlineWidth !== 'number' || !Number.isFinite(settings.outlineWidth) || settings.outlineWidth < 0 || settings.outlineWidth > 64)) errors.push(`media.styles.${key}.outlineWidth is invalid.`)
      if (settings.aspectRatioLocked !== undefined && typeof settings.aspectRatioLocked !== 'boolean') errors.push(`media.styles.${key}.aspectRatioLocked is invalid.`)
      if (settings.aspectRatio !== undefined && (typeof settings.aspectRatio !== 'number' || !Number.isFinite(settings.aspectRatio) || settings.aspectRatio <= 0 || settings.aspectRatio > 1000)) errors.push(`media.styles.${key}.aspectRatio is invalid.`)
      if (settings.objectFit !== undefined && !['scale-down', 'cover', 'contain'].includes(String(settings.objectFit))) errors.push(`media.styles.${key}.objectFit is invalid.`)
    }
    if (Array.isArray(normalized.instances)) {
      const assignments = new Map((normalized.media.assignments as unknown[]).flatMap((assignment) => isRecord(assignment) && typeof assignment.entityId === 'string' ? [[assignment.entityId, assignment]] : []))
      const references = referenceAssetIds
      const knownSections = new Set(Array.isArray(normalized.entities)
        ? normalized.entities.flatMap((entity) => isRecord(entity) && typeof entity.section === 'string' ? [normalizeEditorSectionId(entity.section)] : [])
        : [])
      const sectionOrders = new Map<string, Set<number>>()
      normalized.instances.forEach((instance, index) => {
        if (!isRecord(instance) || typeof instance.instanceId !== 'string' || instance.type !== 'image') return
        const sectionId = typeof instance.sectionId === 'string' ? normalizeEditorSectionId(instance.sectionId) : ''
        if (!knownSections.has(sectionId)) errors.push(`instances[${index}] references unknown section ${sectionId}.`)
        const orders = sectionOrders.get(sectionId) ?? new Set<number>()
        if (typeof instance.order === 'number' && orders.has(instance.order)) errors.push(`instances[${index}].order is not unique within ${sectionId}.`)
        if (typeof instance.order === 'number') orders.add(instance.order)
        sectionOrders.set(sectionId, orders)
        const assignment = assignments.get(instance.instanceId)
        if (!assignment) errors.push(`instances[${index}] has no media assignment.`)
        else if (typeof assignment.assetId !== 'string' || !references.has(assignment.assetId)) errors.push(`instances[${index}] references a missing media asset.`)
        const layout = isRecord(normalized.layout) ? normalized.layout[instance.instanceId] : undefined
        if (!isRecord(layout)
          || layout.positionMode !== 'absolute'
          || !validCssLength(layout.width, true)
          || !validCssLength(layout.height, true)) errors.push(`instances[${index}] requires absolute layout with valid width and height.`)
      })
    }
  }
  for (const [key, settings] of Object.entries(normalized.backgrounds ?? {})) {
    if (!isRecord(settings)) { errors.push(`backgrounds.${key} is invalid.`); continue }
    if (settings.color !== undefined && (typeof settings.color !== 'string' || !COLOR_PATTERN.test(settings.color))) errors.push(`backgrounds.${key}.color is invalid.`)
    if (settings.opacity !== undefined && (typeof settings.opacity !== 'number' || !Number.isFinite(settings.opacity) || settings.opacity < 0 || settings.opacity > 1)) errors.push(`backgrounds.${key}.opacity is invalid.`)
    if (settings.gradient !== undefined && !validString(settings.gradient, 512)) errors.push(`backgrounds.${key}.gradient is invalid.`)
    for (const field of ['boxShadow', 'border']) if (settings[field] !== undefined && !validString(settings[field], 256, true)) errors.push(`backgrounds.${key}.${field} is invalid.`)
    if (settings.borderRadius !== undefined && !(typeof settings.borderRadius === 'string' && validCssLength(settings.borderRadius))) errors.push(`backgrounds.${key}.borderRadius is invalid.`)
    if (settings.blur !== undefined && (typeof settings.blur !== 'number' || !Number.isFinite(settings.blur) || settings.blur < 0 || settings.blur > 100)) errors.push(`backgrounds.${key}.blur is invalid.`)
    if (settings.blendMode !== undefined && !['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity'].includes(String(settings.blendMode))) errors.push(`backgrounds.${key}.blendMode is invalid.`)
  }
  for (const [key, settings] of Object.entries(normalized.buttons ?? {})) {
    if (!isRecord(settings)) { errors.push(`buttons.${key} is invalid.`); continue }
    for (const field of ['text', 'variant', 'borderRadius']) if (settings[field] !== undefined && !validString(settings[field], 256, field === 'borderRadius')) errors.push(`buttons.${key}.${field} is invalid.`)
    if (settings.href !== undefined && (typeof settings.href !== 'string' || settings.href.length > 2048 || !/^(?:#|\/|https?:|mailto:|tel:)/i.test(settings.href))) errors.push(`buttons.${key}.href is invalid.`)
    for (const field of ['backgroundColor', 'textColor', 'borderColor']) if (settings[field] !== undefined && (typeof settings[field] !== 'string' || !COLOR_PATTERN.test(settings[field]))) errors.push(`buttons.${key}.${field} is invalid.`)
  }
  for (const [key, settings] of Object.entries(normalized.animations ?? {})) {
    if (!isRecord(settings)) { errors.push(`animations.${key} is invalid.`); continue }
    for (const field of ['durationMs', 'delayMs']) if (settings[field] !== undefined && (typeof settings[field] !== 'number' || !Number.isFinite(settings[field]) || settings[field] < 0 || settings[field] > 3600000)) errors.push(`animations.${key}.${field} is invalid.`)
    if (settings.enabled !== undefined && typeof settings.enabled !== 'boolean') errors.push(`animations.${key}.enabled is invalid.`)
    if (settings.name !== undefined && !validString(settings.name, 128)) errors.push(`animations.${key}.name is invalid.`)
    else {
      const animationNameError = validateEncodedAnimationName(settings.name as string | undefined)
      if (animationNameError) errors.push(`animations.${key}.name is invalid: ${animationNameError}`)
    }
    if (settings.easing !== undefined && (typeof settings.easing !== 'string' || !/^(?:linear|ease|ease-in|ease-out|ease-in-out|cubic-bezier\([^)]{1,80}\)|steps\([^)]{1,80}\))$/.test(settings.easing))) errors.push(`animations.${key}.easing is invalid.`)
  }
  if (!errors.length) {
    for (const propertyError of validateRegisteredProperties(normalized as unknown as EditorSnapshot)) {
      errors.push(`${propertyError.propertyPath}: ${propertyError.message}`)
    }
  }
  if (!errors.length && isRecord(normalized.compatibility)) {
    normalized.compatibility = {
      schemaVersion: EDITOR_SNAPSHOT_SCHEMA_VERSION,
      minimumReaderVersion: EDITOR_SNAPSHOT_MINIMUM_SUPPORTED_VERSION,
      maximumWriterVersion: EDITOR_SNAPSHOT_READER_VERSION
    }
  }
  return errors.length ? { valid: false, errors } : { valid: true, errors: [], value: clone(normalized as unknown as EditorSnapshot) }
}

/** Backfills ContactDetail entities & defaults into older snapshots non-destructively. */
function normalizeContactDetailSnapshot(normalized: Record<string, unknown>): void {
  if (!isRecord(normalized.content) || !isRecord(normalized.content.contact)) return
  const contact = normalized.content.contact
  const fallback: DefaultContactDetail = clone(defaultContact.detail)

  if (!isRecord(contact.detail)) {
    contact.detail = fallback
  } else {
    const raw = contact.detail
    const mergeTextNode = <T extends { id: string; text: string }>(candidate: unknown, def: T): T => {
      if (!isRecord(candidate)) return clone(def)
      return {
        id: typeof candidate.id === 'string' && candidate.id.trim() ? candidate.id : def.id,
        text: typeof candidate.text === 'string' ? candidate.text : def.text
      } as T
    }
    const mergeLinkNode = <T extends { id: string; label: string; href: string }>(candidate: unknown, def: T): T => {
      if (!isRecord(candidate)) return clone(def)
      return {
        id: typeof candidate.id === 'string' && candidate.id.trim() ? candidate.id : def.id,
        label: typeof candidate.label === 'string' && candidate.label.trim() ? candidate.label : def.label,
        href: typeof candidate.href === 'string' ? candidate.href : def.href
      } as T
    }
    const rawSocial = isRecord(raw.socialLinks) ? raw.socialLinks : {}
    const rawMessage = isRecord(raw.message) ? raw.message : {}
    contact.detail = {
      sectionId: typeof raw.sectionId === 'string' && raw.sectionId ? raw.sectionId : fallback.sectionId,
      messageSectionId: typeof raw.messageSectionId === 'string' && raw.messageSectionId ? raw.messageSectionId : fallback.messageSectionId,
      welcomeGroupId: typeof raw.welcomeGroupId === 'string' && raw.welcomeGroupId ? raw.welcomeGroupId : fallback.welcomeGroupId,
      messageCardId: typeof raw.messageCardId === 'string' && raw.messageCardId ? raw.messageCardId : fallback.messageCardId,
      messageFieldsId: typeof raw.messageFieldsId === 'string' && raw.messageFieldsId ? raw.messageFieldsId : fallback.messageFieldsId,
      mainPhotoId: typeof raw.mainPhotoId === 'string' && raw.mainPhotoId ? raw.mainPhotoId : fallback.mainPhotoId,
      messagePhotoId: typeof raw.messagePhotoId === 'string' && raw.messagePhotoId ? raw.messagePhotoId : fallback.messagePhotoId,
      title: mergeTextNode(raw.title, fallback.title),
      subtitle: mergeTextNode(raw.subtitle, fallback.subtitle),
      description: mergeTextNode(raw.description, fallback.description),
      socialLinks: {
        whatsapp: mergeLinkNode(rawSocial.whatsapp, fallback.socialLinks.whatsapp),
        linkedin: mergeLinkNode(rawSocial.linkedin, fallback.socialLinks.linkedin),
        cv: mergeLinkNode(rawSocial.cv, fallback.socialLinks.cv)
      },
      message: {
        title: mergeTextNode(rawMessage.title, fallback.message.title),
        submitButton: mergeTextNode(rawMessage.submitButton, fallback.message.submitButton)
      }
    }
  }

  // Backfill entities array with any missing ContactDetail entity references
  const contactDetailEntityIds = [
    'contact-detail-section', 'contact-detail-photo-main', 'contact-detail-welcome-group',
    'contact-detail-title', 'contact-detail-subtitle', 'contact-detail-description',
    'contact-detail-wa', 'contact-detail-linkedin', 'contact-detail-cv',
    'contact-message-section', 'contact-detail-message-card', 'contact-detail-message-title',
    'contact-detail-message-fields', 'contact-detail-submit-btn', 'contact-detail-photo-message'
  ]
  const entityMeta: Record<string, { section: string; kind: string; label: string }> = {
    'contact-detail-section': { section: 'Contact Detail', kind: 'background', label: 'Contact Detail Section' },
    'contact-detail-photo-main': { section: 'Contact Detail', kind: 'media', label: 'Main Photo' },
    'contact-detail-welcome-group': { section: 'Contact Detail', kind: 'container', label: 'Welcome Group' },
    'contact-detail-title': { section: 'Contact Detail', kind: 'text', label: 'Name' },
    'contact-detail-subtitle': { section: 'Contact Detail', kind: 'text', label: 'Role' },
    'contact-detail-description': { section: 'Contact Detail', kind: 'text', label: 'Description' },
    'contact-detail-wa': { section: 'Contact Detail', kind: 'button', label: 'WhatsApp' },
    'contact-detail-linkedin': { section: 'Contact Detail', kind: 'button', label: 'LinkedIn' },
    'contact-detail-cv': { section: 'Contact Detail', kind: 'button', label: 'CV' },
    'contact-message-section': { section: 'Text Me', kind: 'background', label: 'Text Me Section' },
    'contact-detail-message-card': { section: 'Text Me', kind: 'container', label: 'Message Card' },
    'contact-detail-message-title': { section: 'Text Me', kind: 'text', label: 'Text Me Title' },
    'contact-detail-message-fields': { section: 'Text Me', kind: 'container', label: 'Message Fields' },
    'contact-detail-submit-btn': { section: 'Text Me', kind: 'button', label: 'Submit Button' },
    'contact-detail-photo-message': { section: 'Text Me', kind: 'media', label: 'Message Photo' }
  }
  if (Array.isArray(normalized.entities)) {
    const existingIds = new Set(
      normalized.entities
        .filter((e): e is Record<string, unknown> => Boolean(e) && typeof e === 'object')
        .map((e) => e.entityId as string)
    )
    for (const id of contactDetailEntityIds) {
      if (!existingIds.has(id)) {
        const meta = entityMeta[id]!
        normalized.entities.push({ entityId: id, section: meta.section, kind: meta.kind, label: meta.label })
      }
    }
  }

  // Backfill default typography (non-destructive — only set keys that are missing)
  if (isRecord(normalized.typography)) {
    const typo = normalized.typography as Record<string, unknown>
    const setTypoDefault = (id: string, defaults: Record<string, unknown>) => {
      if (!isRecord(typo[id])) typo[id] = {}
      const target = typo[id] as Record<string, unknown>
      for (const [k, v] of Object.entries(defaults)) if (target[k] === undefined) target[k] = v
    }
    setTypoDefault('contact-detail-title', { fontFamily: "'Impact', 'Arial Black', 'Franklin Gothic Heavy', sans-serif", color: '#ffffff', fontWeight: 400, fontStyle: 'normal' })
    setTypoDefault('contact-detail-subtitle', { fontFamily: "'Inter', system-ui, sans-serif", color: '#E8DED0', fontWeight: 500, fontStyle: 'normal' })
    setTypoDefault('contact-detail-description', { fontFamily: "'Inter', system-ui, sans-serif", color: '#F5EAE6', fontWeight: 400, fontStyle: 'normal' })
    setTypoDefault('contact-detail-message-title', { fontFamily: "'Impact', 'Arial Black', 'Franklin Gothic Heavy', sans-serif", color: '#7B2329', fontWeight: 400, fontStyle: 'normal' })
    setTypoDefault('contact-detail-submit-btn', { fontFamily: "'Inter', system-ui, sans-serif", color: '#ffffff', fontWeight: 700, fontStyle: 'normal' })
  }

  // Backfill default backgrounds (non-destructive)
  if (isRecord(normalized.backgrounds)) {
    const bg = normalized.backgrounds as Record<string, unknown>
    const setBgDefault = (id: string, color: string) => {
      if (!isRecord(bg[id])) bg[id] = {}
      const target = bg[id] as Record<string, unknown>
      if (target.color === undefined) target.color = color
      if (target.boxShadow === undefined) target.boxShadow = 'none'
    }
    setBgDefault('contact-detail-section', '#7B2329')
    setBgDefault('contact-message-section', '#F6F4E8')
    setBgDefault('contact-detail-message-card', '#ffffff')
    setBgDefault('contact-detail-message-fields', '#FAF9F5')
  }

  // Backfill default buttons (non-destructive)
  if (isRecord(normalized.buttons)) {
    const btns = normalized.buttons as Record<string, unknown>
    if (!isRecord(btns['contact-detail-submit-btn'])) btns['contact-detail-submit-btn'] = {}
    const btn = btns['contact-detail-submit-btn'] as Record<string, unknown>
    if (btn.backgroundColor === undefined) btn.backgroundColor = '#7B2329'
  }

  // Ensure layout & animations entries exist (empty defaults)
  for (const domainKey of ['layout', 'animations'] as const) {
    if (!isRecord(normalized[domainKey])) continue
    const domain = normalized[domainKey] as Record<string, unknown>
    for (const id of contactDetailEntityIds) {
      if (!isRecord(domain[id])) {
        domain[id] = domainKey === 'animations' ? { name: 'none' } : {}
      }
    }
  }
}

export function serializeEditorSnapshot(snapshot: EditorSnapshot): string {
  const result = validateEditorSnapshot(snapshot)
  if (!result.valid || !result.value) throw new Error(`Cannot serialize invalid EditorSnapshot: ${result.errors.join(' ')}`)
  return JSON.stringify(result.value)
}

export function deserializeEditorSnapshot(serialized: string): EditorSnapshot {
  let parsed: unknown
  try { parsed = JSON.parse(serialized) } catch { throw new Error('EditorSnapshot JSON is invalid.') }
  const result = validateEditorSnapshot(parsed)
  if (!result.valid || !result.value) throw new Error(`Invalid EditorSnapshot: ${result.errors.join(' ')}`)
  return result.value
}

/**
 * The one canonical EditorSnapshot -> section-runtime adapter. Both preview
 * hydration and the Published Guest Runtime use the same domain mapping so
 * snapshot logic is not duplicated in repositories or Vue components.
 */
export function editorSnapshotToSiteSnapshot(snapshot: EditorSnapshot): SiteSnapshot {
  const validation = validateEditorSnapshot(snapshot)
  if (!validation.valid || !validation.value) throw new Error(`Cannot hydrate invalid EditorSnapshot: ${validation.errors.join(' ')}`)
  const source = validation.value
  const defaults = createDefaultSiteSnapshot()
  const assetsById = new Map(source.media.references.map((reference) => [reference.assetId, reference]))
  const assignmentsByEntity = new Map(source.media.assignments.map((assignment) => [assignment.entityId, assignment]))
  const defaultUsages = new Map(defaults.mediaUsages.map((usage) => [usage.id, usage]))
  const usageIds = new Set([
    source.content.profile.mediaUsageId,
    source.content.contact.personMediaUsageId,
    ...defaults.mediaUsages.map((usage) => usage.id)
  ])

  const mediaUsages = source.media.assignments.flatMap<MediaUsage>((assignment) => {
    if (!usageIds.has(assignment.entityId)) return []
    const fallback = defaultUsages.get(assignment.entityId)
    const ownerType: MediaUsage['ownerType'] = fallback?.ownerType
      ?? (assignment.entityId === source.content.profile.mediaUsageId ? 'profile' : assignment.entityId === source.content.contact.personMediaUsageId ? 'contact' : 'about')
    const ownerId = fallback?.ownerId
      ?? (ownerType === 'profile' ? source.content.profile.id : ownerType === 'contact' ? source.content.contact.id : source.content.about.id)
    return [{
      id: assignment.entityId,
      ownerType,
      ownerId,
      role: assignment.role,
      mediaAssetId: assignment.assetId,
      objectPosition: assignment.objectPosition ?? fallback?.objectPosition ?? '50% 50%'
    }]
  })

  const photoArea = (area: Omit<PhotoAreaEntity, 'source' | 'objectPosition'> & { objectPosition: string }): PhotoAreaEntity => {
    const assignment = assignmentsByEntity.get(area.id)
    const reference = assignment ? assetsById.get(assignment.assetId) : undefined
    return {
      ...area,
      source: reference?.uri ?? '',
      objectPosition: assignment?.objectPosition ?? area.objectPosition
    }
  }

  const photoAreas: PhotoAreaEntity[] = [
    photoArea({ id: 'about-frame-back-2', ownerType: 'about', ownerId: source.content.about.id, role: 'frame-back', section: 'About', label: 'Back 2', objectPosition: source.visual.about.frameBack2Image.objectPosition, persistence: 'runtime' }),
    photoArea({ id: 'about-frame-main', ownerType: 'about', ownerId: source.content.about.id, role: 'frame-main', section: 'About', label: 'Main', objectPosition: source.visual.about.frameMainImage.objectPosition, persistence: 'runtime' }),
    ...source.content.college.items.flatMap((item) => [
      photoArea({ id: item.frameIds.back, ownerType: 'college-entry', ownerId: item.id, role: 'frame-back', section: 'College', label: `${item.school} back`, objectPosition: source.visual.college.frameBackImage.objectPosition, persistence: 'runtime' }),
      photoArea({ id: item.frameIds.front, ownerType: 'college-entry', ownerId: item.id, role: 'frame-front', section: 'College', label: `${item.school} front`, objectPosition: source.visual.college.frameFrontImage.objectPosition, persistence: 'runtime' })
    ]),
    ...source.content.shs.items.flatMap((item) => [
      photoArea({ id: item.frameIds.back, ownerType: 'shs-entry', ownerId: item.id, role: 'frame-back', section: 'SHS', label: `${item.school} back`, objectPosition: source.visual.shs.frameBackImage.objectPosition, persistence: 'runtime' }),
      photoArea({ id: item.frameIds.front, ownerType: 'shs-entry', ownerId: item.id, role: 'frame-front', section: 'SHS', label: `${item.school} front`, objectPosition: source.visual.shs.frameFrontImage.objectPosition, persistence: 'runtime' })
    ]),
    ...source.content.experience.items.map((item) => photoArea({
      id: item.frameId,
      ownerType: 'experience-entry',
      ownerId: item.id,
      role: 'frame',
      section: 'Experience',
      label: item.title,
      objectPosition: source.visual.experience.imageFrames[item.frameId]?.image.objectPosition ?? '50% 50%',
      persistence: 'runtime'
    }))
  ]

  return {
    content: clone(source.content),
    visual: clone(source.visual),
    behavior: clone(source.behavior),
    mediaAssets: source.media.references.map((reference) => ({
      id: reference.assetId,
      source: reference.uri,
      alt: reference.alt ?? reference.assetId,
      mimeType: reference.mimeType ?? ''
    })),
    mediaUsages,
    photoAreas
  }
}

export function editorSnapshotToCertificateCards(snapshot: EditorSnapshot): CertificateCard[] {
  const references = new Map(snapshot.media.references.map((reference) => [reference.assetId, reference]))
  const assignments = new Map(snapshot.media.assignments.map((assignment) => [assignment.entityId, assignment]))
  const applyMedia = <T extends CertificateCard['thumbnail']>(area: T): T => {
    const assignment = assignments.get(area.id)
    const reference = assignment ? references.get(assignment.assetId) : undefined
    return {
      ...clone(area),
      source: reference?.uri ?? area.source,
      image: { ...clone(area.image), objectPosition: assignment?.objectPosition ?? area.image.objectPosition }
    }
  }
  return snapshot.certificateCards.map((card) => ({
    ...clone(card),
    thumbnail: applyMedia(card.thumbnail),
    detailImages: card.detailImages.map(applyMedia)
  }))
}
