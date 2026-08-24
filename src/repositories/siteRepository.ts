import { createDefaultSiteSnapshot, type SiteSnapshot } from '../data/default/site'
import type { CollegeItem } from '../data/default/college'
import type { SHSItem } from '../data/default/shs'
import type { ExperienceItem } from '../data/default/experience'
import { isSupabaseConfigured } from '../lib/supabaseRest'
import { SupabaseSiteRepository } from './supabaseSiteRepository'

export interface PortfolioRepository { loadPortfolio(): Promise<SiteSnapshot['content']['portfolio']> }
export interface AboutRepository { loadAbout(): Promise<SiteSnapshot['content']['about']> }
export interface EducationRepository { loadEducation(): Promise<Pick<SiteSnapshot['content'], 'education' | 'college' | 'shs'>> }
export interface ExperienceRepository { loadExperience(): Promise<SiteSnapshot['content']['experience']> }
export interface ContactRepository { loadContact(): Promise<SiteSnapshot['content']['contact']> }
export interface MediaRepository { loadMedia(): Promise<Pick<SiteSnapshot, 'mediaAssets' | 'mediaUsages' | 'photoAreas'>> }

export interface SiteRepository {
  load(): Promise<SiteSnapshot>
  saveDraft(snapshot: SiteSnapshot): Promise<void>
  createCollege(item: CollegeItem): Promise<void>
  updateCollege(item: CollegeItem): Promise<void>
  deleteCollege(id: string): Promise<void>
  reorderCollege(ids: string[]): Promise<void>
  createShs(item: SHSItem): Promise<void>
  updateShs(item: SHSItem): Promise<void>
  deleteShs(id: string): Promise<void>
  reorderShs(ids: string[]): Promise<void>
  createExperience(item: ExperienceItem): Promise<void>
  updateExperience(item: ExperienceItem): Promise<void>
  deleteExperience(id: string): Promise<void>
  reorderExperience(ids: string[]): Promise<void>
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

  async createCollege(item: CollegeItem) { const snapshot = await this.load(); snapshot.content.college.items.push(structuredClone(item)); await this.saveDraft(snapshot) }
  async updateCollege(item: CollegeItem) { const snapshot = await this.load(); snapshot.content.college.items = snapshot.content.college.items.map((value) => value.id === item.id ? structuredClone(item) : value); await this.saveDraft(snapshot) }
  async deleteCollege(id: string) { const snapshot = await this.load(); snapshot.content.college.items = snapshot.content.college.items.filter((value) => value.id !== id); await this.saveDraft(snapshot) }
  async reorderCollege(ids: string[]) { const snapshot = await this.load(); const order = new Map(ids.map((id, index) => [id, index])); snapshot.content.college.items = snapshot.content.college.items.map((value) => ({ ...value, order: order.get(value.id) ?? value.order })); await this.saveDraft(snapshot) }
  async createShs(item: SHSItem) { const snapshot = await this.load(); snapshot.content.shs.items.push(structuredClone(item)); await this.saveDraft(snapshot) }
  async updateShs(item: SHSItem) { const snapshot = await this.load(); snapshot.content.shs.items = snapshot.content.shs.items.map((value) => value.id === item.id ? structuredClone(item) : value); await this.saveDraft(snapshot) }
  async deleteShs(id: string) { const snapshot = await this.load(); snapshot.content.shs.items = snapshot.content.shs.items.filter((value) => value.id !== id); await this.saveDraft(snapshot) }
  async reorderShs(ids: string[]) { const snapshot = await this.load(); const order = new Map(ids.map((id, index) => [id, index])); snapshot.content.shs.items = snapshot.content.shs.items.map((value) => ({ ...value, order: order.get(value.id) ?? value.order })); await this.saveDraft(snapshot) }
  async createExperience(item: ExperienceItem) { const snapshot = await this.load(); snapshot.content.experience.items.push(structuredClone(item)); await this.saveDraft(snapshot) }
  async updateExperience(item: ExperienceItem) { const snapshot = await this.load(); snapshot.content.experience.items = snapshot.content.experience.items.map((value) => value.id === item.id ? structuredClone(item) : value); await this.saveDraft(snapshot) }
  async deleteExperience(id: string) { const snapshot = await this.load(); snapshot.content.experience.items = snapshot.content.experience.items.filter((value) => value.id !== id); await this.saveDraft(snapshot) }
  async reorderExperience(ids: string[]) { const snapshot = await this.load(); const order = new Map(ids.map((id, index) => [id, index])); snapshot.content.experience.items = snapshot.content.experience.items.map((value) => ({ ...value, order: order.get(value.id) ?? value.order })); await this.saveDraft(snapshot) }
}

export const siteRepository: SiteRepository = isSupabaseConfigured()
  ? new SupabaseSiteRepository()
  : new StaticSiteRepository()
