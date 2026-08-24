import { createDefaultSiteSnapshot, type SiteSnapshot } from '../data/default/site'
import type { Database, Tables } from '../types/database.generated'
import type { MediaAsset, MediaUsage, PhotoAreaEntity } from '../types/site'
import { supabaseRestRequest, supabaseTableRows, supabaseUpsert } from '../lib/supabaseRest'
import type { CollegeItem } from '../data/default/college'
import type { SHSItem } from '../data/default/shs'
import type { ExperienceItem } from '../data/default/experience'
import type { SiteRepository } from './siteRepository'

type TableRow<Name extends keyof Database['public']['Tables']> = Tables<Name>
type JsonRecord = Record<string, unknown>

function clone<T>(value: T): T {
  return structuredClone(value)
}

function mergeRecord(target: JsonRecord, source: JsonRecord): void {
  for (const [key, value] of Object.entries(source)) {
    if (value && typeof value === 'object' && !Array.isArray(value) && target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])) {
      mergeRecord(target[key] as JsonRecord, value as JsonRecord)
    } else {
      target[key] = clone(value)
    }
  }
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' ? value as JsonRecord : {}
}

function first<T>(rows: T[]): T | undefined {
  return rows[0]
}

function mergeById<T extends { id: string }>(fallback: T[], persisted: T[]): T[] {
  const persistedById = new Map(persisted.map((item) => [item.id, item]))
  const fallbackIds = new Set(fallback.map((item) => item.id))
  return [
    ...fallback.map((item) => persistedById.get(item.id) ?? item),
    ...persisted.filter((item) => !fallbackIds.has(item.id))
  ]
}

function sourceForAsset(asset: TableRow<'media_assets'>): string {
  if (asset.source_url) return asset.source_url
  if (asset.storage_bucket && asset.storage_path) {
    return `${import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '')}/storage/v1/object/public/${asset.storage_bucket}/${asset.storage_path}`
  }
  return ''
}

function toMediaAsset(asset: TableRow<'media_assets'>): MediaAsset {
  return {
    id: asset.id,
    source: sourceForAsset(asset),
    alt: asset.alt_text,
    mimeType: asset.mime_type
  }
}

function toMediaUsage(row: TableRow<'entity_media'>): MediaUsage {
  return {
    id: row.id,
    ownerType: mediaUsageOwnerType(row.owner_type),
    ownerId: row.owner_id,
    role: row.role,
    mediaAssetId: row.media_asset_id,
    objectPosition: row.object_position
  }
}

function mediaUsageOwnerType(value: string): MediaUsage['ownerType'] {
  if (value === 'profile' || value === 'about' || value === 'contact') return value
  throw new Error(`Unsupported entity_media.owner_type: ${value}`)
}

function ownerType(value: string): PhotoAreaEntity['ownerType'] {
  if (value === 'profile' || value === 'about' || value === 'college-entry' || value === 'shs-entry' || value === 'experience-entry' || value === 'certificate' || value === 'contact') return value
  throw new Error(`Unsupported photo_frames.owner_type: ${value}`)
}

function sectionForOwner(value: string): string {
  if (value === 'college-entry') return 'College'
  if (value === 'shs-entry') return 'SHS'
  if (value === 'experience-entry') return 'Experience'
  if (value === 'certificate') return 'Certificate'
  if (value === 'contact') return 'Contact'
  if (value === 'profile') return 'Portfolio'
  return 'About'
}

function toPhotoArea(
  row: TableRow<'photo_frames'>,
  assets: Map<string, MediaAsset>,
  fallbackById: Map<string, PhotoAreaEntity>
): PhotoAreaEntity {
  const visual = asRecord(row.visual_config)
  const fallback = fallbackById.get(row.id)
  const objectPosition = row.object_position || (typeof visual.objectPosition === 'string' ? visual.objectPosition : fallback?.objectPosition ?? 'center center')
  return {
    id: row.id,
    ownerType: ownerType(row.owner_type),
    ownerId: row.owner_id,
    role: row.role,
    section: row.section || fallback?.section || sectionForOwner(row.owner_type),
    label: row.label || fallback?.label || row.role,
    source: row.media_asset_id ? assets.get(row.media_asset_id)?.source ?? '' : '',
    objectPosition,
    persistence: 'runtime'
  }
}

function applyVisualConfigs(snapshot: SiteSnapshot, rows: TableRow<'entity_visual_configs'>[]): void {
  for (const row of rows) {
    const config = asRecord(row.config)
    if (row.entity_type === 'section') {
      const section = snapshot.visual[row.entity_id as keyof SiteSnapshot['visual']]
      if (section && typeof section === 'object') mergeRecord(section as unknown as JsonRecord, config)
    }
  }
}

function pickValues(owner: JsonRecord, keys: string[]): JsonRecord {
  return Object.fromEntries(keys.filter((key) => key in owner).map((key) => [key, clone(owner[key])]))
}

function visualConfigRows(snapshot: SiteSnapshot): Array<{ entity_type: string; entity_id: string; config: JsonRecord }> {
  const portfolioTitle = snapshot.visual.portfolio.title as unknown as JsonRecord
  const aboutTitle = snapshot.visual.about.title as unknown as JsonRecord
  const aboutFrameMain = snapshot.visual.about.frameMain as unknown as JsonRecord
  const experienceFrames = Object.fromEntries(Object.entries(snapshot.visual.experience.imageFrames).map(([id, frame]) => {
    const record = frame as unknown as JsonRecord
    return [id, { ...pickValues(record, ['maxWidth', 'transformRotate', 'backgroundColor', 'borderRadius', 'boxShadow']) }]
  }))
  return [
    { entity_type: 'section', entity_id: 'portfolio', config: { title: pickValues(portfolioTitle, ['fontFamily', 'fontSize', 'color']) } },
    { entity_type: 'section', entity_id: 'about', config: { title: pickValues(aboutTitle, ['fontFamily', 'fontSize', 'color']), frameMain: pickValues(aboutFrameMain, ['left', 'top', 'width', 'height', 'transformRotate', 'backgroundColor', 'borderRadius', 'boxShadow']) } },
    { entity_type: 'section', entity_id: 'experience', config: { imageFrames: experienceFrames } }
  ]
}

function mediaRows(snapshot: SiteSnapshot) {
  const assetIdsBySource = new Map(snapshot.mediaAssets.filter((asset) => asset.source).map((asset) => [asset.source, asset.id]))
  const assets = snapshot.mediaAssets.map((asset) => {
    if (asset.source.startsWith('data:')) throw new Error('Storage upload is required before persisting a data URL')
    return { id: asset.id, storage_bucket: null, storage_path: null, mime_type: asset.mimeType, file_size: null, width: null, height: null, alt_text: asset.alt, source_url: asset.source || null }
  })
  const usages = snapshot.mediaUsages.map((usage) => ({ id: usage.id, owner_type: usage.ownerType, owner_id: usage.ownerId, role: usage.role, media_asset_id: usage.mediaAssetId, object_position: usage.objectPosition }))
  const frames = snapshot.photoAreas.map((area) => ({
    id: area.id,
    owner_type: area.ownerType,
    owner_id: area.ownerId,
    role: area.role,
    media_asset_id: assetIdsBySource.get(area.source) ?? null,
    section: area.section,
    label: area.label,
    object_position: area.objectPosition,
    visual_config: {},
    placeholder_config: {}
  }))
  return { assets, usages, frames }
}

export class SupabaseSiteRepository implements SiteRepository {
  private async patchOrder(table: string, ids: string[]): Promise<void> {
    await Promise.all(ids.map((id, order_index) => supabaseRestRequest(table, {
      method: 'PATCH', query: `?id=eq.${encodeURIComponent(id)}`, body: { order_index }, prefer: 'return=minimal'
    })))
  }

  private async deleteById(table: string, id: string): Promise<void> {
    await supabaseRestRequest(table, { method: 'DELETE', query: `?id=eq.${encodeURIComponent(id)}`, prefer: 'return=minimal' })
  }

  async createCollege(item: CollegeItem) { await this.updateCollege(item) }
  async updateCollege(item: CollegeItem) { await supabaseUpsert('college_entries', [{ id: item.id, label: item.label, school: item.school, period: item.period, description: item.description, frame_back_id: item.frameIds.back, frame_front_id: item.frameIds.front, order_index: item.order, active: true }]) }
  async deleteCollege(id: string) { await this.deleteById('college_entries', id) }
  async reorderCollege(ids: string[]) { await this.patchOrder('college_entries', ids) }

  async createShs(item: SHSItem) { await this.updateShs(item) }
  async updateShs(item: SHSItem) { await supabaseUpsert('shs_entries', [{ id: item.id, label: item.label, school: item.school, period: item.period, description: item.description, frame_back_id: item.frameIds.back, frame_front_id: item.frameIds.front, order_index: item.order, active: true }]) }
  async deleteShs(id: string) { await this.deleteById('shs_entries', id) }
  async reorderShs(ids: string[]) { await this.patchOrder('shs_entries', ids) }

  async createExperience(item: ExperienceItem) { await this.updateExperience(item) }
  async updateExperience(item: ExperienceItem) { await supabaseUpsert('experiences', [{ id: item.id, title: item.title, date: item.date, description: item.description, frame_id: item.frameId, order_index: item.order, active: true }]) }
  async deleteExperience(id: string) { await this.deleteById('experiences', id) }
  async reorderExperience(ids: string[]) { await this.patchOrder('experiences', ids) }

  async load(): Promise<SiteSnapshot> {
    const [
      profiles, aboutSections, paragraphs, education, college, shs, experiences,
      certificateSections, contacts, navigation, navigationConfigs,
      mediaAssets, mediaUsages, photoFrames, visualConfigs
    ] = await Promise.all([
      supabaseTableRows<TableRow<'portfolio_profile'>>('portfolio_profile'),
      supabaseTableRows<TableRow<'about_sections'>>('about_sections'),
      supabaseTableRows<TableRow<'about_paragraphs'>>('about_paragraphs'),
      supabaseTableRows<TableRow<'education_sections'>>('education_sections'),
      supabaseTableRows<TableRow<'college_entries'>>('college_entries'),
      supabaseTableRows<TableRow<'shs_entries'>>('shs_entries'),
      supabaseTableRows<TableRow<'experiences'>>('experiences'),
      supabaseTableRows<TableRow<'certificate_sections'>>('certificate_sections'),
      supabaseTableRows<TableRow<'contact_profiles'>>('contact_profiles'),
      supabaseTableRows<TableRow<'navigation_items'>>('navigation_items'),
      supabaseTableRows<TableRow<'navigation_config'>>('navigation_config'),
      supabaseTableRows<TableRow<'media_assets'>>('media_assets'),
      supabaseTableRows<TableRow<'entity_media'>>('entity_media'),
      supabaseTableRows<TableRow<'photo_frames'>>('photo_frames'),
      supabaseTableRows<TableRow<'entity_visual_configs'>>('entity_visual_configs')
    ])

    const snapshot = createDefaultSiteSnapshot()
    const assets = new Map(mediaAssets.map((row) => [row.id, toMediaAsset(row)]))
    const fallbackPhotoAreas = new Map(snapshot.photoAreas.map((area) => [area.id, area]))
    const persistedAreas = photoFrames.map((row) => toPhotoArea(row, assets, fallbackPhotoAreas))

    const activeProfiles = profiles.filter((row) => row.active)
    if (activeProfiles.length) {
      const profile = first(activeProfiles)
      if (profile) {
        snapshot.content.portfolio.title = profile.title
        snapshot.content.profile = { ...snapshot.content.profile, id: profile.id, name: profile.name, mediaUsageId: profile.media_usage_id ?? snapshot.content.profile.mediaUsageId }
      }
    }
    const about = first(aboutSections.filter((row) => row.active))
    if (about) {
      snapshot.content.about = {
        ...snapshot.content.about,
        id: about.id,
        title: about.title,
        cta: { id: about.cta_id ?? snapshot.content.about.cta.id, text: about.cta_text ?? snapshot.content.about.cta.text, targetSectionId: about.cta_target_section_id ?? snapshot.content.about.cta.targetSectionId }
      }
    }
    if (paragraphs.length) snapshot.content.about.paragraphs = paragraphs.filter((row) => row.about_section_id === snapshot.content.about.id && row.active).sort((left, right) => left.order_index - right.order_index).map((row) => ({ id: row.id, order: row.order_index, body: row.body }))
    const educationRow = first(education.filter((row) => row.active))
    if (educationRow) snapshot.content.education = { ...snapshot.content.education, id: educationRow.id, title: educationRow.title }
    if (college.length) snapshot.content.college.items = college.filter((row) => row.active).sort((left, right) => left.order_index - right.order_index).map((row) => {
      return { id: row.id, order: row.order_index, label: row.label, school: row.school, period: row.period, description: row.description, frameIds: { back: row.frame_back_id, front: row.frame_front_id } }
    })
    if (shs.length) snapshot.content.shs.items = shs.filter((row) => row.active).sort((left, right) => left.order_index - right.order_index).map((row) => {
      return { id: row.id, order: row.order_index, label: row.label, school: row.school, period: row.period, description: row.description, frameIds: { back: row.frame_back_id, front: row.frame_front_id } }
    })
    if (experiences.length) snapshot.content.experience.items = experiences.filter((row) => row.active).sort((left, right) => left.order_index - right.order_index).map((row) => {
      const fallback = snapshot.content.experience.items.find((item) => item.id === row.id)
      return { id: row.id, order: row.order_index, title: row.title, date: row.date, description: row.description, frameId: row.frame_id, layout: fallback?.layout ?? (row.order_index % 2 ? 'layout-img-left' : 'layout-text-left') }
    })
    const certificateSection = first(certificateSections.filter((row) => row.active))
    if (certificateSection) {
      snapshot.content.certificate = { ...snapshot.content.certificate, id: certificateSection.id, title: certificateSection.title }
      snapshot.behavior.certificate = { autoplay: certificateSection.autoplay, slideshowIntervalMs: certificateSection.slideshow_interval_ms }
    }
    if (contacts.length) {
      const contact = first(contacts.filter((row) => row.active))
      if (contact) snapshot.content.contact = { ...snapshot.content.contact, id: contact.id, line1: contact.line1, line2: contact.line2, personMediaUsageId: contact.person_media_usage_id ?? snapshot.content.contact.personMediaUsageId, cta: { id: contact.cta_id ?? snapshot.content.contact.cta.id, text: contact.cta_text ?? snapshot.content.contact.cta.text, href: contact.cta_href ?? '' } }
    }
    const navigationConfig = first(navigationConfigs)
    if (navigationConfig) {
      snapshot.content.navigation.brand = navigationConfig.brand
      if (Array.isArray(navigationConfig.sections)) snapshot.content.navigation.sections = navigationConfig.sections as unknown as typeof snapshot.content.navigation.sections
    }
    if (navigation.length) snapshot.content.navigation.navItems = navigation.filter((row) => row.visible).sort((left, right) => left.order_index - right.order_index).map((row) => ({ id: row.id, key: row.item_key, label: row.label, targetSectionId: row.target_section_id, offsetMode: row.offset_mode === 'align-bottom' ? 'align-bottom' as const : 'fixed' as const, offset: row.offset_value }))
    if (mediaAssets.length) snapshot.mediaAssets = mediaAssets.map(toMediaAsset)
    if (mediaUsages.length) snapshot.mediaUsages = mediaUsages.map(toMediaUsage)
    if (photoFrames.length) snapshot.photoAreas = mergeById(snapshot.photoAreas, persistedAreas)
    if (visualConfigs.length) applyVisualConfigs(snapshot, visualConfigs)
    return snapshot
  }

  async saveDraft(snapshot: SiteSnapshot): Promise<void> {
    const media = mediaRows(snapshot)
    await Promise.all([
      supabaseUpsert('portfolio_profile', [{ id: snapshot.content.profile.id, title: snapshot.content.portfolio.title, name: snapshot.content.profile.name, media_usage_id: snapshot.content.profile.mediaUsageId, active: true }]),
      supabaseUpsert('about_sections', [{ id: snapshot.content.about.id, title: snapshot.content.about.title, cta_id: snapshot.content.about.cta.id, cta_text: snapshot.content.about.cta.text, cta_target_section_id: snapshot.content.about.cta.targetSectionId, active: true }]),
      supabaseUpsert('about_paragraphs', snapshot.content.about.paragraphs.map((item) => ({ id: item.id, about_section_id: snapshot.content.about.id, body: item.body, order_index: item.order, active: true }))),
      supabaseUpsert('education_sections', [{ id: snapshot.content.education.id, title: snapshot.content.education.title, active: true }]),
      supabaseUpsert('college_entries', snapshot.content.college.items.map((item) => ({ id: item.id, label: item.label, school: item.school, period: item.period, description: item.description, frame_back_id: item.frameIds.back, frame_front_id: item.frameIds.front, order_index: item.order, active: true }))),
      supabaseUpsert('shs_entries', snapshot.content.shs.items.map((item) => ({ id: item.id, label: item.label, school: item.school, period: item.period, description: item.description, frame_back_id: item.frameIds.back, frame_front_id: item.frameIds.front, order_index: item.order, active: true }))),
      supabaseUpsert('experiences', snapshot.content.experience.items.map((item) => ({ id: item.id, title: item.title, date: item.date, description: item.description, frame_id: item.frameId, order_index: item.order, active: true }))),
      supabaseUpsert('certificate_sections', [{ id: snapshot.content.certificate.id, title: snapshot.content.certificate.title, autoplay: snapshot.behavior.certificate.autoplay, slideshow_interval_ms: snapshot.behavior.certificate.slideshowIntervalMs, active: true }]),
      supabaseUpsert('contact_profiles', [{ id: snapshot.content.contact.id, line1: snapshot.content.contact.line1, line2: snapshot.content.contact.line2, cta_id: snapshot.content.contact.cta.id, cta_text: snapshot.content.contact.cta.text, cta_href: snapshot.content.contact.cta.href || null, person_media_usage_id: snapshot.content.contact.personMediaUsageId, active: true }]),
      supabaseUpsert('navigation_items', snapshot.content.navigation.navItems.map((item, index) => ({ id: item.id, item_key: item.key, label: item.label, target_section_id: item.targetSectionId, offset_mode: item.offsetMode, offset_value: item.offset, order_index: index, visible: true }))),
      supabaseUpsert('navigation_config', [{ id: 'navigation', brand: snapshot.content.navigation.brand, sections: snapshot.content.navigation.sections }]),
      supabaseUpsert('entity_visual_configs', visualConfigRows(snapshot)),
      supabaseUpsert('media_assets', media.assets),
      supabaseUpsert('entity_media', media.usages),
      supabaseUpsert('photo_frames', media.frames)
    ])
  }
}
