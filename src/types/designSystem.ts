import type { EditorObjectType, EditorValue } from './editor'

export type DesignTokenKind =
  | 'color'
  | 'font'
  | 'radius'
  | 'shadow'
  | 'spacing'
  | 'transition'
  | 'duration'
  | 'typography-scale'

export type DesignScope = 'theme' | 'section' | 'component' | 'object'

export interface DesignTokenDefinition {
  id: string
  label: string
  kind: DesignTokenKind
  cssVariable: string
  defaultValue: EditorValue
  order: number
  description: string
  validate: (value: EditorValue) => string | null
}

export interface DesignTokenValue {
  tokenId: string
  value: EditorValue
}

export type TypographyRoleId =
  | 'heading-1'
  | 'heading-2'
  | 'heading-3'
  | 'heading-4'
  | 'heading-5'
  | 'heading-6'
  | 'paragraph'
  | 'caption'
  | 'button'
  | 'label'

export interface TypographyRoleDefinition {
  id: TypographyRoleId
  label: string
  order: number
  values: Record<string, EditorValue>
}

export type ButtonVariantId = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'icon'
export type ButtonSizeId = 'small' | 'medium' | 'large'

export interface ButtonStyleDefinition {
  id: ButtonVariantId
  label: string
  order: number
  values: Record<string, EditorValue | { tokenId: string }>
}

export interface ButtonSizeDefinition {
  id: ButtonSizeId
  label: string
  order: number
  values: Record<string, EditorValue>
  minimumTouchTarget: number
}

export interface ReusableComponentDefinition {
  id: string
  label: string
  description: string
  objectType: EditorObjectType
  requiredCapabilities: string[]
  keywords: string[]
  editable: true
  duplicatable: boolean
  insertMode: 'apply-to-selection' | 'canonical-repeatable' | 'unavailable-fixed-template'
  styleValues: Record<string, EditorValue | { tokenId: string }>
}

export interface ReusableSectionDefinition {
  id: string
  label: string
  description: string
  existingSection?: string
  keywords: string[]
  insertMode: 'select-existing' | 'canonical-repeatable' | 'unavailable-fixed-template'
}

export interface DesignTheme {
  id: string
  name: string
  tokens: Record<string, EditorValue>
  typography: Record<TypographyRoleId, Record<string, EditorValue>>
  createdAt: string
  updatedAt: string
}

export interface DesignStyleReference {
  tokenId: string
  overridden: boolean
}

export interface DesignReferenceContext {
  objectId: string
  section: string
  component: string
}

export interface ResolvedDesignReference extends DesignStyleReference {
  scope: DesignScope
  scopeId: string
}

export interface DesignReferenceState {
  theme: Record<string, DesignStyleReference>
  sections: Record<string, Record<string, DesignStyleReference>>
  components: Record<string, Record<string, DesignStyleReference>>
  objects: Record<string, Record<string, DesignStyleReference>>
}

export interface TypographyAssignment {
  roleId: TypographyRoleId
  overriddenStyleKeys: string[]
}

export interface ButtonAssignment {
  variantId: ButtonVariantId
  sizeId: ButtonSizeId
  overriddenStyleKeys: string[]
}

export interface SavedSectionTemplate {
  id: string
  name: string
  sourceSection: string
  createdAt: string
  styleValues: Record<string, Record<string, EditorValue>>
}

export interface SavedComponentPreset {
  id: string
  name: string
  sourceType: EditorObjectType
  createdAt: string
  styleValues: Record<string, EditorValue>
}

export interface DesignSystemWorkspace {
  version: 1
  themes: DesignTheme[]
  activeThemeId: string
  previewThemeId: string | null
  references: DesignReferenceState
  typographyAssignments: Record<string, TypographyAssignment>
  buttonAssignments: Record<string, ButtonAssignment>
  sectionTemplates: SavedSectionTemplate[]
  componentPresets: SavedComponentPreset[]
}

export interface ThemeAccessibilityIssue {
  id: string
  severity: 'warning' | 'error'
  message: string
  ratio?: number
}
