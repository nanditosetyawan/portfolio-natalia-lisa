import { createDefaultSiteSnapshot, type SiteSnapshot } from '../data/default/site'

export interface PortfolioRepository { loadPortfolio(): Promise<SiteSnapshot['content']['portfolio']> }
export interface AboutRepository { loadAbout(): Promise<SiteSnapshot['content']['about']> }
export interface EducationRepository { loadEducation(): Promise<Pick<SiteSnapshot['content'], 'education' | 'college' | 'shs'>> }
export interface ExperienceRepository { loadExperience(): Promise<SiteSnapshot['content']['experience']> }
export interface ContactRepository { loadContact(): Promise<SiteSnapshot['content']['contact']> }
export interface MediaRepository { loadMedia(): Promise<Pick<SiteSnapshot, 'mediaAssets' | 'mediaUsages' | 'photoAreas'>> }

export interface SiteRepository {
  load(): Promise<SiteSnapshot>
  saveDraft(snapshot: SiteSnapshot): Promise<void>
}

/** Current pre-backend adapter: immutable seed fallback plus process-local draft. */
export class StaticSiteRepository implements SiteRepository {
  private draft: SiteSnapshot | null = null

  async load(): Promise<SiteSnapshot> {
    return structuredClone(this.draft ?? createDefaultSiteSnapshot())
  }

  async saveDraft(snapshot: SiteSnapshot): Promise<void> {
    this.draft = structuredClone(snapshot)
  }
}

export const siteRepository: SiteRepository = new StaticSiteRepository()
