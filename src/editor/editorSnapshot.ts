import { createDefaultSiteSnapshot, type SiteSnapshot } from '../data/default/site'
import type { CertificateCard } from '../data/default/certificates'
import type { MediaUsage, PhotoAreaEntity } from '../types/site'
import { validateRegisteredProperties } from './propertyRegistry'
import {
  EDITOR_SNAPSHOT_READER_VERSION,
  EDITOR_SNAPSHOT_SCHEMA_VERSION,
  type EditorSnapshot,
  type SnapshotEntityReference,
  type SnapshotValidationResult
} from '../types/editorSnapshot'

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
    certificateCards: [],
    typography: {},
    layout: {},
    media: {
      references: snapshot.mediaAssets.map((asset) => ({ assetId: asset.id, uri: asset.source, mimeType: asset.mimeType, alt: asset.alt })),
      assignments: snapshot.mediaUsages.map((usage) => ({ entityId: usage.id, role: usage.role, assetId: usage.mediaAssetId, objectPosition: usage.objectPosition })),
      styles: {}
    },
    backgrounds: {},
    buttons: {},
    animations: {},
    session: defaultEditorSession(),
    visual: clone(snapshot.visual),
    behavior: clone(snapshot.behavior)
  }
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

export function validateEditorSnapshot(input: unknown): SnapshotValidationResult {
  const errors: string[] = []
  if (!isRecord(input)) return { valid: false, errors: ['Snapshot must be an object.'] }
  const normalized = clone(input)
  if (!isRecord(normalized.session)) normalized.session = defaultEditorSession()
  else {
    if (!('userZoom' in normalized.session)) normalized.session.userZoom = typeof normalized.session.zoom === 'number' && normalized.session.zoom > 0 ? normalized.session.zoom : null
    if (!isRecord(normalized.session.objectStates)) normalized.session.objectStates = {}
    if (!Array.isArray(normalized.session.expandedLayers)) normalized.session.expandedLayers = []
  }
  const compatibility = normalized.compatibility
  if (!isRecord(compatibility)) errors.push('compatibility is required.')
  else {
    if (compatibility.schemaVersion !== EDITOR_SNAPSHOT_SCHEMA_VERSION) errors.push(`Unsupported schema version: ${String(compatibility.schemaVersion)}.`)
    if (Number(compatibility.minimumReaderVersion) > EDITOR_SNAPSHOT_READER_VERSION) errors.push('Snapshot requires a newer reader.')
    if (Number(compatibility.maximumWriterVersion) < EDITOR_SNAPSHOT_READER_VERSION) errors.push('Snapshot was written by an incompatible writer.')
  }
  if (!isRecord(normalized.revision)) errors.push('revision is required.')
  if (!Array.isArray(normalized.entities)) errors.push('entities must be an array.')
  else normalized.entities.forEach((entity, index) => {
    if (!isRecord(entity) || typeof entity.entityId !== 'string' || !ENTITY_ID_PATTERN.test(entity.entityId) || typeof entity.section !== 'string' || typeof entity.kind !== 'string' || typeof entity.label !== 'string') errors.push(`entities[${index}] is invalid.`)
  })
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
    for (const [index, reference] of (normalized.media.references as unknown[]).entries()) {
      if (!isRecord(reference) || typeof reference.assetId !== 'string' || !ENTITY_ID_PATTERN.test(reference.assetId) || !validString(reference.uri, 2048)) { errors.push(`media.references[${index}] is invalid.`); continue }
      if (reference.bucket !== undefined && !validString(reference.bucket, 128)) errors.push(`media.references[${index}].bucket is invalid.`)
      if (reference.storagePath !== undefined && (typeof reference.storagePath !== 'string' || !validString(reference.storagePath, 1024) || reference.storagePath.startsWith('/') || reference.storagePath.includes('..'))) errors.push(`media.references[${index}].storagePath is invalid.`)
      for (const field of ['width', 'height']) if (reference[field] !== undefined && (typeof reference[field] !== 'number' || !Number.isFinite(reference[field]) || reference[field] < 0 || reference[field] > 100000)) errors.push(`media.references[${index}].${field} is invalid.`)
    }
    for (const [index, assignment] of (normalized.media.assignments as unknown[]).entries()) if (!isRecord(assignment) || typeof assignment.entityId !== 'string' || !ENTITY_ID_PATTERN.test(assignment.entityId) || !validString(assignment.role, 128) || typeof assignment.assetId !== 'string' || !ENTITY_ID_PATTERN.test(assignment.assetId) || (assignment.objectPosition !== undefined && !validString(assignment.objectPosition, 128))) errors.push(`media.assignments[${index}] is invalid.`)
    for (const [key, settings] of Object.entries(normalized.media.styles as Record<string, unknown>)) {
      if (!isRecord(settings)) { errors.push(`media.styles.${key} is invalid.`); continue }
      for (const field of ['hoverEnabled', 'outlineEnabled']) if (settings[field] !== undefined && typeof settings[field] !== 'boolean') errors.push(`media.styles.${key}.${field} is invalid.`)
      if (settings.outlineWidth !== undefined && (typeof settings.outlineWidth !== 'number' || !Number.isFinite(settings.outlineWidth) || settings.outlineWidth < 0 || settings.outlineWidth > 64)) errors.push(`media.styles.${key}.outlineWidth is invalid.`)
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
    if (settings.easing !== undefined && (typeof settings.easing !== 'string' || !/^(?:linear|ease|ease-in|ease-out|ease-in-out|cubic-bezier\([^)]{1,80}\)|steps\([^)]{1,80}\))$/.test(settings.easing))) errors.push(`animations.${key}.easing is invalid.`)
  }
  if (!errors.length) {
    for (const propertyError of validateRegisteredProperties(normalized as unknown as EditorSnapshot)) {
      errors.push(`${propertyError.propertyPath}: ${propertyError.message}`)
    }
  }
  return errors.length ? { valid: false, errors } : { valid: true, errors: [], value: clone(normalized as unknown as EditorSnapshot) }
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
