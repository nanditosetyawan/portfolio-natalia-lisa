import type {
  EditorControl,
  EditorObjectType,
  EditorValue,
  PropertyRegistryEntry
} from '../types/editor'

export type InspectorPropertyClassification =
  | 'USER-FRIENDLY'
  | 'NEEDS FRIENDLY ADAPTER'
  | 'ADVANCED ONLY'
  | 'BROKEN'
  | 'DUPLICATE / REDUNDANT'
  | 'NOT APPLICABLE TO CURRENT OBJECT'

export type InspectorPresentationMode = 'simple' | 'advanced' | 'hidden'
export type InspectorValueAdapterId = 'identity' | 'css-pixels' | 'rotation-degrees' | 'opacity-percent' | 'font-family'

export interface InspectorPresentationDefinition {
  label?: string
  category?: string
  categoryLabel?: string
  categoryOrder?: number
  order?: number
  rowKey?: string
  mode?: InspectorPresentationMode
  control?: EditorControl
  adapter?: InspectorValueAdapterId
  unit?: string
  minimum?: number
  maximum?: number
  step?: number
  options?: Array<{ label: string; value: string }>
  controlOptions?: Record<string, EditorValue>
  resolvedStyle?: string
  classification?: InspectorPropertyClassification
  problem?: string
  friendlyUi?: string
  advancedRaw?: boolean
  advancedEditable?: boolean
  hideWhenUnavailable?: boolean
  hiddenForTypes?: EditorObjectType[]
  advancedForTypes?: EditorObjectType[]
  typeOverrides?: Array<{
    objectTypes: EditorObjectType[]
    label?: string
    category?: string
    categoryLabel?: string
    categoryOrder?: number
    order?: number
    advancedRaw?: boolean
    advancedEditable?: boolean
    controlOptions?: Record<string, EditorValue>
    problem?: string
    friendlyUi?: string
  }>
  helperText?: string
}

export interface ResolvedInspectorPresentation extends Required<Pick<InspectorPresentationDefinition,
  'category' | 'categoryLabel' | 'categoryOrder' | 'order' | 'rowKey' | 'mode' | 'control' | 'adapter'
  | 'classification' | 'problem' | 'friendlyUi' | 'advancedRaw' | 'advancedEditable' | 'hideWhenUnavailable'
>> {
  label: string
  unit?: string
  minimum?: number
  maximum?: number
  step?: number
  options?: Array<{ label: string; value: string }>
  controlOptions?: Record<string, EditorValue>
  resolvedStyle?: string
  helperText?: string
}

interface CategoryPresentation {
  category: string
  categoryLabel: string
  categoryOrder: number
}

const categoryPresentation: Record<string, CategoryPresentation> = {
  content: { category: 'content', categoryLabel: 'CONTENT', categoryOrder: 0 },
  font: { category: 'font', categoryLabel: 'TYPOGRAPHY', categoryOrder: 10 },
  media: { category: 'media', categoryLabel: 'MEDIA', categoryOrder: 20 },
  layout: { category: 'layout', categoryLabel: 'LAYOUT', categoryOrder: 30 },
  position: { category: 'layout', categoryLabel: 'LAYOUT', categoryOrder: 30 },
  responsive: { category: 'layout', categoryLabel: 'LAYOUT', categoryOrder: 30 },
  effects: { category: 'effects', categoryLabel: 'EFFECTS', categoryOrder: 40 },
  animation: { category: 'animation', categoryLabel: 'ANIMATION', categoryOrder: 50 },
  visibility: { category: 'visibility', categoryLabel: 'VISIBILITY', categoryOrder: 60 },
  interaction: { category: 'interaction', categoryLabel: 'INTERACTION', categoryOrder: 70 },
  behavior: { category: 'advanced', categoryLabel: 'ADVANCED', categoryOrder: 90 },
  advanced: { category: 'advanced', categoryLabel: 'ADVANCED', categoryOrder: 90 }
}

const definitions = new Map<string, InspectorPresentationDefinition>()

export function registerInspectorPresentation(propertyKey: string, definition: InspectorPresentationDefinition): void {
  if (!propertyKey.trim()) throw new Error('Inspector presentation property key is required.')
  definitions.set(propertyKey, { ...definition })
}

function registerMany(entries: Array<[string, InspectorPresentationDefinition]>): void {
  for (const [propertyKey, definition] of entries) registerInspectorPresentation(propertyKey, definition)
}

const pxAdapter = (label?: string, overrides: InspectorPresentationDefinition = {}): InspectorPresentationDefinition => ({
  label,
  control: 'number',
  adapter: 'css-pixels',
  unit: 'px',
  step: 1,
  classification: 'NEEDS FRIENDLY ADAPTER',
  problem: 'The canonical CSS length is not appropriate for the default user interface.',
  friendlyUi: 'A unit-labelled numeric value resolved for the active canvas.',
  advancedRaw: true,
  advancedEditable: true,
  ...overrides
})

const advanced = (label?: string, overrides: InspectorPresentationDefinition = {}): InspectorPresentationDefinition => ({
  label,
  mode: 'advanced',
  category: 'advanced',
  categoryLabel: 'ADVANCED',
  categoryOrder: 90,
  classification: 'ADVANCED ONLY',
  problem: 'The setting exposes implementation detail or is intended for expert control.',
  friendlyUi: 'Available in the collapsed Advanced section.',
  ...overrides
})

registerMany([
  ['font.family', {
    control: 'select', adapter: 'font-family', classification: 'NEEDS FRIENDLY ADAPTER', advancedRaw: true,
    problem: 'The current text field exposes a raw font-family stack.', friendlyUi: 'A dropdown of fonts already shipped by the project.'
  }],
  ['font.size', pxAdapter('Size', { minimum: 1, maximum: 500, rowKey: 'font-size-spacing', resolvedStyle: 'font-size' })],
  ['font.spacing', pxAdapter('Letter spacing', { minimum: -100, maximum: 200, rowKey: 'font-size-spacing', resolvedStyle: 'letter-spacing' })],
  ['font.color', { friendlyUi: 'Color swatch, global colors, recent colors, custom picker, and opacity.' }],
  ['font.shadow', {
    label: 'Shadow', control: 'shadow', classification: 'NEEDS FRIENDLY ADAPTER', advancedRaw: true, advancedEditable: true,
    controlOptions: { allowSpread: false }, problem: 'A raw CSS text-shadow string is exposed.', friendlyUi: 'On/off with X, Y, Blur, Color, and Opacity.'
  }],
  ['font.hover', { label: 'Hover style', hideWhenUnavailable: true }],
  ['font.positionX', { label: 'X', unit: 'px', rowKey: 'font-position', hideWhenUnavailable: true }],
  ['font.positionY', { label: 'Y', unit: 'px', rowKey: 'font-position', hideWhenUnavailable: true }],
  ['font.rotate', { label: 'Rotate', unit: '°' }],

  ['media.preview', { order: 5 }],
  ['media.upload', { label: 'Upload New Image', order: 10, helperText: 'Upload a reusable asset and add another image to this part of the page.' }],
  ['media.choose', { label: 'Choose from Media', order: 20, helperText: 'Add an existing reusable asset as another image to this part of the page.' }],
  ['media.replace', { label: 'Replace Selected Image', order: 30, helperText: 'Choose an existing Media Library asset. The selected image keeps its size and styling.' }],
  ['media.remove', { label: 'Remove Selected Image', order: 40, helperText: 'Unassign this instance without deleting its Media Library asset.' }],
  ['media.duplicateReference', { label: 'Duplicate Image', order: 41, helperText: 'Create an independently editable copy with the same asset and style.' }],
  ['media.reveal', { label: 'Show in Media Library', order: 42, helperText: 'Choose an image before opening it in the Media Library.' }],
  ['media.width', pxAdapter('W', { minimum: 0, maximum: 10000, order: 50, rowKey: 'media-size', resolvedStyle: 'width', hideWhenUnavailable: true })],
  ['media.height', pxAdapter('H', { minimum: 0, maximum: 10000, order: 51, rowKey: 'media-size', resolvedStyle: 'height', hideWhenUnavailable: true })],
  ['media.aspectRatioLocked', { label: 'Lock proportions', order: 52, hideWhenUnavailable: true }],
  ['media.fit', { label: 'Fit', order: 60, hideWhenUnavailable: true }],
  ['media.crop', { label: 'Image focus', order: 61 }],
  ['media.hover', { label: 'Hover Style', order: 70, hideWhenUnavailable: true, helperText: 'A subtle image emphasis on pointer hover. Motion remains in Animation.' }],
  ['media.positionX', { label: 'X', unit: 'px', order: 80, rowKey: 'media-position', hideWhenUnavailable: true }],
  ['media.positionY', { label: 'Y', unit: 'px', order: 81, rowKey: 'media-position', hideWhenUnavailable: true }],
  ['media.outlineEnabled', { order: 90, hideWhenUnavailable: true }],
  ['media.outlineWidth', { label: 'Thickness', order: 91, unit: 'px', hideWhenUnavailable: true }],
  ['media.border', { label: 'Outline Color', control: 'color', order: 92, hideWhenUnavailable: true }],
  ['media.radius', pxAdapter('Radius', { minimum: 0, maximum: 5000, order: 100, resolvedStyle: 'border-radius' })],
  ['media.opacity', {
    adapter: 'opacity-percent', unit: '%', minimum: 0, maximum: 100, step: 1, order: 110,
    classification: 'NEEDS FRIENDLY ADAPTER', problem: 'Opacity is stored as a 0–1 implementation value.', friendlyUi: 'A 0–100 percent control.'
  }],
  ['media.rotate', { label: 'Rotate', order: 120, unit: '°' }],

  ['layout.margin', pxAdapter('Outer spacing', { minimum: -10000, maximum: 10000, rowKey: 'layout-spacing', resolvedStyle: 'margin-top', advancedForTypes: ['Text', 'Image'] })],
  ['layout.padding', pxAdapter('Inner spacing', { minimum: 0, maximum: 10000, rowKey: 'layout-spacing', resolvedStyle: 'padding-top', advancedForTypes: ['Text', 'Image'] })],
  ['layout.alignment', {
    label: 'Legacy alignment', mode: 'hidden', classification: 'DUPLICATE / REDUNDANT', options: [
      { label: 'Start', value: 'start' }, { label: 'Center', value: 'center' }, { label: 'End', value: 'end' },
      { label: 'Stretch', value: 'stretch' }, { label: 'Space between', value: 'space-between' }, { label: 'Even spacing', value: 'space-around' }
    ], problem: 'justify-content is inactive without a compatible container mode.', friendlyUi: 'Container Alignment is exposed through dependency-aware Layout controls.'
  }],
  ['layout.display', advanced('Display mode', { options: [
    { label: 'Normal', value: 'block' }, { label: 'Inline', value: 'inline' }, { label: 'Inline block', value: 'inline-block' },
    { label: 'Flexible', value: 'flex' }, { label: 'Grid', value: 'grid' }, { label: 'Hidden', value: 'none' }
  ] })],
  ['layout.visibility', {
    category: 'visibility', categoryLabel: 'VISIBILITY', categoryOrder: 60, label: 'Show on site',
    options: [{ label: 'Shown', value: 'visible' }, { label: 'Hidden', value: 'hidden' }]
  }],
  ['position.x', { label: 'X', unit: 'px', rowKey: 'position-xy', hiddenForTypes: ['Text', 'Button', 'Image'], classification: 'DUPLICATE / REDUNDANT' }],
  ['position.y', { label: 'Y', unit: 'px', rowKey: 'position-xy', hiddenForTypes: ['Text', 'Button', 'Image'], classification: 'DUPLICATE / REDUNDANT' }],
  ['position.width', pxAdapter('Width', { minimum: 0, maximum: 10000, rowKey: 'position-size', hiddenForTypes: ['Image'], resolvedStyle: 'width' })],
  ['position.height', pxAdapter('Height', { minimum: 0, maximum: 10000, rowKey: 'position-size', hiddenForTypes: ['Image'], resolvedStyle: 'height' })],
  ['position.rotation', { label: 'Rotate', unit: '°', hiddenForTypes: ['Text', 'Button', 'Image'], classification: 'DUPLICATE / REDUNDANT' }],

  ['effects.opacity', {
    adapter: 'opacity-percent', unit: '%', minimum: 0, maximum: 100, step: 1,
    classification: 'NEEDS FRIENDLY ADAPTER', hiddenForTypes: ['Image'], problem: 'Opacity is stored as a 0–1 implementation value.', friendlyUi: 'A 0–100 percent control.'
  }],
  ['effects.shadow', {
    control: 'shadow', classification: 'NEEDS FRIENDLY ADAPTER', advancedRaw: true, advancedEditable: true,
    controlOptions: { allowSpread: true }, advancedForTypes: ['Text', 'Button'], label: 'Element shadow',
    problem: 'Text already owns its normal Shadow control; box shadow is an expert bounding-box effect.',
    friendlyUi: 'On/off with X, Y, Blur, Spread, Color, and Opacity.',
    typeOverrides: [{
      objectTypes: ['Image'], category: 'media', categoryLabel: 'MEDIA', categoryOrder: 20, order: 95,
      label: 'Image Shadow', controlOptions: { allowSpread: false }, advancedRaw: false, advancedEditable: false,
      problem: 'A rectangular box shadow does not follow transparent image pixels.',
      friendlyUi: 'On/off with X, Y, Blur, Color, and Opacity; rendered against image alpha.'
    }]
  }],
  ['effects.blur', { unit: 'px' }],
  ['effects.border', {
    control: 'border', classification: 'NEEDS FRIENDLY ADAPTER', advancedRaw: true, advancedEditable: true,
    hiddenForTypes: ['Image'], problem: 'A raw CSS border shorthand is exposed.', friendlyUi: 'On/off with Thickness, Style, and Color.',
    typeOverrides: [{
      objectTypes: ['Text'],
      label: 'Text Outline',
      controlOptions: { textOutline: true },
      problem: 'Text needs a glyph stroke rather than a rectangular element border.',
      friendlyUi: 'On/off with glyph-outline Thickness and Color.'
    }]
  }],
  ['effects.radius', pxAdapter('Corner radius', { minimum: 0, maximum: 5000, hiddenForTypes: ['Image'], resolvedStyle: 'border-radius' })],
  ['effects.background', { label: 'Background color' }],

  ['animation.fillMode', advanced('Fill behavior')],
  ['animation.hover', { category: 'interaction', categoryLabel: 'INTERACTION', categoryOrder: 70, label: 'Hover motion' }],
  ['animation.click', { category: 'interaction', categoryLabel: 'INTERACTION', categoryOrder: 70, label: 'Click effect' }],
  ['animation.duration', { unit: 'ms', hideWhenUnavailable: true }],
  ['animation.delay', { unit: 'ms', hideWhenUnavailable: true }],
  ['animation.ease', { label: 'Speed curve', hideWhenUnavailable: true }],
  ['animation.loop', { hideWhenUnavailable: true }],
  ['animation.direction', { label: 'Playback direction', hideWhenUnavailable: true }],
  ['animation.playOnce', { hideWhenUnavailable: true }],
  ['animation.preview', { hideWhenUnavailable: true }],
  ['animation.scrollPlayback', { hideWhenUnavailable: true }],
  ['animation.scrollOffset', { label: 'Start offset', hideWhenUnavailable: true }],
  ['animation.scrollThreshold', { label: 'Visible amount', hideWhenUnavailable: true }],
  ['animation.timelineMode', { label: 'Play together or in order', hideWhenUnavailable: true }],
  ['animation.timelineDelay', { label: 'Time between animations', hideWhenUnavailable: true }],
  ['animation.timelinePreview', { hideWhenUnavailable: true }],
  ['animation.globalDisabled', { label: 'Turn off all animations' }],
  ['animation.duplicate', { helperText: 'Select two or more elements to reuse this animation.' }],

  ['advanced.objectId', advanced('Element ID')],
  ['advanced.capabilities', advanced('Available controls')],
  ['advanced.validation', advanced('Validation status')],
  ['advanced.section', advanced('Page area')],
  ['advanced.layer', advanced('Layer path')],
  ['runtime.fontWeight', advanced('Font weight')],
  ['runtime.lineHeight', advanced('Line height', { advancedEditable: true })],
  ['runtime.textAlign', {
    label: 'Text alignment', category: 'font', categoryLabel: 'TYPOGRAPHY', categoryOrder: 10, order: 65,
    options: [
      { label: 'Left', value: 'left' }, { label: 'Center', value: 'center' },
      { label: 'Right', value: 'right' }, { label: 'Justify', value: 'justify' }
    ], classification: 'USER-FRIENDLY', friendlyUi: 'Left, center, right, or justified text alignment.'
  }],
  ['runtime.positionMode', advanced('Position behavior')],
  ['runtime.zIndex', advanced('Layer order')],
  ['runtime.backgroundColor', advanced('Background color')],
  ['runtime.backgroundGradient', advanced('Background gradient', { advancedEditable: true })],
  ['runtime.backgroundImage', advanced('Background image reference')],
  ['runtime.buttonTextColor', advanced('Button text color')],
  ['runtime.buttonBorderColor', advanced('Button border color')],
  ['runtime.buttonRadius', advanced('Button corner radius', { advancedEditable: true })],

  ['responsive.container.mode', {
    label: 'Layout style', order: 300, options: [
      { label: 'Normal', value: 'none' }, { label: 'Horizontal', value: 'row' }, { label: 'Vertical', value: 'column' },
      { label: 'Stack', value: 'stack' }, { label: 'Grid', value: 'grid' }
    ]
  }],
  ['responsive.container.wrap', { label: 'Wrap items', order: 310, hideWhenUnavailable: true }],
  ['responsive.container.gap', { label: 'Item spacing', order: 320, unit: 'px', hideWhenUnavailable: true }],
  ['responsive.container.justify', { label: 'Distribution', order: 330, hideWhenUnavailable: true }],
  ['responsive.grid.columns', { label: 'Columns', order: 340, rowKey: 'responsive-grid-count', hideWhenUnavailable: true }],
  ['responsive.grid.rows', { label: 'Rows', order: 341, rowKey: 'responsive-grid-count', hideWhenUnavailable: true }],
  ['responsive.grid.gap', { label: 'Grid spacing', order: 350, unit: 'px', hideWhenUnavailable: true }],
  ['responsive.grid.alignment', { label: 'Grid alignment', order: 360, hideWhenUnavailable: true }],
  ['responsive.grid.collapse', { label: 'One column on smaller screens', order: 370, hideWhenUnavailable: true }],
  ['responsive.visibility', advanced('Screen-specific visibility')],
  ['responsive.container.padding', advanced('Container padding', { advancedEditable: true })],
  ['responsive.container.margin', advanced('Container margin', { advancedEditable: true })],
  ['responsive.container.align', { label: 'Alignment', order: 331, hideWhenUnavailable: true }],
  ['responsive.grid.columnSpan', advanced('Column span')],
  ['responsive.grid.rowSpan', advanced('Row span')],
  ['responsive.flex.grow', advanced('Flexible growth')],
  ['responsive.flex.shrink', advanced('Flexible shrink')],
  ['responsive.flex.basis', advanced('Starting width', { advancedEditable: true })],
  ['responsive.flex.alignSelf', advanced('Individual alignment')],
  ['responsive.flex.justifySelf', advanced('Individual distribution')],
  ['responsive.constraint.horizontal', advanced('Horizontal constraint')],
  ['responsive.constraint.vertical', advanced('Vertical constraint')],
  ['responsive.safeArea', advanced('Mobile safe area')]
])

const dynamicPathDefinitions: Record<string, InspectorPresentationDefinition> = {
  targetSectionId: { label: 'Destination area' },
  href: { label: 'Link' },
  name: { label: 'Name or image description' },
  left: { mode: 'hidden', classification: 'DUPLICATE / REDUNDANT', problem: 'Legacy left is superseded by the selected-object X control.', friendlyUi: 'Use X in Typography, Media, or Layout.' },
  top: { mode: 'hidden', classification: 'DUPLICATE / REDUNDANT', problem: 'Legacy top is superseded by the selected-object Y control.', friendlyUi: 'Use Y in Typography, Media, or Layout.' },
  width: { mode: 'hidden', classification: 'DUPLICATE / REDUNDANT', problem: 'Legacy width is superseded by the selected-object dimension control.', friendlyUi: 'Use W in Media or Width in Layout.' },
  height: { mode: 'hidden', classification: 'DUPLICATE / REDUNDANT', problem: 'Legacy height is superseded by the selected-object dimension control.', friendlyUi: 'Use H in Media or Height in Layout.' },
  maxWidth: { mode: 'hidden', classification: 'DUPLICATE / REDUNDANT', problem: 'Legacy maximum width overlaps the selected-object dimension control.', friendlyUi: 'Use W in Media or Width in Layout.' },
  transformRotate: { mode: 'hidden', classification: 'DUPLICATE / REDUNDANT', problem: 'Legacy transform rotation is superseded by Rotate.', friendlyUi: 'Use Rotate in Typography, Media, or Layout.' },
  borderRadius: { mode: 'hidden', classification: 'DUPLICATE / REDUNDANT', problem: 'Legacy radius is superseded by the selected-object Radius control.', friendlyUi: 'Use Radius in Media or Effects.' },
  boxShadow: { mode: 'hidden', classification: 'DUPLICATE / REDUNDANT', problem: 'Legacy shadow is superseded by the selected-object Shadow control.', friendlyUi: 'Use Shadow in Typography or Effects.' },
  backgroundColor: advanced('Original frame background', { control: 'color' }),
  autoplay: advanced('Play automatically'),
  slideshowIntervalMs: advanced('Time between slides', { unit: 'ms' })
}

const shippedFontOptions = [
  { label: 'Inter', value: "'Inter', system-ui, sans-serif" },
  { label: 'Georgia', value: "Georgia, 'Times New Roman', serif" },
  { label: 'Impact', value: "'Impact', 'Arial Black', 'Franklin Gothic Heavy', sans-serif" },
  { label: 'Arial', value: "'Arial', sans-serif" }
]

function firstFontName(value: string): string {
  return value.split(',')[0]?.trim().replace(/^['"]|['"]$/g, '') || 'Current font'
}

export function inspectorFontOptions(currentValue: EditorValue): Array<{ label: string; value: string }> {
  const current = typeof currentValue === 'string' ? currentValue.trim() : ''
  const options = shippedFontOptions.map((option) => ({ ...option }))
  if (current && !options.some((option) => option.value === current)) {
    const currentLabel = firstFontName(current)
    const duplicateLabel = options.findIndex((option) => option.label.toLocaleLowerCase() === currentLabel.toLocaleLowerCase())
    if (duplicateLabel >= 0) options.splice(duplicateLabel, 1)
    options.unshift({ label: currentLabel, value: current })
  }
  return options
}

function fallbackDefinition(property: PropertyRegistryEntry): InspectorPresentationDefinition {
  if (property.propertyKey.startsWith('runtime.') && property.databaseMapping.kind === 'snapshot') return advanced(property.label)
  if (property.propertyKey.startsWith('advanced.')) return advanced(property.label)
  if (property.propertyKey.startsWith('runtime:') || property.databaseMapping.kind === 'runtime') {
    return dynamicPathDefinitions[property.propertyPath] ?? {}
  }
  return {}
}

function defaultClassification(property: PropertyRegistryEntry, definition: InspectorPresentationDefinition): InspectorPropertyClassification {
  if (definition.classification) return definition.classification
  if (definition.mode === 'advanced' || property.category === 'behavior') return 'ADVANCED ONLY'
  return 'USER-FRIENDLY'
}

export function resolveInspectorPresentation(
  property: PropertyRegistryEntry,
  objectType?: EditorObjectType
): ResolvedInspectorPresentation {
  const baseDefinition = { ...fallbackDefinition(property), ...(definitions.get(property.propertyKey) ?? {}) }
  const typeOverride = objectType
    ? baseDefinition.typeOverrides?.find((candidate) => candidate.objectTypes.includes(objectType))
    : undefined
  const definition = {
    ...baseDefinition,
    ...typeOverride,
    controlOptions: typeOverride?.controlOptions
      ? { ...baseDefinition.controlOptions, ...typeOverride.controlOptions }
      : baseDefinition.controlOptions
  }
  const sourceCategory = definition.category ?? property.category
  const category = categoryPresentation[sourceCategory] ?? {
    category: sourceCategory,
    categoryLabel: property.categoryLabel ?? sourceCategory.toUpperCase(),
    categoryOrder: property.categoryOrder ?? 80
  }
  const hiddenByType = Boolean(objectType && definition.hiddenForTypes?.includes(objectType))
  const advancedByType = Boolean(objectType && definition.advancedForTypes?.includes(objectType))
  const classification = hiddenByType
    ? 'DUPLICATE / REDUNDANT'
    : advancedByType
      ? 'ADVANCED ONLY'
      : defaultClassification(property, definition)
  return {
    label: definition.label ?? property.label,
    category: advancedByType ? 'advanced' : category.category,
    categoryLabel: advancedByType ? 'ADVANCED' : definition.categoryLabel ?? category.categoryLabel,
    categoryOrder: advancedByType ? 90 : definition.categoryOrder ?? category.categoryOrder,
    order: definition.order ?? property.order,
    rowKey: definition.rowKey ?? property.rowKey ?? property.propertyKey,
    mode: hiddenByType ? 'hidden' : advancedByType ? 'advanced' : definition.mode ?? 'simple',
    control: definition.control ?? property.control,
    adapter: definition.adapter ?? 'identity',
    unit: definition.unit ?? property.unit,
    minimum: definition.minimum ?? property.minimum,
    maximum: definition.maximum ?? property.maximum,
    step: definition.step ?? property.step,
    options: definition.options ?? property.options,
    controlOptions: definition.controlOptions ?? property.controlOptions,
    resolvedStyle: definition.resolvedStyle,
    classification,
    problem: definition.problem ?? (classification === 'USER-FRIENDLY' ? 'No default-mode usability issue.' : 'Presented according to its Inspector classification.'),
    friendlyUi: definition.friendlyUi ?? (definition.mode === 'advanced' ? 'Available in Advanced.' : definition.label ?? property.label),
    advancedRaw: definition.advancedRaw ?? false,
    advancedEditable: definition.advancedEditable ?? false,
    hideWhenUnavailable: definition.hideWhenUnavailable ?? false,
    helperText: definition.helperText ?? property.helperText
  }
}

function finiteNumber(value: EditorValue): number | null {
  const number = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''))
  return Number.isFinite(number) ? number : null
}

function rounded(value: number): number {
  return Number(value.toFixed(2))
}

function simplePixelValue(value: EditorValue): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const match = String(value ?? '').trim().match(/^(-?\d+(?:\.\d+)?)(?:px)?$/i)
  return match ? Number(match[1]) : null
}

function degreeValue(value: EditorValue): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const match = String(value ?? '').trim().match(/^(-?\d+(?:\.\d+)?)(?:deg)?$/i)
  return match ? Number(match[1]) : null
}

export function formatInspectorValue(
  presentation: ResolvedInspectorPresentation,
  canonicalValue: EditorValue,
  resolvedValue?: string
): string | number | boolean | null {
  if (presentation.adapter === 'css-pixels') {
    const direct = simplePixelValue(canonicalValue)
    const resolved = simplePixelValue(resolvedValue)
    return rounded(direct ?? resolved ?? 0)
  }
  if (presentation.adapter === 'rotation-degrees') return rounded(degreeValue(canonicalValue) ?? 0)
  if (presentation.adapter === 'opacity-percent') return rounded((finiteNumber(canonicalValue) ?? 1) * 100)
  if (presentation.adapter === 'font-family') return typeof canonicalValue === 'string' ? canonicalValue : ''
  return typeof canonicalValue === 'string' || typeof canonicalValue === 'number' || typeof canonicalValue === 'boolean' || canonicalValue === null
    ? canonicalValue
    : ''
}

export function parseInspectorValue(
  presentation: ResolvedInspectorPresentation,
  friendlyValue: string | number | boolean
): string | number | boolean {
  if (presentation.adapter === 'css-pixels') return `${finiteNumber(friendlyValue) ?? 0}px`
  if (presentation.adapter === 'rotation-degrees') return `${finiteNumber(friendlyValue) ?? 0}deg`
  if (presentation.adapter === 'opacity-percent') return Math.min(1, Math.max(0, (finiteNumber(friendlyValue) ?? 0) / 100))
  return friendlyValue
}

export function inspectorValueIsComplex(presentation: ResolvedInspectorPresentation, canonicalValue: EditorValue): boolean {
  if (presentation.adapter === 'css-pixels') return canonicalValue !== '' && canonicalValue !== null && canonicalValue !== undefined && simplePixelValue(canonicalValue) === null
  if (presentation.adapter === 'rotation-degrees') return canonicalValue !== '' && canonicalValue !== null && canonicalValue !== undefined && degreeValue(canonicalValue) === null
  return false
}

export function normalizeInspectorCategory(category: string): string {
  if (category === 'behavior') return 'advanced'
  if (category === 'responsive' || category === 'position') return 'layout'
  return category
}

export function listInspectorPresentationMetadata(): Array<{ propertyKey: string; definition: InspectorPresentationDefinition }> {
  return [...definitions.entries()].map(([propertyKey, definition]) => ({ propertyKey, definition: { ...definition } }))
}
