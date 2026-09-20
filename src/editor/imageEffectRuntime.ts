import type { EditorSnapshot } from '../types/editorSnapshot'
import type { EditorValue, PropertyPreviewUpdater } from '../types/editor'
import { parseBorderValue } from './borderValue'
import { parseShadowValue, shadowColor, splitShadowLayers } from './shadowValue'
import { findSnapshotObjectReference } from './editorInstances'

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'
const rootIdentifiers = new WeakMap<HTMLElement, string>()
const filterDefinitions = new WeakMap<HTMLElement, Map<string, ImageFilterDefinition>>()
let rootSequence = 0

interface ImageFilterDefinition {
  id: string
  svg: SVGSVGElement
  morphology: SVGFEMorphologyElement
  flood: SVGFEFloodElement
}

function isImageObject(snapshot: EditorSnapshot, entityId: string): boolean {
  return findSnapshotObjectReference(snapshot, entityId)?.kind === 'media'
}

function runtimeRoot(element: HTMLElement): HTMLElement {
  return element.closest<HTMLElement>('.guest-home') ?? element.parentElement ?? element
}

function rootIdentifier(root: HTMLElement): string {
  const existing = rootIdentifiers.get(root)
  if (existing) return existing
  rootSequence += 1
  const created = `snapshot-image-root-${rootSequence}`
  rootIdentifiers.set(root, created)
  return created
}

function safeIdentifier(value: string): string {
  return value.replace(/[^a-z0-9_-]/gi, '-').replace(/^-+/, '') || 'image'
}

function svgElement<K extends keyof SVGElementTagNameMap>(name: K): SVGElementTagNameMap[K] {
  return document.createElementNS(SVG_NAMESPACE, name)
}

function ensureFilterDefinition(root: HTMLElement, entityId: string): ImageFilterDefinition {
  const definitions = filterDefinitions.get(root) ?? new Map<string, ImageFilterDefinition>()
  filterDefinitions.set(root, definitions)
  const existing = definitions.get(entityId)
  if (existing) return existing

  const id = `${rootIdentifier(root)}-${safeIdentifier(entityId)}-alpha-outline`
  const svg = svgElement('svg')
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('focusable', 'false')
  svg.setAttribute('width', '0')
  svg.setAttribute('height', '0')
  svg.dataset.snapshotImageFilter = entityId
  svg.style.position = 'absolute'
  svg.style.width = '0'
  svg.style.height = '0'
  svg.style.overflow = 'hidden'
  svg.style.pointerEvents = 'none'

  const definitionsElement = svgElement('defs')
  const filter = svgElement('filter')
  filter.id = id
  filter.setAttribute('x', '-50%')
  filter.setAttribute('y', '-50%')
  filter.setAttribute('width', '200%')
  filter.setAttribute('height', '200%')
  filter.setAttribute('color-interpolation-filters', 'sRGB')

  const morphology = svgElement('feMorphology')
  morphology.setAttribute('in', 'SourceAlpha')
  morphology.setAttribute('operator', 'dilate')
  morphology.setAttribute('radius', '1')
  morphology.setAttribute('result', 'expanded-alpha')

  const ring = svgElement('feComposite')
  ring.setAttribute('in', 'expanded-alpha')
  ring.setAttribute('in2', 'SourceAlpha')
  ring.setAttribute('operator', 'out')
  ring.setAttribute('result', 'outline-ring')

  const flood = svgElement('feFlood')
  flood.setAttribute('flood-color', '#49362f')
  flood.setAttribute('result', 'outline-color')

  const coloredRing = svgElement('feComposite')
  coloredRing.setAttribute('in', 'outline-color')
  coloredRing.setAttribute('in2', 'outline-ring')
  coloredRing.setAttribute('operator', 'in')
  coloredRing.setAttribute('result', 'colored-outline')

  const merge = svgElement('feMerge')
  const outlineNode = svgElement('feMergeNode')
  outlineNode.setAttribute('in', 'colored-outline')
  const sourceNode = svgElement('feMergeNode')
  sourceNode.setAttribute('in', 'SourceGraphic')
  merge.append(outlineNode, sourceNode)
  filter.append(morphology, ring, flood, coloredRing, merge)
  definitionsElement.append(filter)
  svg.append(definitionsElement)
  root.append(svg)

  const created = { id, svg, morphology, flood }
  definitions.set(entityId, created)
  return created
}

function outlineColor(snapshot: EditorSnapshot, entityId: string, element: HTMLElement): string {
  const canonical = snapshot.backgrounds[entityId]?.border?.trim() ?? ''
  const parsed = parseBorderValue(canonical)
  if (parsed?.color) return parsed.color
  if (/^(?:#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})|rgba?\([^)]*\)|hsla?\([^)]*\)|transparent|currentColor)$/i.test(canonical)) {
    return canonical === 'currentColor' ? getComputedStyle(element).color : canonical
  }
  return getComputedStyle(element).color || '#49362f'
}

function alphaShadowFilters(value: string): string[] {
  if (!value.trim()) return []
  const filters: string[] = []
  for (const layer of splitShadowLayers(value)) {
    const parsed = parseShadowValue(layer, true)
    if (parsed.custom) return []
    filters.push(`drop-shadow(${parsed.x}px ${parsed.y}px ${parsed.blur}px ${shadowColor(parsed)})`)
  }
  return filters
}

/**
 * Interprets existing canonical border/shadow data according to Image semantics.
 * The Snapshot remains unchanged: only the semantic renderer differs by object kind.
 */
export const imageEffectPreview: PropertyPreviewUpdater = {
  styles: ['filter', 'box-shadow', 'border', 'outline'],
  classes: ['snapshot-runtime-media-hover'],
  update: (context) => {
    if (!isImageObject(context.snapshot, context.entityId)) return
    const background = context.snapshot.backgrounds[context.entityId]
    const mediaStyle = context.snapshot.media.styles[context.entityId]
    const filters: string[] = []
    const outlineWidth = mediaStyle?.outlineWidth ?? 1
    
    const targetElement = context.element.tagName === 'IMG' ? context.element : context.element.querySelector('img') || context.element

    if (mediaStyle?.outlineEnabled && outlineWidth > 0) {
      const definition = ensureFilterDefinition(runtimeRoot(targetElement), context.entityId)
      definition.morphology.setAttribute('radius', String(outlineWidth))
      definition.flood.setAttribute('flood-color', outlineColor(context.snapshot, context.entityId, targetElement))
      filters.push(`url("#${definition.id}")`)
    }
    filters.push(...alphaShadowFilters(background?.boxShadow ?? ''))
    if ((background?.blur ?? 0) > 0) filters.push(`blur(${background?.blur}px)`)

    if (targetElement !== context.element) {
      targetElement.style.filter = filters.join(' ')
      context.setStyle('filter', '')
    } else {
      context.setStyle('filter', filters.join(' '))
    }
    
    context.setStyle('box-shadow', '')
    context.setStyle('border', '')
    context.setStyle('outline', '')
    context.toggleClass('snapshot-runtime-media-hover', mediaStyle?.hoverEnabled === true)
  }
}

export const semanticShadowPreview: PropertyPreviewUpdater = {
  styles: ['filter', 'box-shadow', 'border', 'outline'],
  classes: ['snapshot-runtime-media-hover'],
  update: (context, value) => {
    if (isImageObject(context.snapshot, context.entityId)) imageEffectPreview.update(context, value)
    else context.setStyle('box-shadow', value === undefined || value === null ? '' : String(value))
  }
}

export const semanticBlurPreview: PropertyPreviewUpdater = {
  styles: ['filter', 'box-shadow', 'border', 'outline'],
  classes: ['snapshot-runtime-media-hover'],
  update: (context, value) => {
    if (isImageObject(context.snapshot, context.entityId)) imageEffectPreview.update(context, value)
    else context.setStyle('filter', typeof value === 'number' && value > 0 ? `blur(${value}px)` : '')
  }
}

export const semanticImageOpacityPreview: PropertyPreviewUpdater = {
  styles: ['opacity', '--snapshot-runtime-media-opacity'],
  update: ({ setStyle }, value: EditorValue) => {
    const opacity = typeof value === 'number' ? value : Number(value)
    const normalized = Number.isFinite(opacity) ? String(opacity) : ''
    setStyle('opacity', normalized)
    setStyle('--snapshot-runtime-media-opacity', normalized || '1')
  }
}
