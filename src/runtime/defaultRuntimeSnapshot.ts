import { cloneCertificateCard, defaultCertificates } from '../data/default/certificates'
import { createDefaultSiteSnapshot } from '../data/default/site'
import { createEditorSnapshot, validateEditorSnapshot } from '../editor/editorSnapshot'
import type { EditorSnapshot, SnapshotEntityReference } from '../types/editorSnapshot'

export const DEFAULT_RUNTIME_TEMPLATE_VERSION = 1 as const

export interface DefaultRuntimeTemplate {
  kind: 'default'
  templateVersion: typeof DEFAULT_RUNTIME_TEMPLATE_VERSION
  snapshot: EditorSnapshot
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value
  Object.freeze(value)
  for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested)
  return value
}

function addEntity(
  entities: Map<string, SnapshotEntityReference>,
  entityId: string,
  section: string,
  kind: SnapshotEntityReference['kind'],
  label: string
): void {
  if (!entityId.trim()) return
  entities.set(entityId, { entityId, section, kind, label })
}

function buildCanonicalDefaultSnapshot(): EditorSnapshot {
  const site = createDefaultSiteSnapshot()
  const snapshot = createEditorSnapshot(site)
  snapshot.certificateCards = defaultCertificates.cards.map(cloneCertificateCard)

  const entities = new Map(snapshot.entities.map((entity) => [entity.entityId, entity]))

  addEntity(entities, site.content.about.cta.id, 'About', 'button', site.content.about.cta.text)
  addEntity(entities, site.content.contact.cta.id, 'Contact', 'button', site.content.contact.cta.text)
  addEntity(entities, 'navigation-brand', 'Navigation', 'text', site.content.navigation.brand)
  for (const item of site.content.navigation.navItems) {
    addEntity(entities, item.id, 'Navigation', 'button', item.label)
  }
  for (const usage of site.mediaUsages) {
    addEntity(entities, usage.id, usage.ownerType === 'profile' ? 'Portfolio' : usage.ownerType === 'about' ? 'About' : 'Contact', 'media', usage.role)
  }
  for (const area of site.photoAreas) {
    addEntity(entities, area.id, area.section, 'media', area.label)
  }
  for (const card of snapshot.certificateCards) {
    addEntity(entities, card.id, 'Certificate', 'content', card.title)
    addEntity(entities, card.thumbnail.id, 'Certificate', 'media', card.thumbnail.placeholder.label)
    for (const image of card.detailImages) {
      addEntity(entities, image.id, 'Certificate', 'media', image.placeholder.label)
    }
  }
  addEntity(entities, 'certificate-behavior', 'Certificate', 'content', 'Slideshow behavior')
  snapshot.entities = [...entities.values()]

  const validation = validateEditorSnapshot(snapshot)
  if (!validation.valid || !validation.value) {
    throw new Error(`Built-in Default Runtime Snapshot is invalid: ${validation.errors.join(' ')}`)
  }
  return validation.value
}

const canonicalDefaultRuntimeTemplate = deepFreeze<DefaultRuntimeTemplate>({
  kind: 'default',
  templateVersion: DEFAULT_RUNTIME_TEMPLATE_VERSION,
  snapshot: buildCanonicalDefaultSnapshot()
})

/**
 * Returns an isolated clone of the immutable portfolio template bundled with
 * the application. The canonical object is never exposed to Pinia or Editor
 * mutation, so Default Runtime cannot become a Draft or Published revision.
 */
export function loadDefaultRuntimeTemplate(): DefaultRuntimeTemplate {
  return structuredClone(canonicalDefaultRuntimeTemplate)
}

export function isCanonicalDefaultRuntimeFrozen(): boolean {
  return Object.isFrozen(canonicalDefaultRuntimeTemplate)
    && Object.isFrozen(canonicalDefaultRuntimeTemplate.snapshot)
    && Object.isFrozen(canonicalDefaultRuntimeTemplate.snapshot.content)
}
