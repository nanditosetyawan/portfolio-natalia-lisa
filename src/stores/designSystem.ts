import { defineStore } from 'pinia'
import {
  auditDesignTheme,
  createDefaultDesignTheme,
  designTokenRegistry,
  typographyRoleRegistry
} from '../editor/designSystemRegistry'
import { isSupabaseConfigured, supabaseRestRequest, supabaseTableRows } from '../lib/supabaseRest'
import { useAuthStore } from './auth'
import type { EditorValue } from '../types/editor'
import type {
  ButtonAssignment,
  ButtonSizeId,
  ButtonVariantId,
  DesignReferenceContext,
  DesignReferenceState,
  DesignScope,
  DesignStyleReference,
  DesignSystemWorkspace,
  DesignTheme,
  ResolvedDesignReference,
  SavedComponentPreset,
  SavedSectionTemplate,
  TypographyAssignment,
  TypographyRoleId
} from '../types/designSystem'

const STORAGE_KEY = 'portfolio-editor-design-system-v1'
const DIRTY_STORAGE_KEY = 'portfolio-editor-design-system-dirty-v1'
const CLOUD_TABLE = 'design_system_workspaces'
const CLOUD_SYNC_DEBOUNCE_MS = 700
const MAX_WORKSPACE_BYTES = 2 * 1024 * 1024

let mutationSeq = 0
let cloudSyncPromise: Promise<void> | null = null
let cloudFlushPromise: Promise<boolean> | null = null
let cloudDebounceTimer: number | null = null
let cloudTableUnavailable = false
let hadLocalStorageOnInit = false
let storageListenerBound = false

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

const emptyReferences = (): DesignReferenceState => ({ theme: {}, sections: {}, components: {}, objects: {} })

function defaultWorkspace(): DesignSystemWorkspace {
  const theme = createDefaultDesignTheme()
  return {
    version: 1,
    themes: [theme],
    activeThemeId: theme.id,
    previewThemeId: null,
    references: emptyReferences(),
    typographyAssignments: {},
    buttonAssignments: {},
    sectionTemplates: [],
    componentPresets: []
  }
}

function validRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizeTheme(value: unknown, fallback: DesignTheme): DesignTheme | null {
  if (!validRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string' || !validRecord(value.tokens)) return null
  const tokenSource = value.tokens
  const tokens = Object.fromEntries(designTokenRegistry.map((token) => {
    const candidate = tokenSource[token.id] as EditorValue
    return [token.id, token.validate(candidate as EditorValue) ? fallback.tokens[token.id] : candidate]
  })) as Record<string, EditorValue>
  const typographySource = validRecord(value.typography) ? value.typography : {}
  const typography = Object.fromEntries(typographyRoleRegistry.map((role) => {
    const candidate = typographySource[role.id]
    return [role.id, validRecord(candidate) ? { ...role.values, ...candidate } : { ...role.values }]
  })) as DesignTheme['typography']
  return {
    id: value.id,
    name: value.name.trim() || fallback.name,
    tokens,
    typography,
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : fallback.createdAt,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : fallback.updatedAt
  }
}

function normalizeReferences(value: unknown): DesignReferenceState {
  if (!validRecord(value)) return emptyReferences()
  const reference = (candidate: unknown): DesignStyleReference | null => {
    if (!validRecord(candidate) || typeof candidate.tokenId !== 'string' || typeof candidate.overridden !== 'boolean') return null
    if (!designTokenRegistry.some((token) => token.id === candidate.tokenId)) return null
    return { tokenId: candidate.tokenId, overridden: candidate.overridden }
  }
  const flat = (candidate: unknown) => validRecord(candidate)
    ? Object.fromEntries(Object.entries(candidate).flatMap(([styleKey, item]) => {
      const normalized = reference(item)
      return normalized ? [[styleKey, normalized]] : []
    }))
    : {}
  const nested = (candidate: unknown) => validRecord(candidate)
    ? Object.fromEntries(Object.entries(candidate).map(([scopeId, item]) => [scopeId, flat(item)]))
    : {}
  return {
    theme: flat(value.theme),
    sections: nested(value.sections),
    components: nested(value.components),
    objects: nested(value.objects)
  }
}

interface CloudDesignWorkspaceRow {
  user_id?: string
  workspace: unknown
  updated_at?: string
}

function safeIsoDate(value: unknown, fallback: string): string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : fallback
}

function normalizeSectionTemplates(value: unknown): SavedSectionTemplate[] {
  if (!Array.isArray(value)) return []
  const now = new Date().toISOString()
  const seen = new Set<string>()
  const templates: SavedSectionTemplate[] = []
  for (const item of value) {
    if (!validRecord(item) || typeof item.id !== 'string' || !item.id.trim() || seen.has(item.id)) continue
    if (typeof item.name !== 'string' || typeof item.sourceSection !== 'string' || !validRecord(item.styleValues)) continue
    const styleValues = Object.fromEntries(
      Object.entries(item.styleValues).filter(([, entry]) => validRecord(entry))
    ) as SavedSectionTemplate['styleValues']
    seen.add(item.id)
    templates.push({
      id: item.id.trim(),
      name: item.name.trim() || `${item.sourceSection} Style`,
      sourceSection: item.sourceSection,
      createdAt: safeIsoDate(item.createdAt, now),
      styleValues: clone(styleValues)
    })
  }
  return templates
}

function normalizeComponentPresets(value: unknown): SavedComponentPreset[] {
  if (!Array.isArray(value)) return []
  const now = new Date().toISOString()
  const seen = new Set<string>()
  const presets: SavedComponentPreset[] = []
  for (const item of value) {
    if (!validRecord(item) || typeof item.id !== 'string' || !item.id.trim() || seen.has(item.id)) continue
    if (typeof item.name !== 'string' || typeof item.sourceType !== 'string' || !validRecord(item.styleValues)) continue
    seen.add(item.id)
    presets.push({
      id: item.id.trim(),
      name: item.name.trim() || `${item.sourceType} Style`,
      sourceType: item.sourceType as SavedComponentPreset['sourceType'],
      createdAt: safeIsoDate(item.createdAt, now),
      styleValues: clone(item.styleValues) as SavedComponentPreset['styleValues']
    })
  }
  return presets
}

export function normalizeDesignSystemWorkspace(value: unknown): DesignSystemWorkspace {
  const fallback = defaultWorkspace()
  if (!validRecord(value) || value.version !== 1) return fallback
  const themes = Array.isArray(value.themes)
    ? value.themes.flatMap((theme) => {
      const normalized = normalizeTheme(theme, fallback.themes[0]!)
      return normalized ? [normalized] : []
    })
    : []
  if (!themes.length) themes.push(fallback.themes[0]!)
  const activeThemeId = typeof value.activeThemeId === 'string' && themes.some((theme) => theme.id === value.activeThemeId)
    ? value.activeThemeId
    : themes[0]!.id
  return {
    version: 1,
    themes,
    activeThemeId,
    previewThemeId: typeof value.previewThemeId === 'string' && themes.some((theme) => theme.id === value.previewThemeId) ? value.previewThemeId : null,
    references: normalizeReferences(value.references),
    typographyAssignments: validRecord(value.typographyAssignments) ? clone(value.typographyAssignments) as Record<string, TypographyAssignment> : {},
    buttonAssignments: validRecord(value.buttonAssignments) ? clone(value.buttonAssignments) as Record<string, ButtonAssignment> : {},
    sectionTemplates: normalizeSectionTemplates(value.sectionTemplates),
    componentPresets: normalizeComponentPresets(value.componentPresets)
  }
}

function readDirtyFlag(): boolean {
  if (typeof window === 'undefined') return false
  try { return window.localStorage.getItem(DIRTY_STORAGE_KEY) === '1' } catch { return false }
}

function writeDirtyFlag(dirty: boolean): void {
  if (typeof window === 'undefined') return
  try {
    if (dirty) window.localStorage.setItem(DIRTY_STORAGE_KEY, '1')
    else window.localStorage.removeItem(DIRTY_STORAGE_KEY)
  } catch { /* Ignore quota/private-mode storage locks cleanly. */ }
}

function writeWorkspaceToLocalStorage(workspace: DesignSystemWorkspace): string {
  if (typeof window === 'undefined') return ''
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace))
    return ''
  } catch (error) {
    return error instanceof Error ? error.message : 'Design System state could not be saved.'
  }
}

function hasCustomWorkspaceContent(workspace: DesignSystemWorkspace): boolean {
  if (workspace.themes.length > 1 || workspace.sectionTemplates.length > 0 || workspace.componentPresets.length > 0) return true
  if (Object.keys(workspace.typographyAssignments).length > 0 || Object.keys(workspace.buttonAssignments).length > 0) return true
  if (
    Object.keys(workspace.references.theme).length > 0
    || Object.keys(workspace.references.sections).length > 0
    || Object.keys(workspace.references.components).length > 0
    || Object.keys(workspace.references.objects).length > 0
  ) return true
  const baseline = createDefaultDesignTheme()
  const active = workspace.themes[0]
  if (!active) return false
  return active.name !== baseline.name
    || JSON.stringify(active.tokens) !== JSON.stringify(baseline.tokens)
    || JSON.stringify(active.typography) !== JSON.stringify(baseline.typography)
}

function isMissingCloudTableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return error.message.includes('(404)') || error.message.includes('PGRST205') || error.message.includes(`Could not find the table 'public.${CLOUD_TABLE}'`)
}

let syncedUserId: string | null = null

async function resolveCloudAdminUserId(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null
  const auth = useAuthStore()
  if (!auth.isInitialized && !auth.isLoading) {
    try { await auth.initialize() } catch { return null }
  }
  const userId = auth.session?.user?.id ?? null
  if (!auth.isAdmin || !userId || !auth.session?.access_token) return null
  if (syncedUserId !== userId) {
    syncedUserId = userId
    cloudTableUnavailable = false
  }
  return cloudTableUnavailable ? null : userId
}

function scopeId(scope: DesignScope, context: DesignReferenceContext): string {
  if (scope === 'section') return context.section
  if (scope === 'component') return context.component
  if (scope === 'object') return context.objectId
  return 'theme'
}

export const useDesignSystemStore = defineStore('designSystem', {
  state: () => ({
    workspace: defaultWorkspace(),
    initialized: false,
    persistenceError: '',
    syncState: 'idle' as 'idle' | 'syncing' | 'ready' | 'local-only' | 'error',
    cloudSynced: false,
    cloudUpdatedAt: null as string | null,
    hasPendingCloudSave: false
  }),
  getters: {
    activeTheme(state): DesignTheme {
      return state.workspace.themes.find((theme) => theme.id === state.workspace.activeThemeId) ?? state.workspace.themes[0]!
    },
    previewTheme(state): DesignTheme {
      const themeId = state.workspace.previewThemeId ?? state.workspace.activeThemeId
      return state.workspace.themes.find((theme) => theme.id === themeId) ?? state.workspace.themes[0]!
    },
    accessibilityIssues(): ReturnType<typeof auditDesignTheme> {
      return auditDesignTheme(this.previewTheme)
    }
  },
  actions: {
    initialize() {
      if (this.initialized) return
      this.initialized = true
      if (typeof window === 'undefined') return
      this.hasPendingCloudSave = readDirtyFlag()
      if (!storageListenerBound) {
        storageListenerBound = true
        window.addEventListener('storage', (event) => {
          if (event.key !== STORAGE_KEY || !event.newValue || this.hasPendingCloudSave || cloudFlushPromise) return
          try {
            this.workspace = normalizeDesignSystemWorkspace(JSON.parse(event.newValue))
          } catch { /* Keep current workspace on malformed sibling-tab value. */ }
        })
      }
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY)
        if (saved) {
          hadLocalStorageOnInit = true
          this.workspace = normalizeDesignSystemWorkspace(JSON.parse(saved))
        }
      } catch (error) {
        this.persistenceError = error instanceof Error ? error.message : 'Design System state could not be restored.'
      }
    },
    scheduleCloudFlush() {
      if (typeof window === 'undefined' || !isSupabaseConfigured() || cloudTableUnavailable) return
      if (cloudDebounceTimer !== null) window.clearTimeout(cloudDebounceTimer)
      cloudDebounceTimer = window.setTimeout(() => {
        cloudDebounceTimer = null
        void this.flushCloudSync()
      }, CLOUD_SYNC_DEBOUNCE_MS)
    },
    async syncFromCloud(): Promise<void> {
      this.initialize()
      if (cloudSyncPromise) return cloudSyncPromise
      cloudSyncPromise = (async () => {
        const userId = await resolveCloudAdminUserId()
        if (!userId) return
        const startSeq = mutationSeq
        const pendingDirty = readDirtyFlag() || this.hasPendingCloudSave
        this.syncState = 'syncing'
        try {
          const rows = await supabaseTableRows<CloudDesignWorkspaceRow>(
            CLOUD_TABLE,
            `?select=workspace,updated_at&user_id=eq.${encodeURIComponent(userId)}&limit=1`
          )
          if (mutationSeq !== startSeq) {
            this.scheduleCloudFlush()
            return
          }
          const cloudRow = rows[0]
          if (cloudRow) {
            if (pendingDirty) {
              await this.flushCloudSync()
              return
            }
            const normalized = normalizeDesignSystemWorkspace(cloudRow.workspace)
            this.workspace = normalized
            const storageError = writeWorkspaceToLocalStorage(normalized)
            writeDirtyFlag(false)
            this.hasPendingCloudSave = false
            this.cloudUpdatedAt = typeof cloudRow.updated_at === 'string' ? cloudRow.updated_at : null
            this.cloudSynced = true
            this.syncState = 'ready'
            this.persistenceError = storageError
            return
          }

          if ((hadLocalStorageOnInit || pendingDirty) && hasCustomWorkspaceContent(this.workspace)) {
            await this.flushCloudSync()
          } else {
            this.cloudSynced = true
            this.syncState = 'ready'
            this.persistenceError = ''
          }
        } catch (error) {
          if (isMissingCloudTableError(error)) {
            cloudTableUnavailable = true
            this.syncState = 'local-only'
            return
          }
          this.syncState = 'error'
          this.persistenceError = 'Cloud Design System sync failed; local changes were kept.'
        }
      })().finally(() => {
        cloudSyncPromise = null
      })
      return cloudSyncPromise
    },
    async flushCloudSync(): Promise<boolean> {
      this.initialize()
      if (typeof window !== 'undefined' && cloudDebounceTimer !== null) {
        window.clearTimeout(cloudDebounceTimer)
        cloudDebounceTimer = null
      }
      if (cloudFlushPromise) {
        const prev = await cloudFlushPromise
        if (!this.hasPendingCloudSave && !readDirtyFlag()) return prev
      }
      const task = (async (): Promise<boolean> => {
        const userId = await resolveCloudAdminUserId()
        if (!userId) return false
        const targetSeq = mutationSeq
        const serialized = JSON.stringify(this.workspace)
        if (new TextEncoder().encode(serialized).byteLength > MAX_WORKSPACE_BYTES) {
          this.syncState = 'error'
          this.persistenceError = 'Design System workspace exceeds the 2 MB Cloud storage limit; saved locally only.'
          return false
        }
        const payload = JSON.parse(serialized) as DesignSystemWorkspace
        this.syncState = 'syncing'
        try {
          await supabaseRestRequest<void>(`${CLOUD_TABLE}?on_conflict=user_id`, {
            method: 'POST',
            body: { user_id: userId, workspace: payload },
            prefer: 'resolution=merge-duplicates,return=minimal'
          })
          if (mutationSeq === targetSeq) {
            writeDirtyFlag(false)
            this.hasPendingCloudSave = false
            this.cloudSynced = true
            this.cloudUpdatedAt = new Date().toISOString()
            this.syncState = 'ready'
            this.persistenceError = ''
          } else {
            this.scheduleCloudFlush()
          }
          return true
        } catch (error) {
          if (isMissingCloudTableError(error)) {
            cloudTableUnavailable = true
            this.syncState = 'local-only'
            return false
          }
          this.syncState = 'error'
          this.persistenceError = 'Cloud Design System save failed; changes remain saved in this browser.'
          return false
        }
      })()
      cloudFlushPromise = task.finally(() => {
        if (cloudFlushPromise === task) cloudFlushPromise = null
      })
      return cloudFlushPromise
    },
    async replaceWorkspace(workspace: unknown): Promise<{ localSaved: boolean; cloudSynced: boolean; message: string }> {
      this.initialize()
      const normalized = normalizeDesignSystemWorkspace(workspace)
      this.workspace = normalized
      this.persist(true)
      const localSaved = !this.persistenceError
      if (!isSupabaseConfigured()) {
        return { localSaved, cloudSynced: false, message: localSaved ? 'Design System restored locally.' : this.persistenceError }
      }
      const synced = await this.flushCloudSync()
      if (synced) return { localSaved, cloudSynced: true, message: 'Design System restored and synced to Cloud.' }
      if (cloudTableUnavailable) return { localSaved, cloudSynced: false, message: 'Design System restored in browser (Cloud table pending migration).' }
      return { localSaved, cloudSynced: false, message: this.persistenceError || 'Design System restored locally; Cloud sync skipped.' }
    },
    persist(skipDebounce = false) {
      mutationSeq += 1
      const cloudEnabled = isSupabaseConfigured()
      this.hasPendingCloudSave = cloudEnabled
      writeDirtyFlag(cloudEnabled)
      const storageError = writeWorkspaceToLocalStorage(this.workspace)
      this.persistenceError = storageError
      if (cloudEnabled && !skipDebounce) this.scheduleCloudFlush()
    },
    createTheme(name = 'Untitled Theme'): DesignTheme {
      const base = this.previewTheme
      const now = new Date().toISOString()
      const theme: DesignTheme = {
        ...clone(base),
        id: `theme-${crypto.randomUUID()}`,
        name: name.trim() || 'Untitled Theme',
        createdAt: now,
        updatedAt: now
      }
      this.workspace.themes.push(theme)
      this.workspace.activeThemeId = theme.id
      this.workspace.previewThemeId = null
      this.persist()
      return theme
    },
    duplicateTheme(themeId: string): DesignTheme | null {
      const source = this.workspace.themes.find((theme) => theme.id === themeId)
      if (!source) return null
      const now = new Date().toISOString()
      const theme = { ...clone(source), id: `theme-${crypto.randomUUID()}`, name: `${source.name} Copy`, createdAt: now, updatedAt: now }
      this.workspace.themes.push(theme)
      this.workspace.activeThemeId = theme.id
      this.workspace.previewThemeId = null
      this.persist()
      return theme
    },
    renameTheme(themeId: string, name: string): boolean {
      const theme = this.workspace.themes.find((candidate) => candidate.id === themeId)
      if (!theme || !name.trim()) return false
      theme.name = name.trim()
      theme.updatedAt = new Date().toISOString()
      this.persist()
      return true
    },
    deleteTheme(themeId: string): boolean {
      if (this.workspace.themes.length <= 1) return false
      const index = this.workspace.themes.findIndex((theme) => theme.id === themeId)
      if (index < 0) return false
      this.workspace.themes.splice(index, 1)
      if (this.workspace.activeThemeId === themeId) this.workspace.activeThemeId = this.workspace.themes[0]!.id
      if (this.workspace.previewThemeId === themeId) this.workspace.previewThemeId = null
      this.persist()
      return true
    },
    preview(themeId: string): boolean {
      if (!this.workspace.themes.some((theme) => theme.id === themeId)) return false
      this.workspace.previewThemeId = themeId
      this.persist()
      return true
    },
    activate(themeId: string): boolean {
      if (!this.workspace.themes.some((theme) => theme.id === themeId)) return false
      this.workspace.activeThemeId = themeId
      this.workspace.previewThemeId = null
      this.persist()
      return true
    },
    updateToken(themeId: string, tokenId: string, value: EditorValue): string | null {
      const theme = this.workspace.themes.find((candidate) => candidate.id === themeId)
      const token = designTokenRegistry.find((candidate) => candidate.id === tokenId)
      if (!theme || !token) return 'Unknown Theme or token.'
      const error = token.validate(value)
      if (error) return error
      theme.tokens[tokenId] = value
      theme.updatedAt = new Date().toISOString()
      this.persist()
      return null
    },
    updateTypography(themeId: string, roleId: TypographyRoleId, styleKey: string, value: EditorValue): boolean {
      const theme = this.workspace.themes.find((candidate) => candidate.id === themeId)
      if (!theme?.typography[roleId]) return false
      theme.typography[roleId][styleKey] = value
      theme.updatedAt = new Date().toISOString()
      this.persist()
      return true
    },
    resolveReference(context: DesignReferenceContext, styleKey: string): ResolvedDesignReference | null {
      const levels: Array<[DesignScope, string, Record<string, DesignStyleReference> | undefined]> = [
        ['object', context.objectId, this.workspace.references.objects[context.objectId]],
        ['component', context.component, this.workspace.references.components[context.component]],
        ['section', context.section, this.workspace.references.sections[context.section]],
        ['theme', 'theme', this.workspace.references.theme]
      ]
      for (const [scope, id, bucket] of levels) {
        const reference = bucket?.[styleKey]
        if (reference) return { ...reference, scope, scopeId: id }
      }
      return null
    },
    setReference(scope: DesignScope, context: DesignReferenceContext, styleKey: string, tokenId: string): boolean {
      if (!designTokenRegistry.some((token) => token.id === tokenId)) return false
      const reference = { tokenId, overridden: false }
      if (scope === 'theme') this.workspace.references.theme[styleKey] = reference
      else {
        const collection = scope === 'section' ? this.workspace.references.sections : scope === 'component' ? this.workspace.references.components : this.workspace.references.objects
        const id = scopeId(scope, context)
        collection[id] ??= {}
        collection[id]![styleKey] = reference
      }
      this.persist()
      return true
    },
    removeReference(scope: DesignScope, context: DesignReferenceContext, styleKey: string): boolean {
      const id = scopeId(scope, context)
      const bucket = scope === 'theme' ? this.workspace.references.theme
        : scope === 'section' ? this.workspace.references.sections[id]
          : scope === 'component' ? this.workspace.references.components[id]
            : this.workspace.references.objects[id]
      if (!bucket?.[styleKey]) return false
      delete bucket[styleKey]
      this.persist()
      return true
    },
    markOverride(context: DesignReferenceContext, styleKey: string): ResolvedDesignReference | null {
      const inherited = this.resolveReference(context, styleKey)
      if (!inherited) return null
      this.workspace.references.objects[context.objectId] ??= {}
      this.workspace.references.objects[context.objectId]![styleKey] = { tokenId: inherited.tokenId, overridden: true }
      this.persist()
      return { tokenId: inherited.tokenId, overridden: true, scope: 'object', scopeId: context.objectId }
    },
    resetObjectOverride(context: DesignReferenceContext, styleKey: string): ResolvedDesignReference | null {
      const objectBucket = this.workspace.references.objects[context.objectId]
      if (objectBucket?.[styleKey]?.overridden) delete objectBucket[styleKey]
      this.persist()
      return this.resolveReference(context, styleKey)
    },
    assignTypography(objectId: string, roleId: TypographyRoleId): TypographyAssignment {
      const assignment = { roleId, overriddenStyleKeys: [] }
      this.workspace.typographyAssignments[objectId] = assignment
      this.persist()
      return assignment
    },
    markTypographyOverride(objectId: string, styleKey: string) {
      const assignment = this.workspace.typographyAssignments[objectId]
      if (!assignment || assignment.overriddenStyleKeys.includes(styleKey)) return
      assignment.overriddenStyleKeys.push(styleKey)
      this.persist()
    },
    resetTypographyOverride(objectId: string, styleKey: string) {
      const assignment = this.workspace.typographyAssignments[objectId]
      if (!assignment) return
      assignment.overriddenStyleKeys = assignment.overriddenStyleKeys.filter((candidate) => candidate !== styleKey)
      this.persist()
    },
    assignButton(objectId: string, variantId: ButtonVariantId, sizeId: ButtonSizeId): ButtonAssignment {
      const assignment = { variantId, sizeId, overriddenStyleKeys: [] }
      this.workspace.buttonAssignments[objectId] = assignment
      this.persist()
      return assignment
    },
    saveSectionTemplate(template: SavedSectionTemplate) {
      this.workspace.sectionTemplates = [clone(template), ...this.workspace.sectionTemplates.filter((candidate) => candidate.id !== template.id)]
      this.persist()
    },
    deleteSectionTemplate(templateId: string) {
      const next = this.workspace.sectionTemplates.filter((template) => template.id !== templateId)
      if (next.length === this.workspace.sectionTemplates.length) return
      this.workspace.sectionTemplates = next
      this.persist()
    },
    saveComponentPreset(preset: SavedComponentPreset) {
      this.workspace.componentPresets = [clone(preset), ...this.workspace.componentPresets.filter((candidate) => candidate.id !== preset.id)]
      this.persist()
    },
    deleteComponentPreset(presetId: string) {
      const next = this.workspace.componentPresets.filter((preset) => preset.id !== presetId)
      if (next.length === this.workspace.componentPresets.length) return
      this.workspace.componentPresets = next
      this.persist()
    }
  }
})
