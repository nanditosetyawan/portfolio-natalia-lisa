import type { EditorSnapshot } from './editorSnapshot'

export type EditorValue = string | number | boolean | null | undefined | unknown[] | Record<string, unknown>
export type EditorControl = 'text' | 'textarea' | 'number' | 'color' | 'select' | 'checkbox' | 'file' | 'button' | 'custom'

export type PropertyBinding =
  | { kind: 'snapshot'; path: string }
  | { kind: 'runtime'; path: string }
  | { kind: 'action'; action: 'upload-media' | 'choose-media' | 'replace-media' }

export type EditorCommandType =
  | 'SET_PROPERTY'
  | 'SET_IMAGE_REFERENCE'
  | 'UPLOAD_MEDIA'
  | 'REPLACE_MEDIA'
  | 'DELETE_MEDIA'

export interface EditorCommand {
  type: EditorCommandType
  entityId: string
  propertyPath: string
  previousValue: EditorValue
  nextValue: EditorValue
  timestamp: number
  metadata?: Record<string, unknown>
}

export interface EntityDescriptor {
  entityId: string
  section: string
  label: string
  kind: string
  capabilities: string[]
  propertyValues: Record<string, EditorValue>
}

export interface PropertyRegistryEntry {
  propertyKey: string
  category: string
  categoryOrder?: number
  label: string
  control: EditorControl
  valueType: 'string' | 'number' | 'boolean' | 'color' | 'asset' | 'enum'
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
  binding?: PropertyBinding
  defaultValue?: EditorValue
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
