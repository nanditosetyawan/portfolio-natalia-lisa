import type { EditorSnapshot } from './editorSnapshot'

export type EditorValue = string | number | boolean | null | undefined | unknown[] | Record<string, unknown>
export type EditorControl = 'text' | 'textarea' | 'number' | 'color' | 'select' | 'checkbox' | 'file' | 'button' | 'readonly' | 'custom'
export type EditorPropertyType = 'string' | 'number' | 'boolean' | 'color' | 'asset' | 'enum' | 'metadata'
export type BuiltInEditorObjectType = 'Text' | 'Image' | 'Button' | 'Container' | 'Background' | 'Divider' | 'Icon'
export type EditorObjectType = BuiltInEditorObjectType | (string & {})

export type PropertyBinding =
  | { kind: 'snapshot'; path: string }
  | { kind: 'runtime'; path: string }
  | { kind: 'action'; action: 'upload-media' | 'choose-media' | 'replace-media' }
  | { kind: 'metadata'; field: 'objectId' | 'objectType' | 'capabilities' | 'validationStatus' | 'section' | 'layer' }

export type EditorCommandType =
  | 'SET_PROPERTY'
  | 'SET_IMAGE_REFERENCE'
  | 'UPLOAD_MEDIA'
  | 'REPLACE_MEDIA'
  | 'DELETE_MEDIA'
  | 'PASTE_STYLE'

export interface EditorCommandChange {
  propertyPath: string
  previousValue: EditorValue
  nextValue: EditorValue
}

export interface EditorCommand {
  type: EditorCommandType
  entityId: string
  propertyPath: string
  previousValue: EditorValue
  nextValue: EditorValue
  timestamp: number
  metadata?: Record<string, unknown>
  changes?: EditorCommandChange[]
}

export interface EntityDescriptor {
  entityId: string
  section: string
  label: string
  kind: string
  objectType: EditorObjectType
  layerId: string
  parentLayerId: string
  capabilities: string[]
  propertyValues: Record<string, EditorValue>
}

export interface EditorObject extends EntityDescriptor {
  id: string
  type: EditorObjectType
  name: string
  order: number
  validation: EditorObjectValidation
}

export interface EditorObjectValidation {
  valid: boolean
  errors: string[]
}

export interface EditorObjectSessionState {
  locked: boolean
  hidden: boolean
}

export interface EditorObjectTypeRegistration {
  type: EditorObjectType
  label: string
  capabilities: string[]
  compatibleStyleCapabilities: string[]
}

export interface PropertyDependencyRule {
  keys: string[]
  enabled: (context: PropertyVisibilityContext) => boolean
}

export interface PropertySerializer {
  serialize: (value: EditorValue) => EditorValue
  deserialize: (value: EditorValue) => EditorValue
}

export interface PropertyPreviewContext {
  element: HTMLElement
  entityId: string
  snapshot: EditorSnapshot
  setStyle: (property: string, value: string) => void
  toggleClass: (className: string, enabled: boolean) => void
}

export interface PropertyPreviewUpdater {
  styles: string[]
  classes?: string[]
  update: (context: PropertyPreviewContext, value: EditorValue) => void
}

export interface PropertyValidationRule {
  validate: (value: EditorValue, context: PropertyVisibilityContext) => string | null
}

export interface PropertyRegistryEntry {
  propertyKey: string
  category: string
  categoryOrder?: number
  categoryDefaultOpen?: boolean
  label: string
  control: EditorControl
  type: EditorPropertyType
  valueType: EditorPropertyType
  order: number
  commandType: EditorCommandType
  capability: string
  propertyPath: string
  categoryLabel?: string
  presentation?: 'inline' | 'accordion'
  rowKey?: string
  placeholder?: string
  helperText?: string
  accept?: string
  /** Canonical snapshot/runtime persistence mapping. */
  databaseMapping: PropertyBinding
  /** Deprecated alias retained for existing adapters during the Phase 030 cutover. */
  binding?: PropertyBinding
  defaultValue: EditorValue
  validation: PropertyValidationRule
  dependency: PropertyDependencyRule
  serializer: PropertySerializer
  previewUpdater: PropertyPreviewUpdater
  styleKey?: string
  copyable?: boolean
  readOnly?: boolean
  unit?: string
  options?: Array<{ label: string; value: string }>
  visibilityRule?: (context: PropertyVisibilityContext) => boolean
  enabledRule?: (context: PropertyVisibilityContext) => boolean
  dependencyKeys?: string[]
}

export interface PropertyVisibilityContext {
  entity: EntityDescriptor
  snapshot: EditorSnapshot
  values: Record<string, EditorValue>
}

export interface EditorStyleClipboardEntry {
  styleKey: string
  capability: string
  value: EditorValue
}

export interface EditorStyleClipboard {
  sourceObjectId: string
  sourceObjectType: EditorObjectType
  entries: EditorStyleClipboardEntry[]
}

export interface DraftMediaReference {
  assetId: string
  bucket: string
  storagePath: string
  mimeType: string
  width: number
  height: number
  previewUrl?: string
}

export interface EditorRevisionState {
  draftRevisionId: string | null
  draftRevisionNumber: number | null
  draftLockVersion: number | null
  publishedRevisionNumber: number | null
  baseRevisionNumber: number | null
}
