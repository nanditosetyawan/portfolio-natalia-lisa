import type { EditorObjectType } from '../types/editor'
import type { EditorSnapshot, SnapshotEntityReference } from '../types/editorSnapshot'
import { findSnapshotObjectReference } from './editorInstances'

export type ObjectDomTargetKind = EditorObjectType | SnapshotEntityReference['kind'] | string | undefined

const candidateSelector = [
  '[data-editor-object-id]',
  '[data-editor-entity-id]',
  '[data-entity-id]',
  '[data-media-usage-id]',
  '[data-photo-area-id]',
  '[data-certificate-id]',
  '[data-snapshot-instance-id]'
].join(', ')

const leafTags = new Set(['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'SPAN', 'LABEL', 'STRONG', 'EM'])
const containerTags = new Set(['SECTION', 'MAIN', 'ARTICLE', 'DIV', 'FIGURE', 'HEADER', 'FOOTER', 'NAV'])

function normalizedType(kind: ObjectDomTargetKind): EditorObjectType | undefined {
  const value = String(kind ?? '').toLocaleLowerCase()
  if (value === 'text' || value === 'content') return 'Text'
  if (value === 'image' || value === 'media') return 'Image'
  if (value === 'button' || value === 'navigation') return 'Button'
  if (value === 'container' || value === 'frame') return 'Container'
  if (value === 'background') return 'Background'
  if (value === 'divider') return 'Divider'
  if (value === 'icon') return 'Icon'
  return undefined
}

function matchesObjectId(element: HTMLElement, objectId: string): boolean {
  return element.dataset.editorObjectId === objectId
    || element.dataset.editorEntityId === objectId
    || element.dataset.entityId === objectId
    || element.dataset.mediaUsageId === objectId
    || element.dataset.photoAreaId === objectId
    || element.dataset.certificateId === objectId
    || element.dataset.snapshotInstanceId === objectId
}

function candidatesFor(root: HTMLElement, objectId: string): HTMLElement[] {
  const candidates = [...root.querySelectorAll<HTMLElement>(candidateSelector)].filter((element) => matchesObjectId(element, objectId))
  if (root.matches(candidateSelector) && matchesObjectId(root, objectId)) candidates.unshift(root)
  return [...new Set(candidates)]
}

function semanticScore(element: HTMLElement, objectId: string, type: EditorObjectType | undefined): number {
  let score = element.dataset.editorObjectId === objectId ? 1000 : 0
  if (element.dataset.snapshotInstanceId === objectId) score += 900
  if (element.dataset.editorEntityId === objectId) score += 100
  if (element.dataset.entityId === objectId) score += 20
  if (element.dataset.mediaUsageId === objectId) score += type === 'Image' ? 420 : 40
  if (element.dataset.photoAreaId === objectId) score += type === 'Image' ? 400 : type === 'Container' ? 280 : 40
  if (element.dataset.certificateId === objectId) score += type === 'Container' ? 260 : 80

  const tag = element.tagName
  const className = typeof element.className === 'string' ? element.className.toLocaleLowerCase() : ''
  if (type === 'Text') {
    if (leafTags.has(tag)) score += 300
    if (tag === 'A' || tag === 'BUTTON') score += 180
    if (tag === 'SECTION' || tag === 'MAIN') score -= 300
    else if (containerTags.has(tag)) score -= 80
  } else if (type === 'Image') {
    if (tag === 'IMG' || tag === 'VIDEO') score += 340
    else if (tag === 'PICTURE' || tag === 'FIGURE') score += 220
    if (/image|photo|media|frame|portrait|thumbnail/.test(className)) score += 80
    if (tag === 'SECTION' || tag === 'MAIN') score -= 250
  } else if (type === 'Button') {
    if (tag === 'BUTTON' || tag === 'A') score += 340
    if (tag === 'SECTION' || tag === 'MAIN') score -= 250
  } else if (type === 'Icon') {
    if (tag === 'SVG' || tag === 'I') score += 340
    if (/icon/.test(className)) score += 100
  } else if (type === 'Divider') {
    if (tag === 'HR') score += 340
    if (/divider|separator|rule|line/.test(className)) score += 120
  } else if (type === 'Container' || type === 'Background') {
    if (containerTags.has(tag)) score += 260
    if (leafTags.has(tag) || tag === 'IMG' || tag === 'SVG') score -= 220
  }
  return score
}

function preferCandidate(
  left: HTMLElement,
  right: HTMLElement,
  objectId: string,
  type: EditorObjectType | undefined
): HTMLElement {
  const leftScore = semanticScore(left, objectId, type)
  const rightScore = semanticScore(right, objectId, type)
  if (leftScore !== rightScore) return leftScore > rightScore ? left : right

  const container = type === 'Container' || type === 'Background'
  if (left.contains(right)) return container ? left : right
  if (right.contains(left)) return container ? right : left

  const leftRect = left.getBoundingClientRect()
  const rightRect = right.getBoundingClientRect()
  const leftArea = leftRect.width * leftRect.height
  const rightArea = rightRect.width * rightRect.height
  if (leftArea !== rightArea) return container ? (leftArea > rightArea ? left : right) : (leftArea < rightArea ? left : right)
  return left
}

/**
 * Resolves the single DOM owner of one canonical Editor Object.
 *
 * Legacy templates may repeat a content id on a section wrapper and its
 * editable leaf. Object-level properties must never be broadcast to every
 * matching attribute: Text/Image/Button/Icon/Divider own the semantic leaf,
 * while Container/Background own the wrapper itself.
 */
export function resolveObjectDomTarget(
  root: HTMLElement,
  objectId: string,
  kind?: ObjectDomTargetKind
): HTMLElement | null {
  const candidates = candidatesFor(root, objectId)
  if (!candidates.length) return null
  const type = normalizedType(kind)
  return candidates.slice(1).reduce(
    (selected, candidate) => preferCandidate(selected, candidate, objectId, type),
    candidates[0]
  )
}

export function resolveSnapshotObjectDomTarget(
  root: HTMLElement,
  snapshot: EditorSnapshot,
  objectId: string
): HTMLElement | null {
  const entity = findSnapshotObjectReference(snapshot, objectId)
  return resolveObjectDomTarget(root, objectId, entity?.kind)
}
