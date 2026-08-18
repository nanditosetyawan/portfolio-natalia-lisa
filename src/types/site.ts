export type EntityId = string

export interface OrderedEntity {
  id: EntityId
  order: number
}

export interface AboutParagraph extends OrderedEntity {
  body: string
}

export interface MediaAsset {
  id: EntityId
  source: string
  alt: string
  mimeType: string
}

export interface MediaUsage {
  id: EntityId
  ownerId: EntityId
  role: string
  mediaAssetId: EntityId
  objectPosition: string
}

export type PhotoAreaOwnerType = 'profile' | 'about' | 'college-entry' | 'shs-entry' | 'experience-entry' | 'certificate' | 'contact'

export interface PhotoAreaEntity {
  id: EntityId
  ownerType: PhotoAreaOwnerType
  ownerId: EntityId
  role: string
  section: string
  label: string
  source: string
  objectPosition: string
  persistence: 'runtime' | 'certificate-repository'
}

export interface AdminPropertyDefinition {
  key: string
  label: string
  group: 'Content' | 'Typography' | 'Layout' | 'Appearance' | 'Media' | 'Behavior'
  control: 'text' | 'textarea' | 'number' | 'color' | 'select' | 'checkbox'
  path: string
  unit?: string
  options?: string[]
}

export interface AdminEntityDefinition {
  id: EntityId
  section: string
  label: string
  kind: 'content' | 'text' | 'frame' | 'media' | 'navigation'
  properties: AdminPropertyDefinition[]
}
