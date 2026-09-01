import { defineStore } from 'pinia'
import {
  auditDesignTheme,
  createDefaultDesignTheme,
  designTokenRegistry,
  typographyRoleRegistry
} from '../editor/designSystemRegistry'
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

function normalizeWorkspace(value: unknown): DesignSystemWorkspace {
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
    sectionTemplates: Array.isArray(value.sectionTemplates) ? clone(value.sectionTemplates) as SavedSectionTemplate[] : [],
    componentPresets: Array.isArray(value.componentPresets) ? clone(value.componentPresets) as SavedComponentPreset[] : []
  }
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
    persistenceError: ''
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
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY)
        if (saved) this.workspace = normalizeWorkspace(JSON.parse(saved))
      } catch (error) {
        this.persistenceError = error instanceof Error ? error.message : 'Design System state could not be restored.'
      }
    },
    persist() {
      if (typeof window === 'undefined') return
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.workspace))
        this.persistenceError = ''
      } catch (error) {
        this.persistenceError = error instanceof Error ? error.message : 'Design System state could not be saved.'
      }
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
      this.workspace.sectionTemplates = this.workspace.sectionTemplates.filter((template) => template.id !== templateId)
      this.persist()
    },
    saveComponentPreset(preset: SavedComponentPreset) {
      this.workspace.componentPresets = [clone(preset), ...this.workspace.componentPresets.filter((candidate) => candidate.id !== preset.id)]
      this.persist()
    },
    deleteComponentPreset(presetId: string) {
      this.workspace.componentPresets = this.workspace.componentPresets.filter((preset) => preset.id !== presetId)
      this.persist()
    }
  }
})
