import type {
  EditorObject,
  EditorObjectUxMetadata,
  EditorObjectType,
  EditorObjectTypeRegistration,
  EditorValue
} from '../types/editor'
import type { SnapshotEntityReference } from '../types/editorSnapshot'

export interface EditorObjectCandidate {
  id: string
  section: string
  label: string
  kind: string
  capabilities?: string[]
  propertyValues?: Record<string, EditorValue>
  objectType?: EditorObjectType
  layerId?: string
  parentLayerId?: string
  isMedia?: boolean
  ux?: EditorObjectUxMetadata
}

const registrations = new Map<EditorObjectType, EditorObjectTypeRegistration>()

/** Centralized UX policy for all 15 ContactDetail & Text Me entities. */
export const contactDetailUxPolicies: Record<string, EditorObjectUxMetadata> = {
  'contact-detail-section': {
    excludedCapabilities: ['position', 'rotate', 'media-insert', 'layout', 'effects', 'animation', 'hover-animation', 'click-animation', 'scroll-animation', 'text-animation', 'timeline-animation'],
    visibleProperties: ['runtime.backgroundColor'],
    disableDelete: true
  },
  'contact-detail-photo-main': {
    excludedCapabilities: ['media-insert', 'media-dimensions', 'media-hover', 'media-outline', 'layout', 'rotate', 'animation', 'hover-animation', 'click-animation', 'scroll-animation', 'timeline-animation'],
    excludedProperties: ['media.duplicateReference'],
    disableDelete: true
  },
  'contact-detail-welcome-group': {
    excludedCapabilities: ['container', 'background', 'media-insert', 'layout', 'effects', 'rotate', 'animation', 'hover-animation', 'click-animation', 'scroll-animation', 'timeline-animation'],
    excludedProperties: ['position.width', 'position.height'],
    disableDelete: true
  },
  'contact-detail-title': {
    excludedCapabilities: ['position', 'rotate', 'media-insert', 'font-hover', 'layout', 'effects', 'animation', 'hover-animation', 'click-animation', 'scroll-animation', 'text-animation', 'timeline-animation'],
    dragGroupEntityId: 'contact-detail-welcome-group',
    disableDelete: true
  },
  'contact-detail-subtitle': {
    excludedCapabilities: ['position', 'rotate', 'media-insert', 'font-hover', 'layout', 'effects', 'animation', 'hover-animation', 'click-animation', 'scroll-animation', 'text-animation', 'timeline-animation'],
    dragGroupEntityId: 'contact-detail-welcome-group',
    disableDelete: true
  },
  'contact-detail-description': {
    excludedCapabilities: ['position', 'rotate', 'media-insert', 'font-hover', 'layout', 'effects', 'animation', 'hover-animation', 'click-animation', 'scroll-animation', 'text-animation', 'timeline-animation'],
    dragGroupEntityId: 'contact-detail-welcome-group',
    disableDelete: true
  },
  'contact-detail-wa': {
    excludedCapabilities: ['position', 'rotate', 'media-insert', 'typography', 'font-hover', 'button', 'button-background', 'button-border', 'button-radius', 'layout', 'effects', 'animation', 'hover-animation', 'click-animation', 'scroll-animation', 'text-animation', 'timeline-animation'],
    dragGroupEntityId: 'contact-detail-welcome-group',
    disableDelete: true
  },
  'contact-detail-linkedin': {
    excludedCapabilities: ['position', 'rotate', 'media-insert', 'typography', 'font-hover', 'button', 'button-background', 'button-border', 'button-radius', 'layout', 'effects', 'animation', 'hover-animation', 'click-animation', 'scroll-animation', 'text-animation', 'timeline-animation'],
    dragGroupEntityId: 'contact-detail-welcome-group',
    disableDelete: true
  },
  'contact-detail-cv': {
    excludedCapabilities: ['position', 'rotate', 'media-insert', 'typography', 'font-hover', 'button', 'button-background', 'button-border', 'button-radius', 'layout', 'effects', 'animation', 'hover-animation', 'click-animation', 'scroll-animation', 'text-animation', 'timeline-animation'],
    dragGroupEntityId: 'contact-detail-welcome-group',
    disableDelete: true
  },
  'contact-message-section': {
    excludedCapabilities: ['position', 'rotate', 'media-insert', 'layout', 'effects', 'animation', 'hover-animation', 'click-animation', 'scroll-animation', 'text-animation', 'timeline-animation'],
    visibleProperties: ['runtime.backgroundColor'],
    disableDelete: true
  },
  'contact-detail-message-card': {
    excludedCapabilities: ['container', 'position', 'rotate', 'media-insert', 'layout', 'effects', 'animation', 'hover-animation', 'click-animation', 'scroll-animation', 'timeline-animation'],
    visibleProperties: ['runtime.backgroundColor'],
    disableDelete: true
  },
  'contact-detail-message-title': {
    excludedCapabilities: ['content', 'position', 'rotate', 'media-insert', 'font-hover', 'layout', 'effects', 'animation', 'hover-animation', 'click-animation', 'scroll-animation', 'text-animation', 'timeline-animation'],
    excludedProperties: ['font.size'],
    disableDelete: true
  },
  'contact-detail-message-fields': {
    excludedCapabilities: ['container', 'position', 'rotate', 'media-insert', 'layout', 'effects', 'animation', 'hover-animation', 'click-animation', 'scroll-animation', 'timeline-animation'],
    visibleProperties: ['runtime.backgroundColor'],
    disableDelete: true
  },
  'contact-detail-submit-btn': {
    excludedCapabilities: ['content', 'position', 'rotate', 'media-insert', 'font-hover', 'button', 'button-border', 'button-radius', 'layout', 'effects', 'animation', 'hover-animation', 'click-animation', 'scroll-animation', 'text-animation', 'timeline-animation'],
    excludedProperties: ['font.size', 'runtime.buttonTextColor', 'runtime.buttonBorderColor', 'runtime.buttonRadius'],
    disableDelete: true
  },
  'contact-detail-photo-message': {
    excludedCapabilities: ['position', 'rotate', 'media-insert', 'media-dimensions', 'media-hover', 'media-outline', 'layout', 'effects', 'animation', 'hover-animation', 'click-animation', 'scroll-animation', 'timeline-animation'],
    excludedProperties: ['media.duplicateReference'],
    disableDelete: true
  }
}

const builtInRegistrations: EditorObjectTypeRegistration[] = [
  {
    type: 'Text',
    label: 'Text',
    capabilities: ['content', 'typography', 'font-hover', 'media-insert', 'layout', 'position', 'rotate', 'effects', 'animation', 'hover-animation', 'click-animation', 'scroll-animation', 'text-animation', 'timeline-animation', 'advanced'],
    compatibleStyleCapabilities: ['typography', 'layout', 'position', 'rotate', 'effects', 'animation', 'hover-animation', 'click-animation', 'scroll-animation', 'text-animation', 'timeline-animation']
  },
  {
    type: 'Image',
    label: 'Image',
    capabilities: ['media', 'media-insert', 'media-dimensions', 'media-hover', 'media-outline', 'layout', 'position', 'rotate', 'effects', 'animation', 'hover-animation', 'click-animation', 'scroll-animation', 'timeline-animation', 'advanced'],
    compatibleStyleCapabilities: ['media-dimensions', 'media-hover', 'media-outline', 'layout', 'position', 'rotate', 'effects', 'animation', 'hover-animation', 'click-animation', 'scroll-animation', 'timeline-animation']
  },
  {
    type: 'Button',
    label: 'Button',
    capabilities: ['content', 'typography', 'font-hover', 'media-insert', 'button', 'button-background', 'button-border', 'button-radius', 'layout', 'position', 'rotate', 'effects', 'animation', 'hover-animation', 'click-animation', 'scroll-animation', 'text-animation', 'timeline-animation', 'advanced'],
    compatibleStyleCapabilities: ['typography', 'font-hover', 'button', 'layout', 'position', 'rotate', 'effects', 'animation', 'hover-animation', 'click-animation', 'scroll-animation', 'text-animation', 'timeline-animation']
  },
  {
    type: 'Container',
    label: 'Container',
    capabilities: ['container', 'background', 'media-insert', 'layout', 'position', 'rotate', 'effects', 'animation', 'hover-animation', 'click-animation', 'scroll-animation', 'timeline-animation', 'advanced'],
    compatibleStyleCapabilities: ['background', 'layout', 'position', 'rotate', 'effects', 'animation', 'hover-animation', 'click-animation', 'scroll-animation', 'timeline-animation']
  },
  {
    type: 'Background',
    label: 'Background',
    capabilities: ['background', 'media-insert', 'layout', 'effects', 'animation', 'hover-animation', 'click-animation', 'scroll-animation', 'timeline-animation', 'advanced'],
    compatibleStyleCapabilities: ['background', 'layout', 'effects', 'animation', 'hover-animation', 'click-animation', 'scroll-animation', 'timeline-animation']
  },
  {
    type: 'Divider',
    label: 'Divider',
    capabilities: ['divider', 'background', 'media-insert', 'layout', 'position', 'rotate', 'effects', 'animation', 'hover-animation', 'click-animation', 'scroll-animation', 'timeline-animation', 'advanced'],
    compatibleStyleCapabilities: ['background', 'layout', 'position', 'rotate', 'effects', 'animation', 'hover-animation', 'click-animation', 'scroll-animation', 'timeline-animation']
  },
  {
    type: 'Icon',
    label: 'Icon',
    capabilities: ['icon', 'color', 'media-insert', 'layout', 'position', 'rotate', 'effects', 'animation', 'hover-animation', 'click-animation', 'scroll-animation', 'timeline-animation', 'advanced'],
    compatibleStyleCapabilities: ['color', 'layout', 'position', 'rotate', 'effects', 'animation', 'hover-animation', 'click-animation', 'scroll-animation', 'timeline-animation']
  }
]

for (const registration of builtInRegistrations) registrations.set(registration.type, registration)

const objectTypeByRuntimeKind: Record<string, EditorObjectType> = {
  text: 'Text',
  content: 'Text',
  navigation: 'Button',
  button: 'Button',
  media: 'Image',
  image: 'Image',
  frame: 'Container',
  container: 'Container',
  background: 'Background',
  divider: 'Divider',
  icon: 'Icon'
}

const snapshotKindByObjectType: Record<string, SnapshotEntityReference['kind']> = {
  Text: 'text',
  Image: 'media',
  Button: 'button',
  Container: 'container',
  Background: 'background',
  Divider: 'divider',
  Icon: 'icon'
}

export function registerEditorObjectType(registration: EditorObjectTypeRegistration): void {
  if (!registration.type.trim()) throw new Error('Editor Object type is required.')
  if (registrations.has(registration.type)) throw new Error(`Duplicate Editor Object type: ${registration.type}`)
  if (!registration.capabilities.length) throw new Error(`Editor Object type ${registration.type} must declare capabilities.`)
  registrations.set(registration.type, {
    ...registration,
    capabilities: [...new Set(registration.capabilities)],
    compatibleStyleCapabilities: [...new Set(registration.compatibleStyleCapabilities)]
  })
}

export function getEditorObjectType(type: EditorObjectType): EditorObjectTypeRegistration {
  const registration = registrations.get(type)
  if (!registration) throw new Error(`Editor Object type is not registered: ${type}`)
  return registration
}

export function listEditorObjectTypes(): EditorObjectTypeRegistration[] {
  return [...registrations.values()].map((registration) => ({
    ...registration,
    capabilities: [...registration.capabilities],
    compatibleStyleCapabilities: [...registration.compatibleStyleCapabilities]
  }))
}

export function createEditorObject(candidate: EditorObjectCandidate, order: number): EditorObject {
  const objectType = candidate.objectType
    ?? (candidate.isMedia ? 'Image' : objectTypeByRuntimeKind[candidate.kind] ?? 'Container')
  const typeRegistration = getEditorObjectType(objectType)
  const capabilities = [...new Set([...typeRegistration.capabilities, ...(candidate.capabilities ?? [])])]
  const fixedPolicy = contactDetailUxPolicies[candidate.id]
  const mergedUx: EditorObjectUxMetadata | undefined = fixedPolicy
    ? { ...fixedPolicy, ...(candidate.ux ?? {}) }
    : candidate.ux
  const filteredCapabilities = mergedUx?.excludedCapabilities?.length
    ? capabilities.filter((cap) => !mergedUx.excludedCapabilities!.includes(cap))
    : capabilities
  const parentLayerId = candidate.parentLayerId ?? `section:${candidate.section}`
  const layerId = candidate.layerId ?? `${parentLayerId}/object:${candidate.id}`
  return {
    id: candidate.id,
    entityId: candidate.id,
    name: candidate.label,
    label: candidate.label,
    type: objectType,
    objectType,
    kind: candidate.kind,
    section: candidate.section,
    parentLayerId,
    layerId,
    order,
    capabilities: filteredCapabilities,
    propertyValues: candidate.propertyValues ?? {},
    ux: mergedUx ? structuredClone(mergedUx) : undefined,
    validation: { valid: true, errors: [] }
  }
}

export function toSnapshotEntityReference(object: EditorObject): SnapshotEntityReference {
  return {
    entityId: object.id,
    section: object.section,
    kind: snapshotKindByObjectType[object.type] ?? 'content',
    label: object.name
  }
}
