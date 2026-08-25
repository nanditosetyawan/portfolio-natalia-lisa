import type { EntityDescriptor, PropertyRegistryEntry, PropertyVisibilityContext } from '../types/editor'
import type { EditorSnapshot } from '../types/editorSnapshot'

const always = () => true

const absolutePosition: PropertyRegistryEntry['enabledRule'] = ({ values }) => values['layout.positionMode'] === 'absolute'

const entries: PropertyRegistryEntry[] = [
  { propertyKey: 'content', category: 'content', label: 'Content', control: 'textarea', valueType: 'string', order: 10, commandType: 'SET_PROPERTY', capability: 'content', propertyPath: 'content' },
  { propertyKey: 'fontFamily', category: 'typography', label: 'Font family', control: 'text', valueType: 'string', order: 10, commandType: 'SET_PROPERTY', capability: 'typography', propertyPath: 'fontFamily' },
  { propertyKey: 'fontSize', category: 'typography', label: 'Font size', control: 'text', valueType: 'string', order: 20, commandType: 'SET_PROPERTY', capability: 'typography', propertyPath: 'fontSize' },
  { propertyKey: 'fontWeight', category: 'typography', label: 'Font weight', control: 'number', valueType: 'number', order: 30, commandType: 'SET_PROPERTY', capability: 'typography', propertyPath: 'fontWeight' },
  { propertyKey: 'color', category: 'typography', label: 'Color', control: 'color', valueType: 'color', order: 40, commandType: 'SET_PROPERTY', capability: 'typography', propertyPath: 'color' },
  { propertyKey: 'lineHeight', category: 'typography', label: 'Line height', control: 'text', valueType: 'string', order: 50, commandType: 'SET_PROPERTY', capability: 'typography', propertyPath: 'lineHeight' },
  { propertyKey: 'letterSpacing', category: 'typography', label: 'Letter spacing', control: 'text', valueType: 'string', order: 60, commandType: 'SET_PROPERTY', capability: 'typography', propertyPath: 'letterSpacing' },
  { propertyKey: 'layout.positionMode', category: 'layout', label: 'Position mode', control: 'select', valueType: 'enum', order: 10, commandType: 'SET_PROPERTY', capability: 'layout', propertyPath: 'positionMode', options: [{ label: 'Flow', value: 'flow' }, { label: 'Absolute', value: 'absolute' }] },
  { propertyKey: 'layout.x', category: 'layout', label: 'X', control: 'number', valueType: 'number', order: 20, commandType: 'SET_PROPERTY', capability: 'layout', propertyPath: 'x', enabledRule: absolutePosition, dependencyKeys: ['layout.positionMode'] },
  { propertyKey: 'layout.y', category: 'layout', label: 'Y', control: 'number', valueType: 'number', order: 30, commandType: 'SET_PROPERTY', capability: 'layout', propertyPath: 'y', enabledRule: absolutePosition, dependencyKeys: ['layout.positionMode'] },
  { propertyKey: 'layout.width', category: 'layout', label: 'Width', control: 'text', valueType: 'string', order: 40, commandType: 'SET_PROPERTY', capability: 'layout', propertyPath: 'width' },
  { propertyKey: 'layout.height', category: 'layout', label: 'Height', control: 'text', valueType: 'string', order: 50, commandType: 'SET_PROPERTY', capability: 'layout', propertyPath: 'height' },
  { propertyKey: 'layout.rotation', category: 'layout', label: 'Rotation', control: 'number', valueType: 'number', order: 60, commandType: 'SET_PROPERTY', capability: 'layout', propertyPath: 'rotation' },
  { propertyKey: 'appearance.backgroundColor', category: 'background', label: 'Background color', control: 'color', valueType: 'color', order: 10, commandType: 'SET_PROPERTY', capability: 'background', propertyPath: 'backgroundColor' },
  { propertyKey: 'appearance.opacity', category: 'background', label: 'Opacity', control: 'number', valueType: 'number', order: 20, commandType: 'SET_PROPERTY', capability: 'background', propertyPath: 'opacity' },
  { propertyKey: 'appearance.borderRadius', category: 'appearance', label: 'Border radius', control: 'text', valueType: 'string', order: 10, commandType: 'SET_PROPERTY', capability: 'appearance', propertyPath: 'borderRadius' },
  { propertyKey: 'appearance.filter', category: 'appearance', label: 'Filter', control: 'text', valueType: 'string', order: 20, commandType: 'SET_PROPERTY', capability: 'appearance', propertyPath: 'filter' },
  { propertyKey: 'appearance.blendMode', category: 'appearance', label: 'Blend mode', control: 'select', valueType: 'enum', order: 30, commandType: 'SET_PROPERTY', capability: 'appearance', propertyPath: 'blendMode', options: [{ label: 'Normal', value: 'normal' }, { label: 'Multiply', value: 'multiply' }, { label: 'Screen', value: 'screen' }] },
  { propertyKey: 'media.reference', category: 'image', label: 'Media reference', control: 'file', valueType: 'asset', order: 10, commandType: 'SET_IMAGE_REFERENCE', capability: 'media', propertyPath: 'reference' }
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
  const entry: PropertyRegistryEntry = {
    propertyKey: definition.propertyKey,
    category: definition.category.toLowerCase(),
    label: definition.label,
    control: definition.control,
    valueType: definition.valueType ?? (definition.control === 'number' ? 'number' : definition.control === 'color' ? 'color' : definition.control === 'checkbox' ? 'boolean' : 'string'),
    order: entries.length + 1,
    commandType: 'SET_PROPERTY',
    capability: definition.capability ?? definition.category.toLowerCase(),
    propertyPath: definition.propertyPath ?? definition.propertyKey
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
    .sort((left, right) => left.category.localeCompare(right.category) || left.order - right.order)
}

export function isPropertyEnabled(entry: PropertyRegistryEntry, context: PropertyVisibilityContext): boolean {
  return (entry.enabledRule ?? always)(context)
}
