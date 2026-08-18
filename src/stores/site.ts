import { defineStore } from 'pinia'
import { createDefaultSiteSnapshot, type SiteSnapshot } from '../data/default/site'
import { createExperienceFrameConfig } from '../data/default/visual/experience'
import { siteRepository } from '../repositories/siteRepository'

function ordered<T extends { order: number }>(items: T[]): T[] {
  return [...items].sort((left, right) => left.order - right.order)
}

function assertUniqueIds(ids: string[], label: string) {
  if (new Set(ids).size !== ids.length) throw new Error(`Duplicate ${label} ID`)
}

export const useSiteStore = defineStore('site', {
  state: () => ({
    current: createDefaultSiteSnapshot(),
    isLoading: false,
    errorMessage: ''
  }),
  getters: {
    aboutParagraphs: (state) => ordered(state.current.content.about.paragraphs),
    collegeEntries: (state) => ordered(state.current.content.college.items),
    shsEntries: (state) => ordered(state.current.content.shs.items),
    experienceEntries: (state) => ordered(state.current.content.experience.items),
    experienceScrollBudgetVh(): number {
      return Math.max(1, this.experienceEntries.length) * 100
    }
  },
  actions: {
    async load() {
      this.isLoading = true
      this.errorMessage = ''
      try { this.current = await siteRepository.load() }
      catch { this.errorMessage = 'Site draft tidak dapat dimuat.' }
      finally { this.isLoading = false }
    },
    async saveDraft() {
      await siteRepository.saveDraft(this.current as SiteSnapshot)
    },
    resetToSeed() {
      this.current = createDefaultSiteSnapshot()
    },
    mediaSourceForUsage(usageId: string): string {
      const usage = this.current.mediaUsages.find((candidate) => candidate.id === usageId)
      return this.current.mediaAssets.find((asset) => asset.id === usage?.mediaAssetId)?.source ?? ''
    },
    mediaObjectPositionForUsage(usageId: string): string {
      return this.current.mediaUsages.find((candidate) => candidate.id === usageId)?.objectPosition ?? '50% 50%'
    },
    setMediaUsageSource(usageId: string, source: string) {
      const usage = this.current.mediaUsages.find((candidate) => candidate.id === usageId)
      if (!usage) throw new Error(`Unknown media usage: ${usageId}`)
      const sharedBy = this.current.mediaUsages.filter((candidate) => candidate.mediaAssetId === usage.mediaAssetId)
      if (sharedBy.length > 1) {
        const currentAsset = this.current.mediaAssets.find((asset) => asset.id === usage.mediaAssetId)
        const assetId = `${usage.id}-asset`
        const replacement = { id: assetId, source, alt: currentAsset?.alt ?? usage.role, mimeType: currentAsset?.mimeType ?? '' }
        const existingIndex = this.current.mediaAssets.findIndex((asset) => asset.id === assetId)
        if (existingIndex >= 0) this.current.mediaAssets[existingIndex] = replacement
        else this.current.mediaAssets.push(replacement)
        usage.mediaAssetId = assetId
        return
      }
      const asset = this.current.mediaAssets.find((candidate) => candidate.id === usage.mediaAssetId)
      if (!asset) throw new Error(`Unknown media asset: ${usage.mediaAssetId}`)
      asset.source = source
    },
    setMediaUsageObjectPosition(usageId: string, objectPosition: string) {
      const usage = this.current.mediaUsages.find((candidate) => candidate.id === usageId)
      if (!usage) throw new Error(`Unknown media usage: ${usageId}`)
      usage.objectPosition = objectPosition
    },
    photoAreaSource(photoAreaId: string): string {
      return this.current.photoAreas.find((area) => area.id === photoAreaId)?.source ?? ''
    },
    setPhotoAreaSource(photoAreaId: string, source: string) {
      const area = this.current.photoAreas.find((candidate) => candidate.id === photoAreaId)
      if (!area) throw new Error(`Unknown photo area: ${photoAreaId}`)
      area.source = source
    },
    setPhotoAreaObjectPosition(photoAreaId: string, objectPosition: string) {
      const area = this.current.photoAreas.find((candidate) => candidate.id === photoAreaId)
      if (!area) throw new Error(`Unknown photo area: ${photoAreaId}`)
      area.objectPosition = objectPosition
    },
    replaceAboutParagraphs(paragraphs: SiteSnapshot['content']['about']['paragraphs']) {
      assertUniqueIds(paragraphs.map((paragraph) => paragraph.id), 'about paragraph')
      this.current.content.about.paragraphs = structuredClone(paragraphs)
    },
    replaceCollegeItems(items: SiteSnapshot['content']['college']['items']) {
      assertUniqueIds(items.map((item) => item.id), 'college entity')
      assertUniqueIds(items.flatMap((item) => [item.frameIds.back, item.frameIds.front]), 'college frame')
      const retained = this.current.photoAreas.filter((area) => area.ownerType !== 'college-entry')
      this.current.photoAreas = [...retained, ...items.flatMap((item) => [
        { id: item.frameIds.back, ownerType: 'college-entry' as const, ownerId: item.id, role: 'frame-back', section: 'College', label: `${item.school} back`, source: '', objectPosition: this.current.visual.college.frameBackImage.objectPosition, persistence: 'runtime' as const },
        { id: item.frameIds.front, ownerType: 'college-entry' as const, ownerId: item.id, role: 'frame-front', section: 'College', label: `${item.school} front`, source: '', objectPosition: this.current.visual.college.frameFrontImage.objectPosition, persistence: 'runtime' as const }
      ])]
      this.current.content.college.items = structuredClone(items)
    },
    replaceShsItems(items: SiteSnapshot['content']['shs']['items']) {
      assertUniqueIds(items.map((item) => item.id), 'SHS entity')
      assertUniqueIds(items.flatMap((item) => [item.frameIds.back, item.frameIds.front]), 'SHS frame')
      const retained = this.current.photoAreas.filter((area) => area.ownerType !== 'shs-entry')
      this.current.photoAreas = [...retained, ...items.flatMap((item) => [
        { id: item.frameIds.back, ownerType: 'shs-entry' as const, ownerId: item.id, role: 'frame-back', section: 'SHS', label: `${item.school} back`, source: '', objectPosition: this.current.visual.shs.frameBackImage.objectPosition, persistence: 'runtime' as const },
        { id: item.frameIds.front, ownerType: 'shs-entry' as const, ownerId: item.id, role: 'frame-front', section: 'SHS', label: `${item.school} front`, source: '', objectPosition: this.current.visual.shs.frameFrontImage.objectPosition, persistence: 'runtime' as const }
      ])]
      this.current.content.shs.items = structuredClone(items)
    },
    replaceExperienceItems(items: SiteSnapshot['content']['experience']['items']) {
      assertUniqueIds(items.map((item) => item.id), 'experience entity')
      assertUniqueIds(items.map((item) => item.frameId), 'experience frame')
      const retained = this.current.photoAreas.filter((area) => area.ownerType !== 'experience-entry')
      for (const item of items) {
        if (!this.current.visual.experience.imageFrames[item.frameId]) {
          this.current.visual.experience.imageFrames[item.frameId] = createExperienceFrameConfig(item.frameId, item.order % 2 ? '2deg' : '-2deg')
        }
      }
      this.current.photoAreas = [...retained, ...items.map((item) => ({
        id: item.frameId, ownerType: 'experience-entry' as const, ownerId: item.id, role: 'frame', section: 'Experience', label: item.title,
        source: '', objectPosition: this.current.visual.experience.imageFrames[item.frameId].image.objectPosition, persistence: 'runtime' as const
      }))]
      this.current.content.experience.items = structuredClone(items)
    }
  }
})
