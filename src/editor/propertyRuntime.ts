import { propertyRegistry, readSnapshotPath, resolvePropertyPath } from './propertyRegistry'
import type { EditorSnapshot } from '../types/editorSnapshot'

const objectDatasetKeys = ['editorObjectId', 'editorEntityId', 'entityId', 'mediaUsageId', 'photoAreaId', 'certificateId'] as const

interface ElementBaseline {
  styles: Map<string, string>
  classes: Map<string, boolean>
}

interface RuntimeScope {
  baselines: WeakMap<HTMLElement, ElementBaseline>
  touched: Set<HTMLElement>
}

const scopes = new WeakMap<HTMLElement, RuntimeScope>()

function scopeFor(root: HTMLElement): RuntimeScope {
  const existing = scopes.get(root)
  if (existing) return existing
  const scope: RuntimeScope = { baselines: new WeakMap(), touched: new Set() }
  scopes.set(root, scope)
  return scope
}

function baselineFor(scope: RuntimeScope, element: HTMLElement): ElementBaseline {
  const existing = scope.baselines.get(element)
  if (existing) return existing
  const baseline: ElementBaseline = { styles: new Map(), classes: new Map() }
  scope.baselines.set(element, baseline)
  return baseline
}

function elementsForObject(root: HTMLElement, objectId: string): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>('[data-editor-object-id], [data-editor-entity-id], [data-entity-id], [data-media-usage-id], [data-photo-area-id], [data-certificate-id]')]
    .filter((element) => objectDatasetKeys.some((key) => element.dataset[key] === objectId))
}

function restoreScope(scope: RuntimeScope): void {
  for (const element of scope.touched) {
    const baseline = scope.baselines.get(element)
    if (!baseline) continue
    for (const [property, value] of baseline.styles) {
      if (value) element.style.setProperty(property, value)
      else element.style.removeProperty(property)
    }
    for (const [className, enabled] of baseline.classes) element.classList.toggle(className, enabled)
  }
  scope.touched.clear()
}

export function restoreRegisteredSnapshotProperties(root: HTMLElement): void {
  const scope = scopes.get(root)
  if (scope) restoreScope(scope)
}

export function applyRegisteredSnapshotProperties(root: HTMLElement, snapshot: EditorSnapshot): void {
  const scope = scopeFor(root)
  restoreScope(scope)

  for (const property of propertyRegistry) {
    const mapping = property.databaseMapping
    if (mapping.kind !== 'snapshot' || !mapping.path.includes('{entityId}')) continue
    const [recordPrefix] = mapping.path.split('{entityId}')
    const recordPath = recordPrefix.replace(/\.$/, '')
    const record = readSnapshotPath(snapshot, recordPath)
    if (!record || typeof record !== 'object' || Array.isArray(record)) continue

    for (const objectId of Object.keys(record as Record<string, unknown>)) {
      const path = resolvePropertyPath(property, objectId)
      if (!path) continue
      const rawValue = readSnapshotPath(snapshot, path)
      if (rawValue === undefined) continue
      const value = property.serializer.deserialize(rawValue)
      for (const element of elementsForObject(root, objectId)) {
        const baseline = baselineFor(scope, element)
        scope.touched.add(element)
        property.previewUpdater.update({
          element,
          entityId: objectId,
          snapshot,
          setStyle: (styleName, nextValue) => {
            if (!baseline.styles.has(styleName)) baseline.styles.set(styleName, element.style.getPropertyValue(styleName))
            if (nextValue) element.style.setProperty(styleName, nextValue)
            else element.style.removeProperty(styleName)
          },
          toggleClass: (className, enabled) => {
            if (!baseline.classes.has(className)) baseline.classes.set(className, element.classList.contains(className))
            element.classList.toggle(className, enabled)
          }
        }, value)
      }
    }
  }
}
