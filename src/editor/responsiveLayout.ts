import { createPropertyMetadata, propertyRegistry, readSnapshotPath, resolvePropertyPath } from './propertyRegistry'
import type {
  EditorValue,
  EntityDescriptor,
  PropertyRegistryEntry,
  PropertyVisibilityContext
} from '../types/editor'
import type { EditorSnapshot, LayoutSettings } from '../types/editorSnapshot'
import { resolveObjectDomTarget } from './objectDomTarget'

export type ResponsiveBreakpoint = 'desktop' | 'laptop' | 'tablet' | 'mobile'
export type ResponsiveCanvasPresetId = 'desktop-1440' | 'desktop-1280' | 'laptop-1024' | 'tablet-768' | 'mobile-390'

export interface ResponsiveCanvasPreset {
  id: ResponsiveCanvasPresetId
  label: string
  shortLabel: string
  breakpoint: ResponsiveBreakpoint
  width: number
}

export const responsiveCanvasPresets: readonly ResponsiveCanvasPreset[] = [
  { id: 'desktop-1440', label: 'Desktop 1440', shortLabel: '1440', breakpoint: 'desktop', width: 1440 },
  { id: 'desktop-1280', label: 'Desktop 1280', shortLabel: '1280', breakpoint: 'desktop', width: 1280 },
  { id: 'laptop-1024', label: 'Laptop 1024', shortLabel: '1024', breakpoint: 'laptop', width: 1024 },
  { id: 'tablet-768', label: 'Tablet 768', shortLabel: '768', breakpoint: 'tablet', width: 768 },
  { id: 'mobile-390', label: 'Mobile 390', shortLabel: '390', breakpoint: 'mobile', width: 390 }
] as const

export const defaultResponsiveCanvasPresetId: ResponsiveCanvasPresetId = 'desktop-1440'

const inheritance: Record<ResponsiveBreakpoint, ResponsiveBreakpoint[]> = {
  desktop: ['desktop'],
  laptop: ['laptop', 'desktop'],
  tablet: ['tablet', 'laptop', 'desktop'],
  mobile: ['mobile', 'tablet', 'laptop', 'desktop']
}

const nonBaseBreakpoints: Array<Exclude<ResponsiveBreakpoint, 'desktop'>> = ['laptop', 'tablet', 'mobile']
const snapshotRecordDomains = ['typography', 'layout', 'backgrounds', 'buttons', 'animations'] as const

function clone<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => clone(item)) as T
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, clone(item)])) as T
  }
  return value
}

function stableHash(value: string, seed: number): string {
  let hash = seed >>> 0
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function objectToken(objectId: string): string {
  return `${stableHash(objectId, 2166136261)}-${stableHash(objectId, 3339675911)}`
}

function slug(value: string): string {
  return value.toLocaleLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 38)
}

/**
 * Virtual object ids keep responsive overrides inside the existing typed
 * Record maps. They are sparse, valid entity keys and never become Editor
 * Objects, so the Snapshot v1 envelope and Guest object graph stay unchanged.
 */
export function responsiveSnapshotEntityId(breakpoint: Exclude<ResponsiveBreakpoint, 'desktop'>, objectId: string): string {
  return `rwd-${breakpoint}-${objectToken(objectId)}`
}

function configRecordId(
  breakpoint: ResponsiveBreakpoint,
  objectId: string,
  propertyKey: string,
  marker?: string
): string {
  const suffix = marker === undefined ? '' : `-${slug(marker)}`
  return `rwdcfg-${breakpoint}-${objectToken(objectId)}-${slug(propertyKey)}${suffix}`.slice(0, 127)
}

function snapshotMappingTemplate(property: PropertyRegistryEntry): string | null {
  return property.databaseMapping.kind === 'snapshot' && property.databaseMapping.path.includes('{entityId}')
    ? property.databaseMapping.path
    : null
}

function mappedPath(template: string, objectId: string): string {
  return template.replaceAll('{entityId}', objectId)
}

function rawValue(snapshot: EditorSnapshot, path: string): EditorValue {
  return readSnapshotPath(snapshot, path)
}

export interface ResponsiveSnapshotPropertyState {
  value: EditorValue
  path: string
  source: 'base' | ResponsiveBreakpoint
  overridden: boolean
  inherited: boolean
}

export function resolveResponsiveSnapshotProperty(
  property: PropertyRegistryEntry,
  snapshot: EditorSnapshot,
  objectId: string,
  breakpoint: ResponsiveBreakpoint,
  fallback: EditorValue = property.defaultValue
): ResponsiveSnapshotPropertyState {
  const template = snapshotMappingTemplate(property)
  const basePath = resolvePropertyPath(property, objectId) ?? property.propertyPath
  if (!template || breakpoint === 'desktop') {
    const value = rawValue(snapshot, basePath)
    return { value: value ?? fallback, path: basePath, source: 'base', overridden: false, inherited: false }
  }

  for (const candidate of inheritance[breakpoint]) {
    if (candidate === 'desktop') break
    const path = mappedPath(template, responsiveSnapshotEntityId(candidate, objectId))
    const value = rawValue(snapshot, path)
    if (value !== undefined) {
      return {
        value,
        path,
        source: candidate,
        overridden: candidate === breakpoint,
        inherited: candidate !== breakpoint
      }
    }
  }

  const value = rawValue(snapshot, basePath)
  return { value: value ?? fallback, path: basePath, source: 'base', overridden: false, inherited: true }
}

export function responsiveSnapshotWritePath(
  property: PropertyRegistryEntry,
  objectId: string,
  breakpoint: ResponsiveBreakpoint
): string {
  const template = snapshotMappingTemplate(property)
  if (!template || breakpoint === 'desktop') return resolvePropertyPath(property, objectId) ?? property.propertyPath
  return mappedPath(template, responsiveSnapshotEntityId(breakpoint, objectId))
}

export function responsiveLayoutFieldPath(
  objectId: string,
  field: keyof LayoutSettings,
  breakpoint: ResponsiveBreakpoint
): string {
  const targetId = breakpoint === 'desktop' ? objectId : responsiveSnapshotEntityId(breakpoint, objectId)
  return `layout.${targetId}.${field}`
}

export function effectiveResponsiveLayout(
  snapshot: EditorSnapshot,
  objectId: string,
  breakpoint: ResponsiveBreakpoint
): LayoutSettings {
  return materializeResponsiveObjectSnapshot(snapshot, objectId, breakpoint).layout[objectId] ?? {}
}

export function responsiveSnapshotResetChange(
  property: PropertyRegistryEntry,
  snapshot: EditorSnapshot,
  objectId: string,
  breakpoint: ResponsiveBreakpoint
): { propertyPath: string; nextValue: EditorValue } | null {
  const template = snapshotMappingTemplate(property)
  if (!template || breakpoint === 'desktop') return null
  const virtualId = responsiveSnapshotEntityId(breakpoint, objectId)
  const [prefix, suffix = ''] = template.split('{entityId}')
  const recordPath = `${prefix}${virtualId}`
  const existing = rawValue(snapshot, recordPath)
  if (!existing || typeof existing !== 'object' || Array.isArray(existing)) return null
  const next = clone(existing as Record<string, unknown>)
  const fieldPath = suffix.replace(/^\./, '').split('.').filter(Boolean)
  const leaf = fieldPath.pop()
  if (!leaf) return null
  const parent = fieldPath.reduce<Record<string, unknown> | null>((current, key) => {
    const value = current?.[key]
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
  }, next)
  if (!parent || !(leaf in parent)) return null
  delete parent[leaf]
  return { propertyPath: recordPath, nextValue: Object.keys(next).length ? next : undefined }
}

function mergedRecord<T extends Record<string, unknown>>(
  records: Record<string, T>,
  objectId: string,
  breakpoint: ResponsiveBreakpoint
): T | undefined {
  const base = records[objectId]
  const result: Record<string, unknown> = base ? clone(base) : {}
  const parents = [...inheritance[breakpoint]].reverse().filter((candidate) => candidate !== 'desktop') as Array<Exclude<ResponsiveBreakpoint, 'desktop'>>
  for (const candidate of parents) {
    const override = records[responsiveSnapshotEntityId(candidate, objectId)]
    if (override) Object.assign(result, clone(override))
  }
  return Object.keys(result).length ? result as T : undefined
}

/** A shallow, object-scoped inheritance view used only by Preview updaters. */
export function materializeResponsiveObjectSnapshot(
  snapshot: EditorSnapshot,
  objectId: string,
  breakpoint: ResponsiveBreakpoint
): EditorSnapshot {
  if (breakpoint === 'desktop') return snapshot
  const result: EditorSnapshot = {
    ...snapshot,
    typography: { ...snapshot.typography },
    layout: { ...snapshot.layout },
    backgrounds: { ...snapshot.backgrounds },
    buttons: { ...snapshot.buttons },
    animations: { ...snapshot.animations },
    media: { ...snapshot.media, styles: { ...snapshot.media.styles } }
  }
  for (const domain of snapshotRecordDomains) {
    const records = snapshot[domain] as Record<string, Record<string, unknown>>
    const merged = mergedRecord(records, objectId, breakpoint)
    if (merged) (result[domain] as Record<string, Record<string, unknown>>)[objectId] = merged
  }
  const mediaStyle = mergedRecord(snapshot.media.styles as Record<string, Record<string, unknown>>, objectId, breakpoint)
  if (mediaStyle) result.media.styles[objectId] = mediaStyle
  return result
}

type ResponsiveStorage =
  | { kind: 'value'; field: keyof LayoutSettings }
  | { kind: 'enum'; values: readonly string[] }

interface ResponsivePreviewContext {
  breakpoint: ResponsiveBreakpoint
  setStyle: (property: string, value: string) => void
  toggleClass: (className: string, enabled: boolean) => void
}

export interface ResponsiveLayoutProperty {
  metadata: PropertyRegistryEntry
  storage: ResponsiveStorage
  breakpointScope?: 'current' | 'global'
  preview: (
    context: ResponsivePreviewContext,
    value: EditorValue,
    values: Record<string, EditorValue>
  ) => void
}

const noValidation = { validate: () => null }
const enumValidation = (values: readonly string[]) => ({
  validate: (value: EditorValue) => typeof value === 'string' && values.includes(value) ? null : `Choose one of: ${values.join(', ')}.`
})
const numberValidation = (minimum: number, maximum: number) => ({
  validate: (value: EditorValue) => typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum
    ? null
    : `Must be a number from ${minimum} to ${maximum}.`
})
const stringValidation = { validate: (value: EditorValue) => typeof value === 'string' && value.length <= 128 ? null : 'Enter a valid CSS value.' }
const alwaysDependency = { keys: [], enabled: () => true }
const dependency = (keys: string[], enabled: (values: Record<string, EditorValue>) => boolean) => ({
  keys,
  enabled: ({ values }: PropertyVisibilityContext) => enabled(values)
})
const modeIs = (...modes: string[]) => dependency(['responsive.container.mode'], (values) => modes.includes(String(values['responsive.container.mode'])))

function metadata(definition: {
  propertyKey: string
  label: string
  control: PropertyRegistryEntry['control']
  type: PropertyRegistryEntry['type']
  order: number
  capability: string
  defaultValue: EditorValue
  rowKey?: string
  options?: PropertyRegistryEntry['options']
  step?: number
  minimum?: number
  maximum?: number
  placeholder?: string
  helperText?: string
  validation?: PropertyRegistryEntry['validation']
  dependency?: PropertyRegistryEntry['dependency']
}): PropertyRegistryEntry {
  return createPropertyMetadata({
    ...definition,
    category: 'responsive',
    categoryLabel: 'RESPONSIVE LAYOUT',
    categoryOrder: 25,
    categoryDefaultOpen: false,
    presentation: 'accordion',
    commandType: 'SET_PROPERTY',
    propertyPath: definition.propertyKey,
    databaseMapping: { kind: 'runtime', path: definition.propertyKey },
    validation: definition.validation ?? noValidation,
    dependency: definition.dependency ?? alwaysDependency,
    copyable: false
  })
}

const modeOptions = ['none', 'row', 'column', 'stack', 'grid'] as const
const alignmentOptions = ['start', 'center', 'end', 'stretch'] as const
const justifyOptions = ['start', 'center', 'end', 'space-between', 'space-around'] as const
const selfOptions = ['auto', 'start', 'center', 'end', 'stretch'] as const
const horizontalConstraints = ['left', 'right', 'center', 'stretch', 'scale'] as const
const verticalConstraints = ['top', 'bottom', 'center', 'stretch', 'scale'] as const
const visibilityTargets = ['all', 'desktop', 'tablet', 'mobile'] as const

const enumOptions = (values: readonly string[]) => values.map((value) => ({
  label: value.split('-').map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join(' '),
  value
}))

function cssLength(value: EditorValue): string {
  return typeof value === 'number' ? `${value}px` : value === undefined || value === null ? '' : String(value)
}

function positiveInteger(value: EditorValue, fallback = 1): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(1, Math.round(parsed)) : fallback
}

export const responsiveLayoutRegistry: readonly ResponsiveLayoutProperty[] = [
  {
    metadata: metadata({ propertyKey: 'responsive.container.mode', label: 'Container', control: 'segmented', type: 'enum', order: 10, capability: 'container', defaultValue: 'none', options: enumOptions(modeOptions), validation: enumValidation(modeOptions) }),
    storage: { kind: 'enum', values: modeOptions },
    preview: ({ setStyle, toggleClass }, value) => {
      const mode = String(value)
      toggleClass('editor-responsive-stack', mode === 'stack')
      if (mode === 'row' || mode === 'column') {
        setStyle('display', 'flex')
        setStyle('flex-direction', mode)
      } else if (mode === 'grid' || mode === 'stack') setStyle('display', 'grid')
    }
  },
  {
    metadata: metadata({ propertyKey: 'responsive.container.wrap', label: 'Wrap', control: 'checkbox', type: 'boolean', order: 20, capability: 'container', defaultValue: false, dependency: modeIs('row', 'column'), helperText: 'Available for Row and Column containers.' }),
    storage: { kind: 'enum', values: ['false', 'true'] },
    preview: ({ setStyle }, value) => setStyle('flex-wrap', value === true ? 'wrap' : 'nowrap')
  },
  {
    metadata: metadata({ propertyKey: 'responsive.container.gap', label: 'Gap', control: 'number', type: 'number', order: 30, capability: 'container', defaultValue: 0, step: 1, minimum: 0, maximum: 1000, validation: numberValidation(0, 1000), dependency: modeIs('row', 'column', 'stack', 'grid'), helperText: 'Choose an Auto Layout container first.' }),
    storage: { kind: 'value', field: 'x' },
    preview: ({ setStyle }, value) => setStyle('gap', cssLength(value))
  },
  {
    metadata: metadata({ propertyKey: 'responsive.container.padding', label: 'Padding', control: 'text', type: 'string', order: 40, rowKey: 'responsive-spacing', capability: 'container', defaultValue: '', placeholder: 'e.g. 24px', validation: stringValidation }),
    storage: { kind: 'value', field: 'padding' },
    preview: ({ setStyle }, value) => setStyle('padding', cssLength(value))
  },
  {
    metadata: metadata({ propertyKey: 'responsive.container.margin', label: 'Margin', control: 'text', type: 'string', order: 50, rowKey: 'responsive-spacing', capability: 'container', defaultValue: '', placeholder: 'e.g. 0 auto', validation: stringValidation }),
    storage: { kind: 'value', field: 'margin' },
    preview: ({ setStyle }, value) => setStyle('margin', cssLength(value))
  },
  {
    metadata: metadata({ propertyKey: 'responsive.container.align', label: 'Alignment', control: 'select', type: 'enum', order: 60, rowKey: 'responsive-alignment', capability: 'container', defaultValue: 'stretch', options: enumOptions(alignmentOptions), validation: enumValidation(alignmentOptions), dependency: modeIs('row', 'column', 'stack', 'grid') }),
    storage: { kind: 'enum', values: alignmentOptions },
    preview: ({ setStyle }, value) => setStyle('align-items', String(value))
  },
  {
    metadata: metadata({ propertyKey: 'responsive.container.justify', label: 'Justify', control: 'select', type: 'enum', order: 70, rowKey: 'responsive-alignment', capability: 'container', defaultValue: 'start', options: enumOptions(justifyOptions), validation: enumValidation(justifyOptions), dependency: modeIs('row', 'column', 'stack', 'grid') }),
    storage: { kind: 'enum', values: justifyOptions },
    preview: ({ setStyle }, value) => setStyle('justify-content', String(value))
  },
  {
    metadata: metadata({ propertyKey: 'responsive.grid.columns', label: 'Grid columns', control: 'number', type: 'number', order: 80, rowKey: 'responsive-grid-count', capability: 'container', defaultValue: 1, step: 1, minimum: 1, maximum: 24, validation: numberValidation(1, 24), dependency: modeIs('grid'), helperText: 'Available for Grid containers.' }),
    storage: { kind: 'value', field: 'x' },
    preview: ({ setStyle }, value) => setStyle('grid-template-columns', `repeat(${positiveInteger(value)}, minmax(0, 1fr))`)
  },
  {
    metadata: metadata({ propertyKey: 'responsive.grid.rows', label: 'Grid rows', control: 'number', type: 'number', order: 90, rowKey: 'responsive-grid-count', capability: 'container', defaultValue: 1, step: 1, minimum: 1, maximum: 24, validation: numberValidation(1, 24), dependency: modeIs('grid'), helperText: 'Available for Grid containers.' }),
    storage: { kind: 'value', field: 'x' },
    preview: ({ setStyle }, value) => setStyle('grid-template-rows', `repeat(${positiveInteger(value)}, minmax(0, auto))`)
  },
  {
    metadata: metadata({ propertyKey: 'responsive.grid.gap', label: 'Grid gap', control: 'number', type: 'number', order: 100, rowKey: 'responsive-grid-gap', capability: 'container', defaultValue: 0, step: 1, minimum: 0, maximum: 1000, validation: numberValidation(0, 1000), dependency: modeIs('grid'), helperText: 'Available for Grid containers.' }),
    storage: { kind: 'value', field: 'x' },
    preview: ({ setStyle }, value) => setStyle('gap', cssLength(value))
  },
  {
    metadata: metadata({ propertyKey: 'responsive.grid.alignment', label: 'Grid alignment', control: 'select', type: 'enum', order: 110, capability: 'container', defaultValue: 'stretch', options: enumOptions(alignmentOptions), validation: enumValidation(alignmentOptions), dependency: modeIs('grid'), helperText: 'Available for Grid containers.' }),
    storage: { kind: 'enum', values: alignmentOptions },
    preview: ({ setStyle }, value) => setStyle('place-items', String(value))
  },
  {
    metadata: metadata({ propertyKey: 'responsive.grid.collapse', label: 'Collapse to one column', control: 'checkbox', type: 'boolean', order: 120, capability: 'container', defaultValue: false, dependency: modeIs('grid'), helperText: 'Available for Grid containers.' }),
    storage: { kind: 'enum', values: ['false', 'true'] },
    preview: ({ breakpoint, setStyle }, value) => {
      if (value === true && breakpoint !== 'desktop') setStyle('grid-template-columns', 'minmax(0, 1fr)')
    }
  },
  {
    metadata: metadata({ propertyKey: 'responsive.grid.columnSpan', label: 'Column span', control: 'number', type: 'number', order: 130, rowKey: 'responsive-grid-span', capability: 'layout', defaultValue: 1, step: 1, minimum: 1, maximum: 24, validation: numberValidation(1, 24) }),
    storage: { kind: 'value', field: 'x' },
    preview: ({ setStyle }, value) => setStyle('grid-column', `span ${positiveInteger(value)}`)
  },
  {
    metadata: metadata({ propertyKey: 'responsive.grid.rowSpan', label: 'Row span', control: 'number', type: 'number', order: 140, rowKey: 'responsive-grid-span', capability: 'layout', defaultValue: 1, step: 1, minimum: 1, maximum: 24, validation: numberValidation(1, 24) }),
    storage: { kind: 'value', field: 'x' },
    preview: ({ setStyle }, value) => setStyle('grid-row', `span ${positiveInteger(value)}`)
  },
  {
    metadata: metadata({ propertyKey: 'responsive.flex.grow', label: 'Flex grow', control: 'number', type: 'number', order: 150, rowKey: 'responsive-flex-size', capability: 'layout', defaultValue: 0, step: 0.1, minimum: 0, maximum: 100, validation: numberValidation(0, 100) }),
    storage: { kind: 'value', field: 'x' },
    preview: ({ setStyle }, value) => setStyle('flex-grow', String(value))
  },
  {
    metadata: metadata({ propertyKey: 'responsive.flex.shrink', label: 'Flex shrink', control: 'number', type: 'number', order: 160, rowKey: 'responsive-flex-size', capability: 'layout', defaultValue: 1, step: 0.1, minimum: 0, maximum: 100, validation: numberValidation(0, 100) }),
    storage: { kind: 'value', field: 'x' },
    preview: ({ setStyle }, value) => setStyle('flex-shrink', String(value))
  },
  {
    metadata: metadata({ propertyKey: 'responsive.flex.basis', label: 'Flex basis', control: 'text', type: 'string', order: 170, capability: 'layout', defaultValue: 'auto', placeholder: 'auto or CSS length', validation: stringValidation }),
    storage: { kind: 'value', field: 'width' },
    preview: ({ setStyle }, value) => setStyle('flex-basis', cssLength(value))
  },
  {
    metadata: metadata({ propertyKey: 'responsive.flex.alignSelf', label: 'Align self', control: 'select', type: 'enum', order: 180, rowKey: 'responsive-flex-self', capability: 'layout', defaultValue: 'auto', options: enumOptions(selfOptions), validation: enumValidation(selfOptions) }),
    storage: { kind: 'enum', values: selfOptions },
    preview: ({ setStyle }, value) => setStyle('align-self', String(value))
  },
  {
    metadata: metadata({ propertyKey: 'responsive.flex.justifySelf', label: 'Justify self', control: 'select', type: 'enum', order: 190, rowKey: 'responsive-flex-self', capability: 'layout', defaultValue: 'auto', options: enumOptions(selfOptions), validation: enumValidation(selfOptions) }),
    storage: { kind: 'enum', values: selfOptions },
    preview: ({ setStyle }, value) => setStyle('justify-self', String(value))
  },
  {
    metadata: metadata({ propertyKey: 'responsive.constraint.horizontal', label: 'Horizontal constraint', control: 'select', type: 'enum', order: 200, rowKey: 'responsive-constraints', capability: 'layout', defaultValue: 'left', options: enumOptions(horizontalConstraints), validation: enumValidation(horizontalConstraints) }),
    storage: { kind: 'enum', values: horizontalConstraints },
    preview: ({ toggleClass }, value) => horizontalConstraints.forEach((constraint) => toggleClass(`editor-constraint-x-${constraint}`, value === constraint))
  },
  {
    metadata: metadata({ propertyKey: 'responsive.constraint.vertical', label: 'Vertical constraint', control: 'select', type: 'enum', order: 210, rowKey: 'responsive-constraints', capability: 'layout', defaultValue: 'top', options: enumOptions(verticalConstraints), validation: enumValidation(verticalConstraints) }),
    storage: { kind: 'enum', values: verticalConstraints },
    preview: ({ toggleClass }, value) => verticalConstraints.forEach((constraint) => toggleClass(`editor-constraint-y-${constraint}`, value === constraint))
  },
  {
    metadata: metadata({ propertyKey: 'responsive.safeArea', label: 'Mobile safe area', control: 'checkbox', type: 'boolean', order: 220, capability: 'container', defaultValue: false, helperText: 'Available on the Mobile breakpoint.', dependency: dependency([], () => true) }),
    storage: { kind: 'enum', values: ['false', 'true'] },
    preview: ({ breakpoint, toggleClass }, value) => toggleClass('editor-mobile-safe-area', breakpoint === 'mobile' && value === true)
  },
  {
    metadata: metadata({ propertyKey: 'responsive.visibility', label: 'Responsive visibility', control: 'segmented', type: 'enum', order: 230, capability: 'layout', defaultValue: 'all', options: enumOptions(visibilityTargets), validation: enumValidation(visibilityTargets) }),
    storage: { kind: 'enum', values: visibilityTargets },
    breakpointScope: 'global',
    preview: ({ breakpoint, setStyle }, value) => {
      const target = String(value)
      const visible = target === 'all'
        || (target === 'desktop' && (breakpoint === 'desktop' || breakpoint === 'laptop'))
        || target === breakpoint
      if (!visible) setStyle('display', 'none')
    }
  }
] as const

export function resolveResponsiveLayoutProperties(
  entity: EntityDescriptor,
  breakpoint: ResponsiveBreakpoint
): ResponsiveLayoutProperty[] {
  return responsiveLayoutRegistry.filter((property) => {
    if (!entity.capabilities.includes(property.metadata.capability)) return false
    if (property.metadata.propertyKey === 'responsive.safeArea' && breakpoint !== 'mobile') return true
    return true
  })
}

function storageBreakpoint(property: ResponsiveLayoutProperty, breakpoint: ResponsiveBreakpoint): ResponsiveBreakpoint {
  return property.breakpointScope === 'global' ? 'desktop' : breakpoint
}

function storedConfigValue(
  property: ResponsiveLayoutProperty,
  snapshot: EditorSnapshot,
  objectId: string,
  breakpoint: ResponsiveBreakpoint
): EditorValue {
  const targetBreakpoint = storageBreakpoint(property, breakpoint)
  if (property.storage.kind === 'value') {
    const record = snapshot.layout[configRecordId(targetBreakpoint, objectId, property.metadata.propertyKey)]
    return record?.[property.storage.field] as EditorValue
  }
  for (const option of property.storage.values) {
    const record = snapshot.layout[configRecordId(targetBreakpoint, objectId, property.metadata.propertyKey, option)]
    if (record) return property.metadata.type === 'boolean' ? option === 'true' : option
  }
  return undefined
}

export interface ResponsiveLayoutPropertyState {
  value: EditorValue
  source: ResponsiveBreakpoint | 'default'
  overridden: boolean
  inherited: boolean
}

export function readResponsiveLayoutPropertyState(
  property: ResponsiveLayoutProperty,
  snapshot: EditorSnapshot,
  objectId: string,
  breakpoint: ResponsiveBreakpoint
): ResponsiveLayoutPropertyState {
  if (property.breakpointScope === 'global') {
    const value = storedConfigValue(property, snapshot, objectId, 'desktop')
    return value === undefined
      ? { value: property.metadata.defaultValue, source: 'default', overridden: false, inherited: false }
      : { value, source: 'desktop', overridden: true, inherited: false }
  }
  for (const candidate of inheritance[breakpoint]) {
    const value = storedConfigValue(property, snapshot, objectId, candidate)
    if (value !== undefined) {
      return {
        value,
        source: candidate,
        overridden: candidate === breakpoint,
        inherited: candidate !== breakpoint
      }
    }
  }
  return { value: property.metadata.defaultValue, source: 'default', overridden: false, inherited: breakpoint !== 'desktop' }
}

export function responsiveLayoutValues(
  properties: readonly ResponsiveLayoutProperty[],
  snapshot: EditorSnapshot,
  objectId: string,
  breakpoint: ResponsiveBreakpoint
): Record<string, EditorValue> {
  return Object.fromEntries(properties.map((property) => [
    property.metadata.propertyKey,
    readResponsiveLayoutPropertyState(property, snapshot, objectId, breakpoint).value
  ]))
}

export function isResponsiveLayoutPropertyEnabled(
  property: ResponsiveLayoutProperty,
  entity: EntityDescriptor,
  snapshot: EditorSnapshot,
  breakpoint: ResponsiveBreakpoint,
  values: Record<string, EditorValue>
): boolean {
  if (property.metadata.propertyKey === 'responsive.safeArea' && breakpoint !== 'mobile') return false
  return property.metadata.dependency.enabled({ entity, snapshot, values })
}

export function responsiveLayoutPropertyChanges(
  property: ResponsiveLayoutProperty,
  objectId: string,
  breakpoint: ResponsiveBreakpoint,
  value: EditorValue
): Array<{ propertyPath: string; nextValue: EditorValue }> {
  const targetBreakpoint = storageBreakpoint(property, breakpoint)
  if (property.storage.kind === 'value') {
    const id = configRecordId(targetBreakpoint, objectId, property.metadata.propertyKey)
    const nextValue = value === '' || value === null || value === undefined
      ? undefined
      : { [property.storage.field]: clone(value) }
    return [{ propertyPath: `layout.${id}`, nextValue }]
  }
  const serialized = property.metadata.type === 'boolean' ? String(Boolean(value)) : String(value)
  return property.storage.values.map((option) => ({
    propertyPath: `layout.${configRecordId(targetBreakpoint, objectId, property.metadata.propertyKey, option)}`,
    nextValue: option === serialized ? { display: 'block' } : undefined
  }))
}

export function responsiveLayoutResetChanges(
  property: ResponsiveLayoutProperty,
  objectId: string,
  breakpoint: ResponsiveBreakpoint
): Array<{ propertyPath: string; nextValue: EditorValue }> {
  const targetBreakpoint = storageBreakpoint(property, breakpoint)
  if (property.storage.kind === 'value') {
    return [{ propertyPath: `layout.${configRecordId(targetBreakpoint, objectId, property.metadata.propertyKey)}`, nextValue: undefined }]
  }
  return property.storage.values.map((option) => ({
    propertyPath: `layout.${configRecordId(targetBreakpoint, objectId, property.metadata.propertyKey, option)}`,
    nextValue: undefined
  }))
}

interface ElementBaseline {
  styles: Map<string, string>
  classes: Map<string, boolean>
}

interface ObjectScope {
  baselines: WeakMap<HTMLElement, ElementBaseline>
  touched: Set<HTMLElement>
}

const previewScopes = new WeakMap<HTMLElement, Map<string, ObjectScope>>()

function objectScope(root: HTMLElement, objectId: string): ObjectScope {
  let rootScope = previewScopes.get(root)
  if (!rootScope) {
    rootScope = new Map()
    previewScopes.set(root, rootScope)
  }
  let scope = rootScope.get(objectId)
  if (!scope) {
    scope = { baselines: new WeakMap(), touched: new Set() }
    rootScope.set(objectId, scope)
  }
  return scope
}

function elementBaseline(scope: ObjectScope, element: HTMLElement): ElementBaseline {
  let baseline = scope.baselines.get(element)
  if (!baseline) {
    baseline = { styles: new Map(), classes: new Map() }
    scope.baselines.set(element, baseline)
  }
  scope.touched.add(element)
  return baseline
}

export function restoreResponsiveObjectProperties(root: HTMLElement, objectId: string): void {
  const scope = previewScopes.get(root)?.get(objectId)
  if (!scope) return
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

export function restoreResponsiveSnapshotProperties(root: HTMLElement): void {
  const scope = previewScopes.get(root)
  if (!scope) return
  for (const objectId of scope.keys()) restoreResponsiveObjectProperties(root, objectId)
}

export function applyResponsiveObjectProperties(
  root: HTMLElement,
  snapshot: EditorSnapshot,
  entity: EntityDescriptor,
  breakpoint: ResponsiveBreakpoint
): void {
  const objectId = entity.entityId
  const element = resolveObjectDomTarget(root, objectId, entity.objectType ?? entity.kind)
  if (!element) return
  const effectiveSnapshot = materializeResponsiveObjectSnapshot(snapshot, objectId, breakpoint)
  const scope = objectScope(root, objectId)
  const applyToElement = (element: HTMLElement, updater: (context: ResponsivePreviewContext) => void) => {
    const baseline = elementBaseline(scope, element)
    updater({
      breakpoint,
      setStyle: (property, value) => {
        if (!baseline.styles.has(property)) baseline.styles.set(property, element.style.getPropertyValue(property))
        if (value) element.style.setProperty(property, value)
        else element.style.removeProperty(property)
      },
      toggleClass: (className, enabled) => {
        if (!baseline.classes.has(className)) baseline.classes.set(className, element.classList.contains(className))
        element.classList.toggle(className, enabled)
      }
    })
  }

  if (breakpoint !== 'desktop') {
    for (const property of propertyRegistry) {
      if (!snapshotMappingTemplate(property)) continue
      const state = resolveResponsiveSnapshotProperty(property, snapshot, objectId, breakpoint)
      if (state.source === 'base') continue
      const value = property.serializer.deserialize(state.value)
      applyToElement(element, ({ setStyle, toggleClass }) => property.previewUpdater.update({
        element,
        entityId: objectId,
        snapshot: effectiveSnapshot,
        setStyle,
        toggleClass
      }, value))
    }
  }

  const properties = resolveResponsiveLayoutProperties(entity, breakpoint)
  const values = responsiveLayoutValues(properties, snapshot, objectId, breakpoint)
  for (const property of properties) {
    const state = readResponsiveLayoutPropertyState(property, snapshot, objectId, breakpoint)
    if (state.source === 'default' || !isResponsiveLayoutPropertyEnabled(property, entity, snapshot, breakpoint, values)) continue
    applyToElement(element, (context) => property.preview(context, state.value, values))
  }
}

export function objectHasResponsiveData(snapshot: EditorSnapshot, objectId: string): boolean {
  for (const breakpoint of nonBaseBreakpoints) {
    const virtualId = responsiveSnapshotEntityId(breakpoint, objectId)
    if (snapshotRecordDomains.some((domain) => Boolean((snapshot[domain] as Record<string, unknown>)[virtualId]))) return true
    if (snapshot.media.styles[virtualId]) return true
  }
  for (const property of responsiveLayoutRegistry) {
    const breakpoints = property.breakpointScope === 'global' ? ['desktop'] as const : ['desktop', 'laptop', 'tablet', 'mobile'] as const
    for (const breakpoint of breakpoints) {
      if (storedConfigValue(property, snapshot, objectId, breakpoint) !== undefined) return true
    }
  }
  return false
}

interface ResponsiveRecordLocation {
  propertyPath: string
  value: EditorValue
  targetPath: (targetObjectId: string) => string
}

function responsiveRecordLocations(snapshot: EditorSnapshot, objectId: string): ResponsiveRecordLocation[] {
  const locations: ResponsiveRecordLocation[] = []
  for (const breakpoint of nonBaseBreakpoints) {
    const sourceId = responsiveSnapshotEntityId(breakpoint, objectId)
    for (const domain of snapshotRecordDomains) {
      const value = (snapshot[domain] as Record<string, EditorValue>)[sourceId]
      if (value !== undefined) locations.push({
        propertyPath: `${domain}.${sourceId}`,
        value,
        targetPath: (targetObjectId) => `${domain}.${responsiveSnapshotEntityId(breakpoint, targetObjectId)}`
      })
    }
    const mediaStyle = snapshot.media.styles[sourceId]
    if (mediaStyle !== undefined) locations.push({
      propertyPath: `media.styles.${sourceId}`,
      value: mediaStyle as unknown as EditorValue,
      targetPath: (targetObjectId) => `media.styles.${responsiveSnapshotEntityId(breakpoint, targetObjectId)}`
    })
  }
  for (const property of responsiveLayoutRegistry) {
    const breakpoints = property.breakpointScope === 'global' ? ['desktop'] as const : ['desktop', 'laptop', 'tablet', 'mobile'] as const
    for (const breakpoint of breakpoints) {
      const markers = property.storage.kind === 'enum' ? property.storage.values : [undefined]
      for (const marker of markers) {
        const sourceId = configRecordId(breakpoint, objectId, property.metadata.propertyKey, marker)
        const value = snapshot.layout[sourceId]
        if (value === undefined) continue
        locations.push({
          propertyPath: `layout.${sourceId}`,
          value: value as unknown as EditorValue,
          targetPath: (targetObjectId) => `layout.${configRecordId(breakpoint, targetObjectId, property.metadata.propertyKey, marker)}`
        })
      }
    }
  }
  return locations
}

export function cloneResponsiveObjectChanges(
  snapshot: EditorSnapshot,
  sourceObjectId: string,
  targetObjectId: string
): Array<{ propertyPath: string; nextValue: EditorValue }> {
  return responsiveRecordLocations(snapshot, sourceObjectId).map((location) => ({
    propertyPath: location.targetPath(targetObjectId),
    nextValue: clone(location.value)
  }))
}

export function removeResponsiveObjectChanges(
  snapshot: EditorSnapshot,
  objectId: string
): Array<{ propertyPath: string; nextValue: EditorValue }> {
  return responsiveRecordLocations(snapshot, objectId).map((location) => ({
    propertyPath: location.propertyPath,
    nextValue: undefined
  }))
}

export function responsiveStateLabel(state: ResponsiveSnapshotPropertyState | ResponsiveLayoutPropertyState): string {
  if (state.source === 'default') return 'Inherited · Default'
  if (state.source === 'base') return state.inherited ? 'Inherited · Desktop' : 'Base'
  if (state.overridden) return state.source === 'desktop' ? 'Base' : 'Override'
  return `Inherited · ${state.source.charAt(0).toUpperCase()}${state.source.slice(1)}`
}
