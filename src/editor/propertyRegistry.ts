import type {
  EditorControl,
  EditorPropertyType,
  EditorValue,
  EntityDescriptor,
  PropertyBinding,
  PropertyDependencyRule,
  PropertyPreviewUpdater,
  PropertyRegistryEntry,
  PropertySerializer,
  PropertyValidationRule,
  PropertyVisibilityContext
} from '../types/editor'
import type { EditorSnapshot } from '../types/editorSnapshot'

const always = () => true
const identitySerializer: PropertySerializer = {
  serialize: (value) => structuredClone(value),
  deserialize: (value) => structuredClone(value)
}
const stringSerializer: PropertySerializer = {
  serialize: (value) => value === null || value === undefined ? '' : String(value),
  deserialize: (value) => value === null || value === undefined ? '' : String(value)
}
const numberSerializer: PropertySerializer = {
  serialize: (value) => value === undefined || value === null || value === '' ? value : typeof value === 'number' ? value : Number(value),
  deserialize: (value) => value === undefined || value === null || value === '' ? value : typeof value === 'number' ? value : Number(value)
}
const booleanSerializer: PropertySerializer = {
  serialize: (value) => Boolean(value),
  deserialize: (value) => Boolean(value)
}

const serializerByType: Record<EditorPropertyType, PropertySerializer> = {
  string: stringSerializer,
  number: numberSerializer,
  boolean: booleanSerializer,
  color: stringSerializer,
  asset: stringSerializer,
  enum: stringSerializer,
  metadata: identitySerializer
}

const optional = (validate: (value: EditorValue) => string | null): PropertyValidationRule => ({
  validate: (value) => value === undefined || value === null || value === '' ? null : validate(value)
})
const validString = (maximum = 512): PropertyValidationRule => optional((value) => (
  typeof value === 'string' && value.length <= maximum ? null : `Must be text with at most ${maximum} characters.`
))
const validNumber = (minimum = -100000, maximum = 100000): PropertyValidationRule => optional((value) => (
  typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum
    ? null
    : `Must be a number from ${minimum} to ${maximum}.`
))
const validBoolean: PropertyValidationRule = optional((value) => typeof value === 'boolean' ? null : 'Must be enabled or disabled.')
const colorPattern = /^(?:#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})|rgba?\([^)]{1,80}\)|hsla?\([^)]{1,80}\)|transparent|currentColor)$/i
const cssLengthPattern = /^-?\d+(?:\.\d+)?(?:px|rem|em|%|vw|vh|vmin|vmax|ch|ex)?$/i
const cssLengthFunctionPattern = /^(?:calc|clamp|min|max|var|fit-content)\([^;{}]{1,256}\)$/i
const validColor: PropertyValidationRule = optional((value) => typeof value === 'string' && colorPattern.test(value) ? null : 'Enter a valid CSS color.')
const validCssLength = (allowAuto = false, positive = false): PropertyValidationRule => optional((value) => {
  if (typeof value === 'number') return Number.isFinite(value) && (!positive || value >= 0) ? null : 'Enter a valid CSS length.'
  if (typeof value !== 'string') return 'Enter a valid CSS length.'
  if (allowAuto && value === 'auto') return null
  if (cssLengthFunctionPattern.test(value)) return null
  if (!cssLengthPattern.test(value)) return 'Enter a valid CSS length.'
  return positive && Number.parseFloat(value) < 0 ? 'Length cannot be negative.' : null
})
const validCssLengthOrNormal: PropertyValidationRule = optional((value) => value === 'normal'
  ? null
  : validCssLength().validate(value, {} as PropertyVisibilityContext))
const validRotation: PropertyValidationRule = optional((value) => (
  (typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 36000)
  || (typeof value === 'string' && /^-?\d+(?:\.\d+)?(?:deg|rad|turn)$/i.test(value))
    ? null
    : 'Enter a valid rotation from -36000 to 36000 degrees.'
))
const validEnum = (values: string[]): PropertyValidationRule => optional((value) => (
  typeof value === 'string' && values.includes(value) ? null : `Choose one of: ${values.join(', ')}.`
))
const validMetadata: PropertyValidationRule = { validate: () => null }

const validationByType: Record<EditorPropertyType, PropertyValidationRule> = {
  string: validString(),
  number: validNumber(),
  boolean: validBoolean,
  color: validColor,
  asset: validString(2048),
  enum: validString(128),
  metadata: validMetadata
}

const dependency = (
  keys: string[] = [],
  enabled: PropertyDependencyRule['enabled'] = always
): PropertyDependencyRule => ({ keys, enabled })
const supports = (capability: string): PropertyDependencyRule => dependency([], ({ entity }) => entity.capabilities.includes(capability))
const outlineDependency = dependency(['media.outlineEnabled'], ({ entity, values }) => (
  entity.capabilities.includes('media-outline') && values['media.outlineEnabled'] === true
))

const noPreview: PropertyPreviewUpdater = { styles: [], update: () => undefined }
const stylePreview = (
  property: string,
  formatter: (value: EditorValue) => string = (value) => value === undefined || value === null ? '' : String(value)
): PropertyPreviewUpdater => ({
  styles: [property],
  update: ({ setStyle }, value) => setStyle(property, formatter(value))
})
export const createStylePreviewUpdater = stylePreview
const classStylePreview = (
  property: string,
  className: string,
  formatter: (value: EditorValue) => string = (value) => value === undefined || value === null ? '' : String(value)
): PropertyPreviewUpdater => ({
  styles: [property],
  classes: [className],
  update: ({ setStyle, toggleClass }, value) => {
    const formatted = formatter(value)
    setStyle(property, formatted)
    toggleClass(className, Boolean(formatted))
  }
})
const cssLength = (value: EditorValue) => typeof value === 'number' ? `${value}px` : value === undefined || value === null ? '' : String(value)
const cssRotation = (value: EditorValue) => {
  if (typeof value === 'number') return `${value}deg`
  if (!value) return ''
  return /[a-z%]/i.test(String(value)) ? String(value) : `${String(value)}deg`
}
const outlinePreview: PropertyPreviewUpdater = {
  styles: ['outline'],
  update: ({ entityId, snapshot, setStyle }) => {
    const settings = snapshot.media.styles[entityId]
    setStyle('outline', settings?.outlineEnabled ? `${settings.outlineWidth ?? 1}px solid currentColor` : '')
  }
}
const translatePreview: PropertyPreviewUpdater = {
  styles: ['translate'],
  update: ({ entityId, snapshot, setStyle }) => {
    const layout = snapshot.layout[entityId]
    const x = cssLength(layout?.x)
    const y = cssLength(layout?.y)
    setStyle('translate', x || y ? `${x || '0px'} ${y || '0px'}` : '')
  }
}
const blurPreview = stylePreview('filter', (value) => typeof value === 'number' && value > 0 ? `blur(${value}px)` : '')
const backgroundImagePreview: PropertyPreviewUpdater = {
  styles: ['background-image'],
  update: ({ snapshot, setStyle }, value) => {
    const reference = typeof value === 'string' ? snapshot.media.references.find((candidate) => candidate.assetId === value) : undefined
    setStyle('background-image', reference ? `url("${reference.uri.replaceAll('"', '%22')}")` : '')
  }
}
const animationPreview = (
  property: string,
  formatter: (value: EditorValue) => string = (value) => value === undefined || value === null ? '' : String(value)
): PropertyPreviewUpdater => ({
  styles: [property],
  update: ({ entityId, snapshot, setStyle }, value) => {
    const animation = snapshot.animations[entityId]
    setStyle(property, animation?.enabled && animation.name ? formatter(value) : '')
  }
})

export interface PropertyDefinition extends Pick<PropertyRegistryEntry,
  'propertyKey' | 'category' | 'label' | 'control' | 'type' | 'order' | 'commandType' | 'capability' | 'propertyPath' | 'databaseMapping'
> {
  categoryLabel?: string
  categoryOrder?: number
  categoryDefaultOpen?: boolean
  presentation?: PropertyRegistryEntry['presentation']
  rowKey?: string
  placeholder?: string
  helperText?: string
  accept?: string
  defaultValue?: EditorValue
  validation?: PropertyValidationRule
  dependency?: PropertyDependencyRule
  serializer?: PropertySerializer
  previewUpdater?: PropertyPreviewUpdater
  styleKey?: string
  copyable?: boolean
  readOnly?: boolean
  unit?: string
  options?: PropertyRegistryEntry['options']
  searchTerms?: string[]
  step?: number
  minimum?: number
  maximum?: number
  enabledValue?: EditorValue
  visibilityRule?: PropertyRegistryEntry['visibilityRule']
  enabledRule?: PropertyRegistryEntry['enabledRule']
}

function defineProperty(definition: PropertyDefinition): PropertyRegistryEntry {
  const normalized: PropertyRegistryEntry = {
    ...definition,
    categoryLabel: definition.categoryLabel ?? definition.category.toUpperCase(),
    categoryOrder: definition.categoryOrder ?? 100,
    categoryDefaultOpen: definition.categoryDefaultOpen ?? false,
    presentation: definition.presentation ?? 'accordion',
    valueType: definition.type,
    binding: definition.databaseMapping,
    defaultValue: definition.defaultValue ?? null,
    validation: definition.validation ?? validationByType[definition.type],
    dependency: definition.dependency ?? dependency(),
    serializer: definition.serializer ?? serializerByType[definition.type],
    previewUpdater: definition.previewUpdater ?? noPreview,
    copyable: definition.copyable ?? definition.databaseMapping.kind === 'snapshot',
    dependencyKeys: definition.dependency?.keys ?? [],
    enabledRule: definition.enabledRule ?? definition.dependency?.enabled
  }
  return normalized
}

export function createPropertyMetadata(definition: PropertyDefinition): PropertyRegistryEntry {
  return defineProperty(definition)
}

const snapshot = (path: string): PropertyBinding => ({ kind: 'snapshot', path })
const metadata = (field: Extract<PropertyBinding, { kind: 'metadata' }>['field']): PropertyBinding => ({ kind: 'metadata', field })
const action = (name: Extract<PropertyBinding, { kind: 'action' }>['action']): PropertyBinding => ({ kind: 'action', action: name })
const hidden = () => false

const entries: PropertyRegistryEntry[] = [
  defineProperty({ propertyKey: 'font.family', category: 'font', categoryLabel: 'TYPOGRAPHY', categoryOrder: 10, categoryDefaultOpen: true, label: 'Font', control: 'text', type: 'string', order: 10, commandType: 'SET_PROPERTY', capability: 'typography', propertyPath: 'fontFamily', databaseMapping: snapshot('typography.{entityId}.fontFamily'), defaultValue: '', placeholder: 'Font family', validation: validString(160), previewUpdater: stylePreview('font-family'), styleKey: 'typography.fontFamily' }),
  defineProperty({ propertyKey: 'font.size', category: 'font', categoryLabel: 'TYPOGRAPHY', categoryOrder: 10, categoryDefaultOpen: true, label: 'Size', control: 'text', type: 'string', order: 20, rowKey: 'font-size-spacing', commandType: 'SET_PROPERTY', capability: 'typography', propertyPath: 'fontSize', databaseMapping: snapshot('typography.{entityId}.fontSize'), defaultValue: '', placeholder: 'e.g. 64px', validation: validCssLength(false, true), previewUpdater: stylePreview('font-size'), styleKey: 'typography.fontSize' }),
  defineProperty({ propertyKey: 'font.spacing', category: 'font', categoryLabel: 'TYPOGRAPHY', categoryOrder: 10, categoryDefaultOpen: true, label: 'Spacing', control: 'text', type: 'string', order: 30, rowKey: 'font-size-spacing', commandType: 'SET_PROPERTY', capability: 'typography', propertyPath: 'letterSpacing', databaseMapping: snapshot('typography.{entityId}.letterSpacing'), defaultValue: '', placeholder: 'e.g. 0.04em', validation: validCssLengthOrNormal, previewUpdater: stylePreview('letter-spacing'), styleKey: 'typography.letterSpacing' }),
  defineProperty({ propertyKey: 'font.color', category: 'font', categoryLabel: 'TYPOGRAPHY', categoryOrder: 10, categoryDefaultOpen: true, label: 'Color', control: 'color', type: 'color', order: 40, commandType: 'SET_PROPERTY', capability: 'typography', propertyPath: 'color', databaseMapping: snapshot('typography.{entityId}.color'), defaultValue: '#49362f', validation: validColor, previewUpdater: stylePreview('color'), styleKey: 'typography.color', searchTerms: ['color'] }),
  defineProperty({ propertyKey: 'font.shadow', category: 'font', categoryLabel: 'TYPOGRAPHY', categoryOrder: 10, categoryDefaultOpen: true, label: 'Text Shadow', control: 'toggle-text', type: 'string', order: 50, commandType: 'SET_PROPERTY', capability: 'typography', propertyPath: 'textShadow', databaseMapping: snapshot('typography.{entityId}.textShadow'), defaultValue: '', enabledValue: '0 4px 14px rgba(73,54,47,.24)', placeholder: 'CSS text shadow', validation: validString(256), previewUpdater: stylePreview('text-shadow'), styleKey: 'typography.textShadow' }),
  defineProperty({ propertyKey: 'font.hover', category: 'font', categoryLabel: 'TYPOGRAPHY', categoryOrder: 10, categoryDefaultOpen: true, label: 'Hover', control: 'toggle-color', type: 'color', order: 60, commandType: 'SET_PROPERTY', capability: 'typography', propertyPath: 'hoverColor', databaseMapping: snapshot('typography.{entityId}.hoverColor'), defaultValue: '', enabledValue: '#49362f', validation: validColor, dependency: supports('font-hover'), helperText: 'Not available for this element.', previewUpdater: classStylePreview('--snapshot-runtime-hover-color', 'snapshot-runtime-hover-color'), styleKey: 'typography.hoverColor' }),
  defineProperty({ propertyKey: 'font.positionX', category: 'font', categoryLabel: 'TYPOGRAPHY', categoryOrder: 10, categoryDefaultOpen: true, label: 'Position X', control: 'number', type: 'number', order: 70, rowKey: 'font-position', commandType: 'SET_PROPERTY', capability: 'typography', propertyPath: 'x', databaseMapping: snapshot('layout.{entityId}.x'), defaultValue: 0, validation: validCssLength(), dependency: supports('position'), helperText: 'Not available for this element.', step: 1, previewUpdater: translatePreview, styleKey: 'layout.x' }),
  defineProperty({ propertyKey: 'font.positionY', category: 'font', categoryLabel: 'TYPOGRAPHY', categoryOrder: 10, categoryDefaultOpen: true, label: 'Position Y', control: 'number', type: 'number', order: 80, rowKey: 'font-position', commandType: 'SET_PROPERTY', capability: 'typography', propertyPath: 'y', databaseMapping: snapshot('layout.{entityId}.y'), defaultValue: 0, validation: validCssLength(), dependency: supports('position'), helperText: 'Not available for this element.', step: 1, previewUpdater: translatePreview, styleKey: 'layout.y' }),
  defineProperty({ propertyKey: 'font.rotate', category: 'font', categoryLabel: 'TYPOGRAPHY', categoryOrder: 10, categoryDefaultOpen: true, label: 'Rotation', control: 'number', type: 'number', order: 90, commandType: 'SET_PROPERTY', capability: 'typography', propertyPath: 'rotation', databaseMapping: snapshot('layout.{entityId}.rotation'), defaultValue: 0, validation: validRotation, visibilityRule: ({ entity }) => entity.capabilities.includes('rotate'), unit: 'deg', step: 1, previewUpdater: stylePreview('rotate', cssRotation), styleKey: 'layout.rotation' }),

  defineProperty({ propertyKey: 'media.preview', category: 'media', categoryLabel: 'MEDIA', categoryOrder: 20, label: 'Preview', control: 'thumbnail', type: 'asset', order: 5, commandType: 'SET_PROPERTY', capability: 'media', propertyPath: 'reference', databaseMapping: action('preview-media'), defaultValue: '', readOnly: true, copyable: false }),
  defineProperty({ propertyKey: 'media.upload', category: 'media', categoryLabel: 'MEDIA', categoryOrder: 20, label: 'Upload', control: 'file', type: 'asset', order: 10, commandType: 'UPLOAD_MEDIA', capability: 'media', propertyPath: 'reference', databaseMapping: action('upload-media'), defaultValue: '', accept: 'image/*', copyable: false }),
  defineProperty({ propertyKey: 'media.choose', category: 'media', categoryLabel: 'MEDIA', categoryOrder: 20, label: 'Media Picker', control: 'select', type: 'asset', order: 20, commandType: 'SET_IMAGE_REFERENCE', capability: 'media', propertyPath: 'reference', databaseMapping: action('choose-media'), defaultValue: '', placeholder: 'Select existing media', helperText: 'No repository media is available.', copyable: false }),
  defineProperty({ propertyKey: 'media.replace', category: 'media', categoryLabel: 'MEDIA', categoryOrder: 20, label: 'Replace', control: 'file', type: 'asset', order: 30, commandType: 'REPLACE_MEDIA', capability: 'media', propertyPath: 'reference', databaseMapping: action('replace-media'), defaultValue: '', accept: 'image/*', copyable: false }),
  defineProperty({ propertyKey: 'media.crop', category: 'media', categoryLabel: 'MEDIA', categoryOrder: 20, label: 'Crop focus', control: 'select', type: 'enum', order: 35, commandType: 'SET_PROPERTY', capability: 'media', propertyPath: 'objectPosition', databaseMapping: action('set-media-crop'), defaultValue: '50% 50%', options: [
    { label: 'Center', value: '50% 50%' }, { label: 'Top', value: '50% 0%' }, { label: 'Bottom', value: '50% 100%' }, { label: 'Left', value: '0% 50%' }, { label: 'Right', value: '100% 50%' }
  ], copyable: false }),
  defineProperty({ propertyKey: 'media.fit', category: 'media', categoryLabel: 'MEDIA', categoryOrder: 20, label: 'Fit', control: 'segmented', type: 'enum', order: 36, commandType: 'SET_PROPERTY', capability: 'media', propertyPath: 'objectFit', databaseMapping: action('set-media-fit'), defaultValue: 'cover', options: [
    { label: 'Fit', value: 'scale-down' }, { label: 'Fill', value: 'cover' }, { label: 'Contain', value: 'contain' }
  ], validation: validEnum(['scale-down', 'cover', 'contain']), dependency: supports('media-fit'), helperText: 'Not available for this element.', copyable: false }),
  defineProperty({ propertyKey: 'media.width', category: 'media', categoryLabel: 'MEDIA', categoryOrder: 20, label: 'Width', control: 'text', type: 'string', order: 40, rowKey: 'media-size', commandType: 'SET_PROPERTY', capability: 'media', propertyPath: 'width', databaseMapping: snapshot('layout.{entityId}.width'), defaultValue: '', placeholder: 'Auto', validation: validCssLength(true, true), dependency: supports('media-dimensions'), helperText: 'Not available for this element.', previewUpdater: stylePreview('width', cssLength), styleKey: 'layout.width' }),
  defineProperty({ propertyKey: 'media.height', category: 'media', categoryLabel: 'MEDIA', categoryOrder: 20, label: 'Height', control: 'text', type: 'string', order: 50, rowKey: 'media-size', commandType: 'SET_PROPERTY', capability: 'media', propertyPath: 'height', databaseMapping: snapshot('layout.{entityId}.height'), defaultValue: '', placeholder: 'Auto', validation: validCssLength(true, true), dependency: supports('media-dimensions'), helperText: 'Not available for this element.', previewUpdater: stylePreview('height', cssLength), styleKey: 'layout.height' }),
  defineProperty({ propertyKey: 'media.hover', category: 'media', categoryLabel: 'MEDIA', categoryOrder: 20, label: 'Hover', control: 'checkbox', type: 'boolean', order: 60, commandType: 'SET_PROPERTY', capability: 'media', propertyPath: 'hoverEnabled', databaseMapping: snapshot('media.styles.{entityId}.hoverEnabled'), defaultValue: false, validation: validBoolean, dependency: supports('media-hover'), helperText: 'Not available for this element.', styleKey: 'media.hoverEnabled' }),
  defineProperty({ propertyKey: 'media.opacity', category: 'media', categoryLabel: 'MEDIA', categoryOrder: 20, label: 'Opacity', control: 'number', type: 'number', order: 62, commandType: 'SET_PROPERTY', capability: 'media', propertyPath: 'opacity', databaseMapping: snapshot('backgrounds.{entityId}.opacity'), defaultValue: 1, validation: validNumber(0, 1), minimum: 0, maximum: 1, step: 0.1, previewUpdater: stylePreview('opacity'), styleKey: 'effects.opacity' }),
  defineProperty({ propertyKey: 'media.border', category: 'media', categoryLabel: 'MEDIA', categoryOrder: 20, label: 'Border', control: 'text', type: 'string', order: 64, commandType: 'SET_PROPERTY', capability: 'media', propertyPath: 'border', databaseMapping: snapshot('backgrounds.{entityId}.border'), defaultValue: '', placeholder: 'e.g. 1px solid #49362f', validation: validString(256), previewUpdater: stylePreview('border'), styleKey: 'effects.border' }),
  defineProperty({ propertyKey: 'media.radius', category: 'media', categoryLabel: 'MEDIA', categoryOrder: 20, label: 'Radius', control: 'text', type: 'string', order: 66, commandType: 'SET_PROPERTY', capability: 'media', propertyPath: 'borderRadius', databaseMapping: snapshot('backgrounds.{entityId}.borderRadius'), defaultValue: '', placeholder: 'e.g. 12px', validation: validCssLength(false, true), previewUpdater: stylePreview('border-radius'), styleKey: 'effects.borderRadius' }),
  defineProperty({ propertyKey: 'media.positionX', category: 'media', categoryLabel: 'MEDIA', categoryOrder: 20, label: 'Position X', control: 'number', type: 'number', order: 70, rowKey: 'media-position', commandType: 'SET_PROPERTY', capability: 'media', propertyPath: 'x', databaseMapping: snapshot('layout.{entityId}.x'), defaultValue: 0, validation: validCssLength(), dependency: supports('position'), helperText: 'Not available for this element.', step: 1, previewUpdater: translatePreview, styleKey: 'layout.x' }),
  defineProperty({ propertyKey: 'media.positionY', category: 'media', categoryLabel: 'MEDIA', categoryOrder: 20, label: 'Position Y', control: 'number', type: 'number', order: 80, rowKey: 'media-position', commandType: 'SET_PROPERTY', capability: 'media', propertyPath: 'y', databaseMapping: snapshot('layout.{entityId}.y'), defaultValue: 0, validation: validCssLength(), dependency: supports('position'), helperText: 'Not available for this element.', step: 1, previewUpdater: translatePreview, styleKey: 'layout.y' }),
  defineProperty({ propertyKey: 'media.outlineEnabled', category: 'media', categoryLabel: 'MEDIA', categoryOrder: 20, label: 'Outline', control: 'checkbox', type: 'boolean', order: 90, commandType: 'SET_PROPERTY', capability: 'media', propertyPath: 'outlineEnabled', databaseMapping: snapshot('media.styles.{entityId}.outlineEnabled'), defaultValue: false, validation: validBoolean, dependency: supports('media-outline'), helperText: 'Not available for this element.', previewUpdater: outlinePreview, styleKey: 'media.outlineEnabled' }),
  defineProperty({ propertyKey: 'media.outlineWidth', category: 'media', categoryLabel: 'MEDIA', categoryOrder: 20, label: 'Outline Thickness', control: 'number', type: 'number', order: 100, commandType: 'SET_PROPERTY', capability: 'media', propertyPath: 'outlineWidth', databaseMapping: snapshot('media.styles.{entityId}.outlineWidth'), defaultValue: 1, validation: validNumber(0, 64), dependency: outlineDependency, helperText: 'Enable Outline to change thickness.', unit: 'px', previewUpdater: outlinePreview, styleKey: 'media.outlineWidth' }),
  defineProperty({ propertyKey: 'media.rotate', category: 'media', categoryLabel: 'MEDIA', categoryOrder: 20, label: 'Rotation', control: 'number', type: 'number', order: 110, commandType: 'SET_PROPERTY', capability: 'media', propertyPath: 'rotation', databaseMapping: snapshot('layout.{entityId}.rotation'), defaultValue: 0, validation: validRotation, visibilityRule: ({ entity }) => entity.capabilities.includes('rotate'), unit: 'deg', step: 1, previewUpdater: stylePreview('rotate', cssRotation), styleKey: 'layout.rotation' }),

  defineProperty({ propertyKey: 'layout.margin', category: 'layout', categoryLabel: 'LAYOUT', categoryOrder: 30, label: 'Margin', control: 'text', type: 'string', order: 10, rowKey: 'layout-spacing', commandType: 'SET_PROPERTY', capability: 'layout', propertyPath: 'margin', databaseMapping: snapshot('layout.{entityId}.margin'), defaultValue: '', validation: validString(128), previewUpdater: stylePreview('margin'), styleKey: 'layout.margin' }),
  defineProperty({ propertyKey: 'layout.padding', category: 'layout', categoryLabel: 'LAYOUT', categoryOrder: 30, label: 'Padding', control: 'text', type: 'string', order: 20, rowKey: 'layout-spacing', commandType: 'SET_PROPERTY', capability: 'layout', propertyPath: 'padding', databaseMapping: snapshot('layout.{entityId}.padding'), defaultValue: '', validation: validString(128), previewUpdater: stylePreview('padding'), styleKey: 'layout.padding' }),
  defineProperty({ propertyKey: 'layout.alignment', category: 'layout', categoryLabel: 'LAYOUT', categoryOrder: 30, label: 'Alignment', control: 'select', type: 'enum', order: 30, commandType: 'SET_PROPERTY', capability: 'layout', propertyPath: 'alignment', databaseMapping: snapshot('layout.{entityId}.alignment'), defaultValue: 'start', options: ['start', 'center', 'end', 'stretch', 'space-between', 'space-around'].map((value) => ({ label: value, value })), validation: validEnum(['start', 'center', 'end', 'stretch', 'space-between', 'space-around']), previewUpdater: stylePreview('justify-content'), styleKey: 'layout.alignment' }),
  defineProperty({ propertyKey: 'layout.display', category: 'layout', categoryLabel: 'LAYOUT', categoryOrder: 30, label: 'Display', control: 'select', type: 'enum', order: 40, commandType: 'SET_PROPERTY', capability: 'layout', propertyPath: 'display', databaseMapping: snapshot('layout.{entityId}.display'), defaultValue: 'block', options: ['block', 'inline', 'inline-block', 'flex', 'grid', 'none'].map((value) => ({ label: value, value })), validation: validEnum(['block', 'inline', 'inline-block', 'flex', 'grid', 'none']), previewUpdater: stylePreview('display'), styleKey: 'layout.display' }),
  defineProperty({ propertyKey: 'layout.visibility', category: 'layout', categoryLabel: 'LAYOUT', categoryOrder: 30, label: 'Visibility', control: 'select', type: 'enum', order: 50, commandType: 'SET_PROPERTY', capability: 'layout', propertyPath: 'visibility', databaseMapping: snapshot('layout.{entityId}.visibility'), defaultValue: 'visible', options: [{ label: 'Visible', value: 'visible' }, { label: 'Hidden in Published Runtime', value: 'hidden' }], validation: validEnum(['visible', 'hidden']), previewUpdater: stylePreview('visibility'), styleKey: 'layout.visibility' }),

  defineProperty({ propertyKey: 'position.x', category: 'layout', categoryLabel: 'LAYOUT', categoryOrder: 30, label: 'X', control: 'number', type: 'number', order: 60, rowKey: 'position-xy', commandType: 'SET_PROPERTY', capability: 'position', propertyPath: 'x', databaseMapping: snapshot('layout.{entityId}.x'), defaultValue: 0, validation: validCssLength(), step: 1, previewUpdater: translatePreview, styleKey: 'layout.x' }),
  defineProperty({ propertyKey: 'position.y', category: 'layout', categoryLabel: 'LAYOUT', categoryOrder: 30, label: 'Y', control: 'number', type: 'number', order: 70, rowKey: 'position-xy', commandType: 'SET_PROPERTY', capability: 'position', propertyPath: 'y', databaseMapping: snapshot('layout.{entityId}.y'), defaultValue: 0, validation: validCssLength(), step: 1, previewUpdater: translatePreview, styleKey: 'layout.y' }),
  defineProperty({ propertyKey: 'position.width', category: 'layout', categoryLabel: 'LAYOUT', categoryOrder: 30, label: 'Width', control: 'text', type: 'string', order: 80, rowKey: 'position-size', commandType: 'SET_PROPERTY', capability: 'position', propertyPath: 'width', databaseMapping: snapshot('layout.{entityId}.width'), defaultValue: '', validation: validCssLength(true, true), previewUpdater: stylePreview('width', cssLength), styleKey: 'layout.width' }),
  defineProperty({ propertyKey: 'position.height', category: 'layout', categoryLabel: 'LAYOUT', categoryOrder: 30, label: 'Height', control: 'text', type: 'string', order: 90, rowKey: 'position-size', commandType: 'SET_PROPERTY', capability: 'position', propertyPath: 'height', databaseMapping: snapshot('layout.{entityId}.height'), defaultValue: '', validation: validCssLength(true, true), previewUpdater: stylePreview('height', cssLength), styleKey: 'layout.height' }),
  defineProperty({ propertyKey: 'position.rotation', category: 'layout', categoryLabel: 'LAYOUT', categoryOrder: 30, label: 'Rotation', control: 'number', type: 'number', order: 100, commandType: 'SET_PROPERTY', capability: 'position', propertyPath: 'rotation', databaseMapping: snapshot('layout.{entityId}.rotation'), defaultValue: 0, validation: validRotation, visibilityRule: ({ entity }) => entity.capabilities.includes('rotate'), step: 1, previewUpdater: stylePreview('rotate', cssRotation), styleKey: 'layout.rotation' }),

  defineProperty({ propertyKey: 'effects.opacity', category: 'effects', categoryLabel: 'EFFECTS', categoryOrder: 50, label: 'Opacity', control: 'number', type: 'number', order: 10, commandType: 'SET_PROPERTY', capability: 'effects', propertyPath: 'opacity', databaseMapping: snapshot('backgrounds.{entityId}.opacity'), defaultValue: 1, validation: validNumber(0, 1), minimum: 0, maximum: 1, step: 0.1, previewUpdater: stylePreview('opacity'), styleKey: 'effects.opacity' }),
  defineProperty({ propertyKey: 'effects.shadow', category: 'effects', categoryLabel: 'EFFECTS', categoryOrder: 50, label: 'Shadow', control: 'toggle-text', type: 'string', order: 20, commandType: 'SET_PROPERTY', capability: 'effects', propertyPath: 'boxShadow', databaseMapping: snapshot('backgrounds.{entityId}.boxShadow'), defaultValue: '', enabledValue: '0 12px 32px rgba(73,54,47,.2)', placeholder: 'CSS box shadow', validation: validString(256), previewUpdater: stylePreview('box-shadow'), styleKey: 'effects.boxShadow', searchTerms: ['shadow'] }),
  defineProperty({ propertyKey: 'effects.blur', category: 'effects', categoryLabel: 'EFFECTS', categoryOrder: 50, label: 'Blur', control: 'number', type: 'number', order: 30, commandType: 'SET_PROPERTY', capability: 'effects', propertyPath: 'blur', databaseMapping: snapshot('backgrounds.{entityId}.blur'), defaultValue: 0, validation: validNumber(0, 100), unit: 'px', previewUpdater: blurPreview, styleKey: 'effects.blur' }),
  defineProperty({ propertyKey: 'effects.border', category: 'effects', categoryLabel: 'EFFECTS', categoryOrder: 50, label: 'Border', control: 'text', type: 'string', order: 40, commandType: 'SET_PROPERTY', capability: 'effects', propertyPath: 'border', databaseMapping: snapshot('backgrounds.{entityId}.border'), defaultValue: '', placeholder: 'e.g. 1px solid #49362f', validation: validString(256), previewUpdater: stylePreview('border'), styleKey: 'effects.border' }),
  defineProperty({ propertyKey: 'effects.radius', category: 'effects', categoryLabel: 'EFFECTS', categoryOrder: 50, label: 'Radius', control: 'text', type: 'string', order: 50, commandType: 'SET_PROPERTY', capability: 'effects', propertyPath: 'borderRadius', databaseMapping: snapshot('backgrounds.{entityId}.borderRadius'), defaultValue: '', validation: validCssLength(false, true), previewUpdater: stylePreview('border-radius'), styleKey: 'effects.borderRadius' }),
  defineProperty({ propertyKey: 'effects.background', category: 'effects', categoryLabel: 'EFFECTS', categoryOrder: 50, label: 'Background', control: 'color', type: 'color', order: 60, commandType: 'SET_PROPERTY', capability: 'button-background', propertyPath: 'backgroundColor', databaseMapping: snapshot('buttons.{entityId}.backgroundColor'), defaultValue: '#fffaf4', validation: validColor, previewUpdater: stylePreview('background-color'), styleKey: 'button.backgroundColor' }),

  defineProperty({ propertyKey: 'advanced.objectId', category: 'behavior', categoryLabel: 'BEHAVIOR', categoryOrder: 60, label: 'Object ID', control: 'readonly', type: 'metadata', order: 10, commandType: 'SET_PROPERTY', capability: 'advanced', propertyPath: 'objectId', databaseMapping: metadata('objectId'), defaultValue: '', validation: validMetadata, readOnly: true, copyable: false }),
  defineProperty({ propertyKey: 'advanced.capabilities', category: 'behavior', categoryLabel: 'BEHAVIOR', categoryOrder: 60, label: 'Capabilities', control: 'readonly', type: 'metadata', order: 20, commandType: 'SET_PROPERTY', capability: 'advanced', propertyPath: 'capabilities', databaseMapping: metadata('capabilities'), defaultValue: '', validation: validMetadata, readOnly: true, copyable: false }),
  defineProperty({ propertyKey: 'advanced.validation', category: 'behavior', categoryLabel: 'BEHAVIOR', categoryOrder: 60, label: 'Validation status', control: 'readonly', type: 'metadata', order: 30, commandType: 'SET_PROPERTY', capability: 'advanced', propertyPath: 'validationStatus', databaseMapping: metadata('validationStatus'), defaultValue: 'Valid', validation: validMetadata, readOnly: true, copyable: false }),
  defineProperty({ propertyKey: 'advanced.section', category: 'behavior', categoryLabel: 'BEHAVIOR', categoryOrder: 60, label: 'Section', control: 'readonly', type: 'metadata', order: 40, commandType: 'SET_PROPERTY', capability: 'advanced', propertyPath: 'section', databaseMapping: metadata('section'), defaultValue: '', validation: validMetadata, readOnly: true, copyable: false }),
  defineProperty({ propertyKey: 'advanced.layer', category: 'behavior', categoryLabel: 'BEHAVIOR', categoryOrder: 60, label: 'Layer', control: 'readonly', type: 'metadata', order: 50, commandType: 'SET_PROPERTY', capability: 'advanced', propertyPath: 'layer', databaseMapping: metadata('layer'), defaultValue: '', validation: validMetadata, readOnly: true, copyable: false }),

  // Runtime-only mappings keep the canonical Guest renderer complete even when a field is not exposed in this Inspector layout.
  defineProperty({ propertyKey: 'runtime.fontWeight', category: 'font', label: 'Weight', control: 'number', type: 'number', order: 900, commandType: 'SET_PROPERTY', capability: 'typography', propertyPath: 'fontWeight', databaseMapping: snapshot('typography.{entityId}.fontWeight'), defaultValue: 400, validation: validNumber(100, 900), previewUpdater: stylePreview('font-weight'), visibilityRule: hidden, styleKey: 'typography.fontWeight' }),
  defineProperty({ propertyKey: 'runtime.lineHeight', category: 'font', label: 'Line height', control: 'text', type: 'string', order: 901, commandType: 'SET_PROPERTY', capability: 'typography', propertyPath: 'lineHeight', databaseMapping: snapshot('typography.{entityId}.lineHeight'), defaultValue: '', validation: validCssLengthOrNormal, previewUpdater: stylePreview('line-height'), visibilityRule: hidden, styleKey: 'typography.lineHeight' }),
  defineProperty({ propertyKey: 'runtime.textAlign', category: 'layout', label: 'Text align', control: 'select', type: 'enum', order: 902, commandType: 'SET_PROPERTY', capability: 'typography', propertyPath: 'textAlign', databaseMapping: snapshot('typography.{entityId}.textAlign'), defaultValue: 'left', validation: validEnum(['left', 'center', 'right', 'justify']), previewUpdater: stylePreview('text-align'), visibilityRule: hidden, styleKey: 'typography.textAlign' }),
  defineProperty({ propertyKey: 'runtime.positionMode', category: 'position', label: 'Position mode', control: 'select', type: 'enum', order: 903, commandType: 'SET_PROPERTY', capability: 'position', propertyPath: 'positionMode', databaseMapping: snapshot('layout.{entityId}.positionMode'), defaultValue: 'flow', validation: validEnum(['flow', 'absolute']), previewUpdater: stylePreview('position', (value) => value === 'absolute' ? 'absolute' : ''), visibilityRule: hidden, styleKey: 'layout.positionMode' }),
  defineProperty({ propertyKey: 'runtime.zIndex', category: 'position', label: 'Layer order', control: 'number', type: 'number', order: 904, commandType: 'SET_PROPERTY', capability: 'position', propertyPath: 'zIndex', databaseMapping: snapshot('layout.{entityId}.zIndex'), defaultValue: 0, validation: validNumber(-10000, 10000), previewUpdater: stylePreview('z-index'), visibilityRule: hidden, styleKey: 'layout.zIndex' }),
  defineProperty({ propertyKey: 'runtime.backgroundColor', category: 'effects', label: 'Background color', control: 'color', type: 'color', order: 905, commandType: 'SET_PROPERTY', capability: 'background', propertyPath: 'color', databaseMapping: snapshot('backgrounds.{entityId}.color'), defaultValue: 'transparent', validation: validColor, previewUpdater: stylePreview('background-color'), visibilityRule: hidden, styleKey: 'background.color' }),
  defineProperty({ propertyKey: 'runtime.backgroundGradient', category: 'effects', label: 'Gradient', control: 'text', type: 'string', order: 906, commandType: 'SET_PROPERTY', capability: 'background', propertyPath: 'gradient', databaseMapping: snapshot('backgrounds.{entityId}.gradient'), defaultValue: '', validation: validString(512), previewUpdater: stylePreview('background-image'), visibilityRule: hidden, styleKey: 'background.gradient' }),
  defineProperty({ propertyKey: 'runtime.backgroundImage', category: 'effects', label: 'Background image', control: 'select', type: 'asset', order: 907, commandType: 'SET_IMAGE_REFERENCE', capability: 'background', propertyPath: 'imageAssetId', databaseMapping: snapshot('backgrounds.{entityId}.imageAssetId'), defaultValue: '', validation: validString(128), previewUpdater: backgroundImagePreview, visibilityRule: hidden, styleKey: 'background.imageAssetId' }),
  defineProperty({ propertyKey: 'runtime.buttonTextColor', category: 'font', label: 'Button text color', control: 'color', type: 'color', order: 908, commandType: 'SET_PROPERTY', capability: 'button', propertyPath: 'textColor', databaseMapping: snapshot('buttons.{entityId}.textColor'), defaultValue: '', validation: validColor, previewUpdater: stylePreview('color'), visibilityRule: hidden, styleKey: 'button.textColor' }),
  defineProperty({ propertyKey: 'runtime.buttonBorderColor', category: 'effects', label: 'Button border color', control: 'color', type: 'color', order: 909, commandType: 'SET_PROPERTY', capability: 'button-border', propertyPath: 'borderColor', databaseMapping: snapshot('buttons.{entityId}.borderColor'), defaultValue: '', validation: validColor, previewUpdater: stylePreview('border-color'), visibilityRule: hidden, styleKey: 'button.borderColor' }),
  defineProperty({ propertyKey: 'runtime.buttonRadius', category: 'effects', label: 'Button radius', control: 'text', type: 'string', order: 910, commandType: 'SET_PROPERTY', capability: 'button-radius', propertyPath: 'borderRadius', databaseMapping: snapshot('buttons.{entityId}.borderRadius'), defaultValue: '', validation: validCssLength(false, true), previewUpdater: stylePreview('border-radius'), visibilityRule: hidden, styleKey: 'button.borderRadius' }),
  defineProperty({ propertyKey: 'runtime.animationEnabled', category: 'behavior', label: 'Animation enabled', control: 'checkbox', type: 'boolean', order: 911, commandType: 'SET_PROPERTY', capability: 'animation', propertyPath: 'enabled', databaseMapping: snapshot('animations.{entityId}.enabled'), defaultValue: false, validation: validBoolean, previewUpdater: animationPreview('animation-name', (_value) => ''), visibilityRule: hidden, styleKey: 'animation.enabled' }),
  defineProperty({ propertyKey: 'runtime.animationName', category: 'behavior', label: 'Animation', control: 'text', type: 'string', order: 912, commandType: 'SET_PROPERTY', capability: 'animation', propertyPath: 'name', databaseMapping: snapshot('animations.{entityId}.name'), defaultValue: '', validation: validString(128), previewUpdater: animationPreview('animation-name'), visibilityRule: hidden, styleKey: 'animation.name' }),
  defineProperty({ propertyKey: 'runtime.animationDuration', category: 'behavior', label: 'Animation duration', control: 'number', type: 'number', order: 913, commandType: 'SET_PROPERTY', capability: 'animation', propertyPath: 'durationMs', databaseMapping: snapshot('animations.{entityId}.durationMs'), defaultValue: 0, validation: validNumber(0, 3600000), previewUpdater: animationPreview('animation-duration', (value) => typeof value === 'number' ? `${value}ms` : ''), visibilityRule: hidden, styleKey: 'animation.durationMs' }),
  defineProperty({ propertyKey: 'runtime.animationDelay', category: 'behavior', label: 'Animation delay', control: 'number', type: 'number', order: 914, commandType: 'SET_PROPERTY', capability: 'animation', propertyPath: 'delayMs', databaseMapping: snapshot('animations.{entityId}.delayMs'), defaultValue: 0, validation: validNumber(0, 3600000), previewUpdater: animationPreview('animation-delay', (value) => typeof value === 'number' ? `${value}ms` : ''), visibilityRule: hidden, styleKey: 'animation.delayMs' }),
  defineProperty({ propertyKey: 'runtime.animationEasing', category: 'behavior', label: 'Animation easing', control: 'text', type: 'string', order: 915, commandType: 'SET_PROPERTY', capability: 'animation', propertyPath: 'easing', databaseMapping: snapshot('animations.{entityId}.easing'), defaultValue: '', validation: validString(128), previewUpdater: animationPreview('animation-timing-function'), visibilityRule: hidden, styleKey: 'animation.easing' })
]

const categoryMetadata: Record<string, { category: string; label: string; order: number; presentation: 'inline' | 'accordion'; capability: string }> = {
  content: { category: 'content', label: 'OBJECT CONTENT', order: 0, presentation: 'inline', capability: 'content' },
  typography: { category: 'font', label: 'TYPOGRAPHY', order: 10, presentation: 'accordion', capability: 'typography' },
  media: { category: 'media', label: 'MEDIA', order: 20, presentation: 'accordion', capability: 'media' },
  layout: { category: 'layout', label: 'LAYOUT', order: 30, presentation: 'accordion', capability: 'layout' },
  appearance: { category: 'effects', label: 'EFFECTS', order: 50, presentation: 'accordion', capability: 'effects' },
  behavior: { category: 'behavior', label: 'BEHAVIOR', order: 60, presentation: 'accordion', capability: 'advanced' }
}

const propertyTypeByControl: Record<EditorControl, EditorPropertyType> = {
  text: 'string',
  textarea: 'string',
  number: 'number',
  color: 'color',
  select: 'enum',
  checkbox: 'boolean',
  file: 'asset',
  button: 'string',
  readonly: 'metadata',
  custom: 'string',
  'toggle-text': 'string',
  'toggle-color': 'color',
  segmented: 'enum',
  thumbnail: 'asset'
}

const defaultValueByType: Record<EditorPropertyType, EditorValue> = {
  string: '',
  number: 0,
  boolean: false,
  color: '#49362f',
  asset: '',
  enum: '',
  metadata: ''
}

export const propertyRegistry = entries
const propertyCandidateCache = new Map<string, PropertyRegistryEntry[]>()

export function ensurePropertyMetadata(definition: {
  propertyKey: string
  category: string
  label: string
  control: EditorControl
  valueType?: EditorPropertyType
  capability?: string
  propertyPath?: string
}): PropertyRegistryEntry {
  const normalizedSourceCategory = definition.category.toLowerCase()
  const category = categoryMetadata[normalizedSourceCategory] ?? {
    category: normalizedSourceCategory,
    label: definition.category.toUpperCase(),
    order: 100,
    presentation: 'accordion' as const,
    capability: normalizedSourceCategory
  }
  const key = `runtime:${normalizedSourceCategory}:${definition.propertyKey}:${definition.propertyPath ?? definition.propertyKey}`
  const existing = entries.find((entry) => entry.propertyKey === key)
  if (existing) return existing
  const type = definition.valueType ?? propertyTypeByControl[definition.control]
  const entry = defineProperty({
    propertyKey: key,
    category: category.category,
    categoryLabel: category.label,
    categoryOrder: category.order,
    categoryDefaultOpen: category.category === 'font',
    presentation: category.presentation,
    label: definition.label,
    control: definition.control,
    type,
    order: entries.length + 1,
    commandType: 'SET_PROPERTY',
    capability: definition.capability ?? category.capability,
    propertyPath: definition.propertyPath ?? definition.propertyKey,
    databaseMapping: { kind: 'runtime', path: definition.propertyPath ?? definition.propertyKey },
    defaultValue: defaultValueByType[type],
    copyable: normalizedSourceCategory !== 'content'
  })
  entries.push(entry)
  propertyCandidateCache.clear()
  return entry
}

export function registerProperty(entry: PropertyRegistryEntry): void {
  if (entries.some((candidate) => candidate.propertyKey === entry.propertyKey)) throw new Error(`Duplicate property registry key: ${entry.propertyKey}`)
  if (!entry.databaseMapping || !entry.validation || !entry.dependency || !entry.serializer || !entry.previewUpdater) {
    throw new Error(`Property ${entry.propertyKey} is missing required professional registry metadata.`)
  }
  entries.push({ ...entry, binding: entry.databaseMapping, dependencyKeys: entry.dependency.keys })
  propertyCandidateCache.clear()
}

export function resolvePropertyPath(entry: PropertyRegistryEntry, entityId: string): string | null {
  return entry.databaseMapping.kind === 'snapshot'
    ? entry.databaseMapping.path.replaceAll('{entityId}', entityId)
    : null
}

export function readSnapshotPath(root: unknown, path: string): EditorValue {
  return path.split('.').reduce<unknown>((value, key) => (value as Record<string, unknown> | undefined)?.[key], root) as EditorValue
}

export function resolveProperties(entity: EntityDescriptor, snapshotValue: EditorSnapshot): PropertyRegistryEntry[] {
  const values = entity.propertyValues
  const context: PropertyVisibilityContext = { entity, snapshot: snapshotValue, values }
  const capabilityKey = [...new Set(entity.capabilities)].sort().join('|')
  let candidates = propertyCandidateCache.get(capabilityKey)
  if (!candidates) {
    candidates = entries
      .filter((entry) => entity.capabilities.includes(entry.capability))
      .sort((left, right) => (left.categoryOrder ?? 100) - (right.categoryOrder ?? 100) || left.category.localeCompare(right.category) || left.order - right.order)
    propertyCandidateCache.set(capabilityKey, candidates)
  }
  return candidates
    .filter((entry) => (entry.visibilityRule ?? always)(context))
}

export function isPropertyEnabled(entry: PropertyRegistryEntry, context: PropertyVisibilityContext): boolean {
  return entry.readOnly || (entry.enabledRule ?? entry.dependency.enabled ?? always)(context)
}

export interface RegisteredPropertyError {
  entityId: string
  propertyKey: string
  propertyPath: string
  message: string
}

export function validateRegisteredProperties(snapshotValue: EditorSnapshot, entities: EntityDescriptor[] = []): RegisteredPropertyError[] {
  const descriptors = new Map(entities.map((entity) => [entity.entityId, entity]))
  const errors: RegisteredPropertyError[] = []
  const visited = new Set<string>()
  for (const entry of entries) {
    if (entry.databaseMapping.kind !== 'snapshot' || !entry.databaseMapping.path.includes('{entityId}')) continue
    const [recordPath] = entry.databaseMapping.path.split('{entityId}')
    const record = readSnapshotPath(snapshotValue, recordPath.replace(/\.$/, ''))
    if (!record || typeof record !== 'object' || Array.isArray(record)) continue
    for (const entityId of Object.keys(record as Record<string, unknown>)) {
      const propertyPath = resolvePropertyPath(entry, entityId)
      if (!propertyPath || visited.has(propertyPath)) continue
      visited.add(propertyPath)
      const value = entry.serializer.deserialize(readSnapshotPath(snapshotValue, propertyPath))
      const descriptor = descriptors.get(entityId) ?? {
        entityId,
        section: '',
        label: entityId,
        kind: '',
        objectType: 'Container',
        layerId: entityId,
        parentLayerId: '',
        capabilities: entries.map((candidate) => candidate.capability),
        propertyValues: {}
      }
      const message = entry.validation.validate(value, { entity: descriptor, snapshot: snapshotValue, values: {} })
      if (message) errors.push({ entityId, propertyKey: entry.propertyKey, propertyPath, message })
    }
  }
  return errors
}
