import type { EntityDescriptor, PropertyRegistryEntry, PropertyVisibilityContext } from '../types/editor'
import type { EditorSnapshot } from '../types/editorSnapshot'

const always = () => true
const supports = (capability: string): PropertyRegistryEntry['enabledRule'] => ({ entity }) => entity.capabilities.includes(capability)
const outlineEnabled: PropertyRegistryEntry['enabledRule'] = ({ entity, values }) => (
  entity.capabilities.includes('media-outline') && values['media.outlineEnabled'] === true
)

const entries: PropertyRegistryEntry[] = [
  {
    propertyKey: 'font.family', category: 'font', categoryLabel: 'FONT', categoryOrder: 10,
    label: 'Font type', control: 'text', valueType: 'string', order: 10,
    commandType: 'SET_PROPERTY', capability: 'typography', propertyPath: 'fontFamily',
    binding: { kind: 'snapshot', path: 'typography.{entityId}.fontFamily' },
    defaultValue: '', placeholder: 'Font family'
  },
  {
    propertyKey: 'font.size', category: 'font', categoryLabel: 'FONT', categoryOrder: 10,
    label: 'Size', control: 'text', valueType: 'string', order: 20, rowKey: 'font-size-spacing',
    commandType: 'SET_PROPERTY', capability: 'typography', propertyPath: 'fontSize',
    binding: { kind: 'snapshot', path: 'typography.{entityId}.fontSize' },
    defaultValue: '', placeholder: 'e.g. 64px'
  },
  {
    propertyKey: 'font.spacing', category: 'font', categoryLabel: 'FONT', categoryOrder: 10,
    label: 'Spacing', control: 'text', valueType: 'string', order: 30, rowKey: 'font-size-spacing',
    commandType: 'SET_PROPERTY', capability: 'typography', propertyPath: 'letterSpacing',
    binding: { kind: 'snapshot', path: 'typography.{entityId}.letterSpacing' },
    defaultValue: '', placeholder: 'e.g. 0.04em'
  },
  {
    propertyKey: 'font.color', category: 'font', categoryLabel: 'FONT', categoryOrder: 10,
    label: 'Color', control: 'color', valueType: 'color', order: 40,
    commandType: 'SET_PROPERTY', capability: 'typography', propertyPath: 'color',
    binding: { kind: 'snapshot', path: 'typography.{entityId}.color' }, defaultValue: '#49362f'
  },
  {
    propertyKey: 'font.shadow', category: 'font', categoryLabel: 'FONT', categoryOrder: 10,
    label: 'Shadow', control: 'text', valueType: 'string', order: 50,
    commandType: 'SET_PROPERTY', capability: 'typography', propertyPath: 'textShadow',
    binding: { kind: 'snapshot', path: 'typography.{entityId}.textShadow' },
    defaultValue: '', placeholder: 'CSS text shadow'
  },
  {
    propertyKey: 'font.hover', category: 'font', categoryLabel: 'FONT', categoryOrder: 10,
    label: 'Hover', control: 'color', valueType: 'color', order: 60,
    commandType: 'SET_PROPERTY', capability: 'typography', propertyPath: 'hoverColor',
    binding: { kind: 'snapshot', path: 'typography.{entityId}.hoverColor' },
    defaultValue: '#49362f', enabledRule: supports('font-hover'),
    helperText: 'Not available for this element.'
  },
  {
    propertyKey: 'font.positionX', category: 'font', categoryLabel: 'FONT', categoryOrder: 10,
    label: 'X', control: 'number', valueType: 'number', order: 70, rowKey: 'font-position',
    commandType: 'SET_PROPERTY', capability: 'typography', propertyPath: 'x',
    binding: { kind: 'snapshot', path: 'layout.{entityId}.x' }, defaultValue: 0,
    enabledRule: supports('position'), helperText: 'Not available for this element.'
  },
  {
    propertyKey: 'font.positionY', category: 'font', categoryLabel: 'FONT', categoryOrder: 10,
    label: 'Y', control: 'number', valueType: 'number', order: 80, rowKey: 'font-position',
    commandType: 'SET_PROPERTY', capability: 'typography', propertyPath: 'y',
    binding: { kind: 'snapshot', path: 'layout.{entityId}.y' }, defaultValue: 0,
    enabledRule: supports('position'), helperText: 'Not available for this element.'
  },
  {
    propertyKey: 'font.rotate', category: 'font', categoryLabel: 'FONT', categoryOrder: 10,
    label: 'Rotate', control: 'number', valueType: 'number', order: 90,
    commandType: 'SET_PROPERTY', capability: 'typography', propertyPath: 'rotation', unit: 'deg',
    binding: { kind: 'snapshot', path: 'layout.{entityId}.rotation' }, defaultValue: 0,
    enabledRule: supports('rotate'), helperText: 'Not available for this element.'
  },
  {
    propertyKey: 'media.upload', category: 'media', categoryLabel: 'MEDIA', categoryOrder: 20,
    label: 'Upload', control: 'file', valueType: 'asset', order: 10,
    commandType: 'UPLOAD_MEDIA', capability: 'media', propertyPath: 'reference', accept: 'image/*',
    binding: { kind: 'action', action: 'upload-media' }, defaultValue: ''
  },
  {
    propertyKey: 'media.choose', category: 'media', categoryLabel: 'MEDIA', categoryOrder: 20,
    label: 'Choose from Media', control: 'select', valueType: 'asset', order: 20,
    commandType: 'SET_IMAGE_REFERENCE', capability: 'media', propertyPath: 'reference',
    binding: { kind: 'action', action: 'choose-media' }, defaultValue: '',
    placeholder: 'Select existing media', helperText: 'No repository media is available.'
  },
  {
    propertyKey: 'media.width', category: 'media', categoryLabel: 'MEDIA', categoryOrder: 20,
    label: 'P (Width)', control: 'text', valueType: 'string', order: 30, rowKey: 'media-size',
    commandType: 'SET_PROPERTY', capability: 'media', propertyPath: 'width',
    binding: { kind: 'snapshot', path: 'layout.{entityId}.width' }, defaultValue: '', placeholder: 'Auto',
    enabledRule: supports('media-dimensions'), helperText: 'Not available for this element.'
  },
  {
    propertyKey: 'media.height', category: 'media', categoryLabel: 'MEDIA', categoryOrder: 20,
    label: 'L (Height)', control: 'text', valueType: 'string', order: 40, rowKey: 'media-size',
    commandType: 'SET_PROPERTY', capability: 'media', propertyPath: 'height',
    binding: { kind: 'snapshot', path: 'layout.{entityId}.height' }, defaultValue: '', placeholder: 'Auto',
    enabledRule: supports('media-dimensions'), helperText: 'Not available for this element.'
  },
  {
    propertyKey: 'media.hover', category: 'media', categoryLabel: 'MEDIA', categoryOrder: 20,
    label: 'Hover', control: 'checkbox', valueType: 'boolean', order: 50,
    commandType: 'SET_PROPERTY', capability: 'media', propertyPath: 'hoverEnabled',
    binding: { kind: 'snapshot', path: 'media.styles.{entityId}.hoverEnabled' }, defaultValue: false,
    enabledRule: supports('media-hover'), helperText: 'Not available for this element.'
  },
  {
    propertyKey: 'media.positionX', category: 'media', categoryLabel: 'MEDIA', categoryOrder: 20,
    label: 'X', control: 'number', valueType: 'number', order: 60, rowKey: 'media-position',
    commandType: 'SET_PROPERTY', capability: 'media', propertyPath: 'x',
    binding: { kind: 'snapshot', path: 'layout.{entityId}.x' }, defaultValue: 0,
    enabledRule: supports('position'), helperText: 'Not available for this element.'
  },
  {
    propertyKey: 'media.positionY', category: 'media', categoryLabel: 'MEDIA', categoryOrder: 20,
    label: 'Y', control: 'number', valueType: 'number', order: 70, rowKey: 'media-position',
    commandType: 'SET_PROPERTY', capability: 'media', propertyPath: 'y',
    binding: { kind: 'snapshot', path: 'layout.{entityId}.y' }, defaultValue: 0,
    enabledRule: supports('position'), helperText: 'Not available for this element.'
  },
  {
    propertyKey: 'media.outlineEnabled', category: 'media', categoryLabel: 'MEDIA', categoryOrder: 20,
    label: 'Outline', control: 'checkbox', valueType: 'boolean', order: 80,
    commandType: 'SET_PROPERTY', capability: 'media', propertyPath: 'outlineEnabled',
    binding: { kind: 'snapshot', path: 'media.styles.{entityId}.outlineEnabled' }, defaultValue: false,
    enabledRule: supports('media-outline'), helperText: 'Not available for this element.'
  },
  {
    propertyKey: 'media.outlineWidth', category: 'media', categoryLabel: 'MEDIA', categoryOrder: 20,
    label: 'Outline thickness', control: 'number', valueType: 'number', order: 90,
    commandType: 'SET_PROPERTY', capability: 'media', propertyPath: 'outlineWidth', unit: 'px',
    binding: { kind: 'snapshot', path: 'media.styles.{entityId}.outlineWidth' }, defaultValue: 1,
    enabledRule: outlineEnabled, dependencyKeys: ['media.outlineEnabled'],
    helperText: 'Enable Outline to change thickness.'
  },
  {
    propertyKey: 'media.change', category: 'media', categoryLabel: 'MEDIA', categoryOrder: 20,
    label: 'Change image', control: 'file', valueType: 'asset', order: 100,
    commandType: 'REPLACE_MEDIA', capability: 'media', propertyPath: 'reference', accept: 'image/*',
    binding: { kind: 'action', action: 'replace-media' }, defaultValue: ''
  },
  {
    propertyKey: 'media.rotate', category: 'media', categoryLabel: 'MEDIA', categoryOrder: 20,
    label: 'Rotate', control: 'number', valueType: 'number', order: 110,
    commandType: 'SET_PROPERTY', capability: 'media', propertyPath: 'rotation', unit: 'deg',
    binding: { kind: 'snapshot', path: 'layout.{entityId}.rotation' }, defaultValue: 0,
    enabledRule: supports('rotate'), helperText: 'Not available for this element.'
  }
]

export const propertyRegistry = entries

export function ensurePropertyMetadata(definition: {
  propertyKey: string
  category: string
  label: string
  control: PropertyRegistryEntry['control']
  valueType?: PropertyRegistryEntry['valueType']
  capability?: string
  propertyPath?: string
}): PropertyRegistryEntry {
  const existing = entries.find((entry) => entry.propertyKey === definition.propertyKey)
  if (existing) return existing
  const normalizedCategory = definition.category.toLowerCase()
  const entry: PropertyRegistryEntry = {
    propertyKey: definition.propertyKey,
    category: normalizedCategory,
    categoryLabel: definition.category.toUpperCase(),
    categoryOrder: 100,
    label: definition.label,
    control: definition.control,
    valueType: definition.valueType ?? (definition.control === 'number' ? 'number' : definition.control === 'color' ? 'color' : definition.control === 'checkbox' ? 'boolean' : 'string'),
    order: entries.length + 1,
    commandType: 'SET_PROPERTY',
    capability: definition.capability ?? normalizedCategory,
    propertyPath: definition.propertyPath ?? definition.propertyKey,
    binding: { kind: 'runtime', path: definition.propertyPath ?? definition.propertyKey }
  }
  entries.push(entry)
  return entry
}

export function registerProperty(entry: PropertyRegistryEntry): void {
  if (entries.some((candidate) => candidate.propertyKey === entry.propertyKey)) throw new Error(`Duplicate property registry key: ${entry.propertyKey}`)
  entries.push(entry)
}

export function resolveProperties(entity: EntityDescriptor, snapshot: EditorSnapshot): PropertyRegistryEntry[] {
  const values = entity.propertyValues
  const context: PropertyVisibilityContext = { entity, snapshot, values }
  return entries
    .filter((entry) => entity.capabilities.includes(entry.capability))
    .filter((entry) => (entry.visibilityRule ?? always)(context))
    .sort((left, right) => (left.categoryOrder ?? 100) - (right.categoryOrder ?? 100) || left.category.localeCompare(right.category) || left.order - right.order)
}

export function isPropertyEnabled(entry: PropertyRegistryEntry, context: PropertyVisibilityContext): boolean {
  return (entry.enabledRule ?? always)(context)
}
