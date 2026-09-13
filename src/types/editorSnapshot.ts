import type { SiteSnapshot } from '../data/default/site'
import type { CertificateCard } from '../data/default/certificates'

export const EDITOR_SNAPSHOT_SCHEMA_VERSION = 2 as const
export const EDITOR_SNAPSHOT_READER_VERSION = 2 as const
export const EDITOR_SNAPSHOT_MINIMUM_SUPPORTED_VERSION = 1 as const
export type EditorSnapshotSchemaVersion = 1 | typeof EDITOR_SNAPSHOT_SCHEMA_VERSION

export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

export interface SnapshotCompatibility {
  schemaVersion: EditorSnapshotSchemaVersion
  minimumReaderVersion: number
  maximumWriterVersion: number
}

export interface SnapshotEntityReference {
  entityId: string
  section: string
  kind: 'content' | 'text' | 'frame' | 'media' | 'navigation' | 'button' | 'container' | 'background' | 'divider' | 'icon'
  label: string
}

export type EditorInstanceType = 'image'

/**
 * Canonical identity/placement manifest for objects added after the fixed
 * template was authored. Visual values remain in the existing sparse maps,
 * keyed by instanceId, so this does not create a parallel property model.
 */
export interface EditorInstance {
  instanceId: string
  type: EditorInstanceType
  sectionId: string
  label: string
  order: number
  source: {
    kind: 'media-assignment'
    assignmentEntityId: string
  }
  createdAt: string
}

export interface TypographySettings {
  fontFamily?: string
  fontSize?: string
  fontWeight?: number
  lineHeight?: string
  letterSpacing?: string
  color?: string
  textShadow?: string
  hoverColor?: string
  textAlign?: 'left' | 'center' | 'right' | 'justify'
}

export interface LayoutSettings {
  positionMode?: 'flow' | 'absolute'
  x?: number | string
  y?: number | string
  width?: number | string
  height?: number | string
  margin?: string
  padding?: string
  alignment?: 'start' | 'center' | 'end' | 'stretch' | 'space-between' | 'space-around'
  display?: 'block' | 'inline' | 'inline-block' | 'flex' | 'grid' | 'none'
  visibility?: 'visible' | 'hidden'
  rotation?: number | string
  zIndex?: number
}

export interface SnapshotMediaReference {
  assetId: string
  uri: string
  bucket?: string
  storagePath?: string
  mimeType?: string
  width?: number
  height?: number
  alt?: string
}

export interface MediaAssignment {
  entityId: string
  role: string
  assetId: string
  objectPosition?: string
}

export interface SnapshotMediaModel {
  references: SnapshotMediaReference[]
  assignments: MediaAssignment[]
  styles: Record<string, MediaStyleSettings>
}

export interface MediaStyleSettings {
  hoverEnabled?: boolean
  outlineEnabled?: boolean
  outlineWidth?: number
  aspectRatioLocked?: boolean
  aspectRatio?: number
}

export interface BackgroundSettings {
  color?: string
  gradient?: string
  imageAssetId?: string
  opacity?: number
  boxShadow?: string
  blur?: number
  border?: string
  borderRadius?: string
  blendMode?: 'normal' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten' | 'color-dodge' | 'color-burn' | 'hard-light' | 'soft-light' | 'difference' | 'exclusion' | 'hue' | 'saturation' | 'color' | 'luminosity'
}

export interface ButtonSettings {
  text?: string
  href?: string
  variant?: string
  backgroundColor?: string
  textColor?: string
  borderColor?: string
  borderRadius?: string
}

export interface AnimationSettings {
  name?: string
  durationMs?: number
  delayMs?: number
  easing?: string
  enabled?: boolean
}

export interface EditorSessionState {
  selectedEntityId: string
  selectedSection: string
  activeAccordion: string
  previewScrollTop: number
  previewScrollLeft: number
  zoom: number
  userZoom: number | null
  propertySearch: string
  objectStates: Record<string, SnapshotEditorObjectState>
  expandedLayers: string[]
}

export interface SnapshotEditorObjectState {
  locked: boolean
  hidden: boolean
}

export interface EditorSnapshot {
  compatibility: SnapshotCompatibility
  revision: {
    baseRevisionNumber: number | null
    draftRevisionNumber: number | null
  }
  entities: SnapshotEntityReference[]
  /** Additive canonical objects; fixed-template entities remain in entities. */
  instances: EditorInstance[]
  content: SiteSnapshot['content']
  certificateCards: CertificateCard[]
  typography: Record<string, TypographySettings>
  layout: Record<string, LayoutSettings>
  media: SnapshotMediaModel
  backgrounds: Record<string, BackgroundSettings>
  buttons: Record<string, ButtonSettings>
  animations: Record<string, AnimationSettings>
  session: EditorSessionState
  /** Legacy/domain visual data is retained separately until section cutover. */
  visual: SiteSnapshot['visual']
  behavior: SiteSnapshot['behavior']
}

export interface SnapshotValidationResult {
  valid: boolean
  errors: string[]
  value?: EditorSnapshot
}
