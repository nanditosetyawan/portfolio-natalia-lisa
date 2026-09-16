import type {
  EditorInstance,
  EditorInstanceType,
  EditorSnapshot,
  SnapshotMediaReference
} from '../types/editorSnapshot'
import { resolveMediaSource } from '../repositories/mediaRepository'

export interface DynamicInstanceRuntimeOptions {
  resolveMediaUrl?: (assetId: string, reference: SnapshotMediaReference) => string
}

interface DynamicInstanceRenderContext {
  root: HTMLElement
  element: HTMLElement
  instance: EditorInstance
  snapshot: EditorSnapshot
  options: DynamicInstanceRuntimeOptions
}

interface DynamicInstanceRenderer {
  type: EditorInstanceType
  tagName: string
  create: (instance: EditorInstance) => HTMLElement
  update: (context: DynamicInstanceRenderContext) => void
}

export interface DynamicInstanceRenderResult {
  created: string[]
  updated: string[]
  removed: string[]
  missingSections: string[]
}

const renderers = new Map<EditorInstanceType, DynamicInstanceRenderer>()
const dynamicLayerAttribute = 'snapshotInstanceLayer'

export function registerDynamicInstanceRenderer(renderer: DynamicInstanceRenderer): void {
  if (renderers.has(renderer.type)) throw new Error(`Dynamic instance renderer already registered: ${renderer.type}`)
  renderers.set(renderer.type, renderer)
}

export function registeredDynamicInstanceTypes(): EditorInstanceType[] {
  return [...renderers.keys()]
}

function sectionRoot(root: HTMLElement, sectionId: string): HTMLElement | null {
  if (root.dataset.editorSectionId === sectionId) return root
  return [...root.querySelectorAll<HTMLElement>('[data-editor-section-id]')]
    .find((element) => element.dataset.editorSectionId === sectionId) ?? null
}

function dynamicLayer(section: HTMLElement, sectionId: string): HTMLElement {
  const existing = [...section.children].find((element): element is HTMLElement =>
    element instanceof HTMLElement && element.dataset[dynamicLayerAttribute] === sectionId
  )
  if (existing) return existing

  const fixedZIndex = [...section.querySelectorAll<HTMLElement>('*')].reduce((highest, element) => {
    const value = Number.parseInt(getComputedStyle(element).zIndex, 10)
    return Number.isFinite(value) ? Math.max(highest, value) : highest
  }, 0)
  const layer = document.createElement('div')
  layer.className = 'snapshot-dynamic-instance-layer'
  layer.dataset[dynamicLayerAttribute] = sectionId
  layer.style.position = 'absolute'
  layer.style.inset = '0'
  layer.style.zIndex = String(fixedZIndex + 1)
  layer.style.pointerEvents = 'none'
  section.append(layer)
  return layer
}

function imageRenderer(): DynamicInstanceRenderer {
  return {
    type: 'image',
    tagName: 'IMG',
    create: (instance) => {
      const image = document.createElement('img')
      image.className = 'snapshot-dynamic-instance snapshot-dynamic-image'
      image.dataset.snapshotInstanceId = instance.instanceId
      image.decoding = 'async'
      image.loading = 'lazy'
      image.draggable = false
      image.style.position = 'absolute'
      image.style.inset = '0 auto auto 0'
      image.style.maxWidth = 'none'
      image.style.maxHeight = 'none'
      image.style.pointerEvents = 'auto'
      image.style.objectFit = 'cover'
      return image
    },
    update: ({ element, instance, snapshot, options }) => {
      if (!(element instanceof HTMLImageElement)) return
      const assignment = snapshot.media.assignments.find((candidate) => candidate.entityId === instance.source.assignmentEntityId)
      const reference = assignment
        ? snapshot.media.references.find((candidate) => candidate.assetId === assignment.assetId)
        : undefined
      const source = assignment && reference
        ? options.resolveMediaUrl?.(assignment.assetId, reference) ?? resolveMediaSource(reference)
        : ''
      if (source && element.getAttribute('src') !== source) {
        element.dataset.mediaLoadState = 'loading'
        element.src = source
      }
      if (!source) element.removeAttribute('src')
      element.alt = reference?.alt?.trim() || instance.label
      element.dataset.mediaUsageId = instance.instanceId
      element.dataset.entityId = instance.instanceId
      if (assignment) element.dataset.mediaAssetId = assignment.assetId
      else delete element.dataset.mediaAssetId
      if (reference?.storagePath) element.dataset.mediaCanonicalPath = reference.storagePath
      else delete element.dataset.mediaCanonicalPath
      element.style.objectPosition = assignment?.objectPosition ?? '50% 50%'
      if (reference?.width) element.width = reference.width
      else element.removeAttribute('width')
      if (reference?.height) element.height = reference.height
      else element.removeAttribute('height')
    }
  }
}

registerDynamicInstanceRenderer(imageRenderer())

/**
 * Reconciles DOM from the canonical instance manifest. The DOM nodes are a
 * runtime projection only; identity and all values remain in EditorSnapshot.
 */
export function renderDynamicInstances(
  root: HTMLElement,
  snapshot: EditorSnapshot,
  options: DynamicInstanceRuntimeOptions = {}
): DynamicInstanceRenderResult {
  const result: DynamicInstanceRenderResult = { created: [], updated: [], removed: [], missingSections: [] }
  const existing = new Map(
    [...root.querySelectorAll<HTMLElement>('[data-snapshot-instance-id]')]
      .flatMap((element) => element.dataset.snapshotInstanceId ? [[element.dataset.snapshotInstanceId, element] as const] : [])
  )
  const retained = new Set<string>()
  const layers = new Map<string, HTMLElement>()
  const ordered = [...(snapshot.instances ?? [])].sort((left, right) => left.sectionId.localeCompare(right.sectionId) || left.order - right.order)

  for (const instance of ordered) {
    const renderer = renderers.get(instance.type)
    if (!renderer) continue
    const targetSection = sectionRoot(root, instance.sectionId)
    if (!targetSection) {
      result.missingSections.push(instance.sectionId)
      continue
    }
    const targetLayer = layers.get(instance.sectionId) ?? dynamicLayer(targetSection, instance.sectionId)
    layers.set(instance.sectionId, targetLayer)
    let element = existing.get(instance.instanceId)
    if (element?.tagName !== renderer.tagName) {
      element?.remove()
      element = undefined
    }
    if (!element) {
      element = renderer.create(instance)
      result.created.push(instance.instanceId)
    } else result.updated.push(instance.instanceId)
    element.dataset.snapshotInstanceId = instance.instanceId
    element.dataset.snapshotInstanceType = instance.type
    element.dataset.snapshotInstanceSection = instance.sectionId
    element.style.zIndex = String(snapshot.layout[instance.instanceId]?.zIndex ?? instance.order + 1)
    renderer.update({ root, element, instance, snapshot, options })
    targetLayer.append(element)
    retained.add(instance.instanceId)
  }

  for (const [instanceId, element] of existing) {
    if (retained.has(instanceId)) continue
    element.remove()
    result.removed.push(instanceId)
  }
  for (const layer of root.querySelectorAll<HTMLElement>('[data-snapshot-instance-layer]')) {
    if (!layer.querySelector('[data-snapshot-instance-id]')) layer.remove()
  }
  return result
}
