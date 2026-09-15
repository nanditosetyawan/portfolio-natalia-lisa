import type {
  EditorInstance,
  EditorSnapshot,
  SnapshotEntityReference
} from '../types/editorSnapshot'

export const MAX_DYNAMIC_INSTANCES_PER_SECTION = 50
export const MAX_DYNAMIC_INSTANCES_PER_SNAPSHOT = 500

const nonIdentifierCharacters = /[^a-z0-9]+/gi

export function normalizeEditorSectionId(section: string): string {
  return section
    .trim()
    .toLocaleLowerCase()
    .replace(nonIdentifierCharacters, '-')
    .replace(/^-+|-+$/g, '') || 'section'
}

export function editorSectionLabel(snapshot: EditorSnapshot, sectionId: string): string {
  const normalized = normalizeEditorSectionId(sectionId)
  const fixed = snapshot.entities.find((entity) => normalizeEditorSectionId(entity.section) === normalized)
  if (fixed) return fixed.section
  return normalized.split('-').map((part) => part ? `${part[0]?.toLocaleUpperCase()}${part.slice(1)}` : '').join(' ')
}

export function createDynamicImageInstance(
  snapshot: EditorSnapshot,
  section: string,
  label?: string,
  instanceId = `${normalizeEditorSectionId(section)}-image-${crypto.randomUUID()}`,
  createdAt = new Date().toISOString()
): EditorInstance {
  const sectionId = normalizeEditorSectionId(section)
  const sectionInstances = snapshot.instances.filter((instance) => instance.sectionId === sectionId)
  return {
    instanceId,
    type: 'image',
    sectionId,
    label: label?.trim() || `Image ${sectionInstances.length + 2}`,
    order: sectionInstances.reduce((highest, instance) => Math.max(highest, instance.order), -1) + 1,
    source: { kind: 'media-assignment', assignmentEntityId: instanceId },
    createdAt
  }
}

export function editorInstanceEntityReference(instance: EditorInstance, snapshot: EditorSnapshot): SnapshotEntityReference {
  return {
    entityId: instance.instanceId,
    section: editorSectionLabel(snapshot, instance.sectionId),
    kind: 'media',
    label: instance.label
  }
}

export function snapshotObjectReferences(snapshot: EditorSnapshot): SnapshotEntityReference[] {
  const references = new Map(snapshot.entities.map((entity) => [entity.entityId, entity]))
  for (const instance of snapshot.instances ?? []) {
    if (!references.has(instance.instanceId)) references.set(instance.instanceId, editorInstanceEntityReference(instance, snapshot))
  }
  return [...references.values()]
}

export function findSnapshotObjectReference(snapshot: EditorSnapshot, objectId: string): SnapshotEntityReference | undefined {
  const fixed = snapshot.entities.find((entity) => entity.entityId === objectId)
  if (fixed) return fixed
  const instance = (snapshot.instances ?? []).find((candidate) => candidate.instanceId === objectId)
  return instance ? editorInstanceEntityReference(instance, snapshot) : undefined
}

export function findEditorInstance(snapshot: EditorSnapshot, instanceId: string): EditorInstance | undefined {
  return (snapshot.instances ?? []).find((instance) => instance.instanceId === instanceId)
}

export function isDynamicInstance(snapshot: EditorSnapshot, objectId: string): boolean {
  return (snapshot.instances ?? []).some((instance) => instance.instanceId === objectId)
}

export function sectionInstanceCount(snapshot: EditorSnapshot, section: string): number {
  const sectionId = normalizeEditorSectionId(section)
  return snapshot.instances.filter((instance) => instance.type === 'image' && instance.sectionId === sectionId).length
}

export function assertCanInsertEditorInstance(snapshot: EditorSnapshot, section: string): void {
  if (snapshot.instances.length >= MAX_DYNAMIC_INSTANCES_PER_SNAPSHOT) {
    throw new Error(`Maximum ${MAX_DYNAMIC_INSTANCES_PER_SNAPSHOT} additional objects reached for this portfolio.`)
  }
  if (sectionInstanceCount(snapshot, section) >= MAX_DYNAMIC_INSTANCES_PER_SECTION) {
    throw new Error(`Maximum ${MAX_DYNAMIC_INSTANCES_PER_SECTION} images reached in this part of the page.`)
  }
}
