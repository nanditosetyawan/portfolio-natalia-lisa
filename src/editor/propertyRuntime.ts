import { propertyRegistry, readSnapshotPath, resolvePropertyPath } from './propertyRegistry'
import type { EditorSnapshot } from '../types/editorSnapshot'
import { resolveSnapshotObjectDomTarget } from './objectDomTarget'

interface ElementBaseline {
  styles: Map<string, string>
  classes: Map<string, boolean>
}

interface RuntimeScope {
  objects: Map<string, {
    baselines: WeakMap<HTMLElement, ElementBaseline>
    touched: Set<HTMLElement>
  }>
}

const scopes = new WeakMap<HTMLElement, RuntimeScope>()

function scopeFor(root: HTMLElement): RuntimeScope {
  const existing = scopes.get(root)
  if (existing) return existing
  const scope: RuntimeScope = { objects: new Map() }
  scopes.set(root, scope)
  return scope
}

function objectScopeFor(scope: RuntimeScope, objectId: string) {
  const existing = scope.objects.get(objectId)
  if (existing) return existing
  const created = { baselines: new WeakMap<HTMLElement, ElementBaseline>(), touched: new Set<HTMLElement>() }
  scope.objects.set(objectId, created)
  return created
}

function baselineFor(scope: RuntimeScope, objectId: string, element: HTMLElement): ElementBaseline {
  const objectScope = objectScopeFor(scope, objectId)
  const existing = objectScope.baselines.get(element)
  if (existing) return existing
  const baseline: ElementBaseline = { styles: new Map(), classes: new Map() }
  objectScope.baselines.set(element, baseline)
  return baseline
}

function restoreObjectScope(scope: RuntimeScope, objectId: string): void {
  const objectScope = scope.objects.get(objectId)
  if (!objectScope) return
  for (const element of objectScope.touched) {
    const baseline = objectScope.baselines.get(element)
    if (!baseline) continue
    for (const [property, value] of baseline.styles) {
      if (value) element.style.setProperty(property, value)
      else element.style.removeProperty(property)
    }
    for (const [className, enabled] of baseline.classes) element.classList.toggle(className, enabled)
  }
  objectScope.touched.clear()
}

function restoreScope(scope: RuntimeScope): void {
  for (const objectId of scope.objects.keys()) restoreObjectScope(scope, objectId)
}

export function restoreRegisteredSnapshotProperties(root: HTMLElement): void {
  const scope = scopes.get(root)
  if (scope) restoreScope(scope)
}

export function applyRegisteredSnapshotProperties(root: HTMLElement, snapshot: EditorSnapshot): void {
  const scope = scopeFor(root)
  restoreScope(scope)

  const objectIds = new Set<string>()
  for (const property of propertyRegistry) {
    const mapping = property.databaseMapping
    if (mapping.kind !== 'snapshot' || !mapping.path.includes('{entityId}')) continue
    const [recordPrefix] = mapping.path.split('{entityId}')
    const record = readSnapshotPath(snapshot, recordPrefix.replace(/\.$/, ''))
    if (!record || typeof record !== 'object' || Array.isArray(record)) continue
    for (const objectId of Object.keys(record as Record<string, unknown>)) objectIds.add(objectId)
  }
  for (const objectId of objectIds) applyRegisteredObjectProperties(root, snapshot, objectId, false)
}

export function applyRegisteredObjectProperties(
  root: HTMLElement,
  snapshot: EditorSnapshot,
  objectId: string,
  restore = true
): void {
  const scope = scopeFor(root)
  if (restore) restoreObjectScope(scope, objectId)
  const element = resolveSnapshotObjectDomTarget(root, snapshot, objectId)
  if (!element) return

  for (const property of propertyRegistry) {
    const mapping = property.databaseMapping
    if (mapping.kind !== 'snapshot' || !mapping.path.includes('{entityId}')) continue
    const path = resolvePropertyPath(property, objectId)
    if (!path) continue
    const rawValue = readSnapshotPath(snapshot, path)
    if (rawValue === undefined) continue
    const value = property.serializer.deserialize(rawValue)
    const baseline = baselineFor(scope, objectId, element)
    objectScopeFor(scope, objectId).touched.add(element)
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
