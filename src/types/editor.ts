import type { EditorSnapshot } from './editorSnapshot'
import type { DesignTokenKind } from './designSystem'
import type { AnimationPropertyField } from '../editor/animationRegistry'

export type EditorValue = string | number | boolean | null | undefined | unknown[] | Record<string, unknown>
export type EditorControl =
  | 'text'
  | 'textarea'
  | 'number'
  | 'color'
  | 'select'
  | 'checkbox'
  | 'file'
  | 'button'
  | 'readonly'
  | 'custom'
  | 'toggle-text'
  | 'toggle-color'
  | 'segmented'
  | 'thumbnail'
  | 'timeline'
  | 'shadow'
  | 'border'
export type EditorPropertyType = 'string' | 'number' | 'boolean' | 'color' | 'asset' | 'enum' | 'metadata'
export type BuiltInEditorObjectType = 'Text' | 'Image' | 'Button' | 'Container' | 'Background' | 'Divider' | 'Icon'
export type EditorObjectType = BuiltInEditorObjectType | (string & {})

export type PropertyBinding =
  | { kind: 'snapshot'; path: string }
  | { kind: 'runtime'; path: string }
  | { kind: 'action'; action: 'upload-media' | 'choose-media' | 'replace-media' | 'remove-media' | 'duplicate-media-reference' | 'reveal-media-library' | 'set-media-crop' | 'set-media-fit' | 'preview-media' | 'set-animation-config' | 'apply-animation-preset' | 'preview-animation' | 'preview-animation-timeline' | 'copy-animation' | 'paste-animation' | 'duplicate-animation' | 'reset-animation' }
  | { kind: 'metadata'; field: 'objectId' | 'objectType' | 'capabilities' | 'validationStatus' | 'section' | 'layer' }

export type EditorCommandType =
  | 'SET_PROPERTY'
  | 'SET_IMAGE_REFERENCE'
  | 'UPLOAD_MEDIA'
  | 'REPLACE_MEDIA'
  | 'DELETE_MEDIA'
  | 'PASTE_STYLE'
  | 'NUDGE'
  | 'ALIGN'
  | 'DISTRIBUTE'
  | 'REORDER'
  | 'RENAME'
  | 'DELETE_OBJECT'
  | 'DUPLICATE_OBJECT'

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
  ux?: EditorObjectUxMetadata
}

export interface EditorObjectUxMetadata {
  /** Canonical array path used by generic duplicate/delete commands when the object is repeatable. */
  collectionPath?: string
  /** Existing canonical visual path used by media fit controls when that object exposes one. */
  mediaFitPath?: string
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
  searchTerms?: string[]
  step?: number
  minimum?: number
  maximum?: number
  enabledValue?: EditorValue
  /** Presentation-only options forwarded by the generic Inspector control renderer. */
  controlOptions?: Record<string, EditorValue>
  visibilityRule?: (context: PropertyVisibilityContext) => boolean
  enabledRule?: (context: PropertyVisibilityContext) => boolean
  dependencyKeys?: string[]
  /** Optional Design System linkage. The Inspector consumes this generically. */
  designToken?: {
    kinds: DesignTokenKind[]
    suggestedTokenId: string
  }
  /** Canonical animation-field adapter consumed by generic Inspector actions. */
  animationField?: AnimationPropertyField
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
