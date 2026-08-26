import { defineStore } from 'pinia'
import { createDefaultSiteSnapshot } from '../data/default/site'
import { createEditorSnapshot } from '../editor/editorSnapshot'
import type { EditorSnapshot } from '../types/editorSnapshot'
import type { EditorCommand, EditorRevisionState, EditorValue, EntityDescriptor, DraftMediaReference } from '../types/editor'

const clone = <T>(value: T): T => structuredClone(value)

function readPath(target: Record<string, unknown>, path: string): EditorValue {
  return path.split('.').reduce<unknown>((value, key) => (value as Record<string, unknown> | undefined)?.[key], target) as EditorValue
}

function writePath(target: Record<string, unknown>, path: string, value: EditorValue): void {
  const keys = path.split('.')
  const leaf = keys.pop() as string
  const parent = keys.reduce<Record<string, unknown>>((current, key) => {
    if (!current[key] || typeof current[key] !== 'object') current[key] = {}
    return current[key] as Record<string, unknown>
  }, target)
  parent[leaf] = clone(value)
}

export const useEditorStore = defineStore('editor', {
  state: () => ({
    selectedEntityId: '',
    selectedSection: '',
    activeAccordion: '' as string,
    draftSnapshot: createEditorSnapshot(createDefaultSiteSnapshot()) as EditorSnapshot,
    draftRevisionNumber: null as number | null,
    draftLockVersion: null as number | null,
    publishedRevisionNumber: null as number | null,
    baseRevisionNumber: null as number | null,
    draftRevisionId: null as string | null,
    hasUnsavedChanges: false,
    sessionDirty: false,
    isSavingDraft: false,
    isPublishing: false,
    commandHistory: [] as EditorCommand[],
    redoHistory: [] as EditorCommand[],
    draftMediaReferences: [] as DraftMediaReference[]
  }),
  getters: {
    canUndo: (state) => state.commandHistory.length > 0,
    canRedo: (state) => state.redoHistory.length > 0,
    revisionState: (state): EditorRevisionState => ({ draftRevisionId: state.draftRevisionId, draftRevisionNumber: state.draftRevisionNumber, draftLockVersion: state.draftLockVersion, publishedRevisionNumber: state.publishedRevisionNumber, baseRevisionNumber: state.baseRevisionNumber })
  },
  actions: {
    initialize(snapshot: EditorSnapshot, revision: Partial<EditorRevisionState> = {}) {
      this.draftSnapshot = clone(snapshot)
      this.draftRevisionId = revision.draftRevisionId ?? null
      this.draftRevisionNumber = revision.draftRevisionNumber ?? null
      this.draftLockVersion = revision.draftLockVersion ?? null
      this.publishedRevisionNumber = revision.publishedRevisionNumber ?? null
      this.baseRevisionNumber = revision.baseRevisionNumber ?? revision.publishedRevisionNumber ?? null
      this.selectedEntityId = this.draftSnapshot.session.selectedEntityId
      this.activeAccordion = this.draftSnapshot.session.activeAccordion
      this.selectedSection = this.draftSnapshot.session.selectedSection
      this.hasUnsavedChanges = false
      this.sessionDirty = false
      this.commandHistory = []
      this.redoHistory = []
    },
    selectEntity(entity: EntityDescriptor) {
      this.selectedEntityId = entity.entityId
      this.selectedSection = entity.section
      this.draftSnapshot.session.selectedEntityId = entity.entityId
      this.draftSnapshot.session.selectedSection = entity.section
      this.draftSnapshot.session.propertySearch = this.draftSnapshot.session.propertySearch ?? ''
      this.sessionDirty = true
    },
    setAccordion(category: string) {
      this.activeAccordion = category
      this.draftSnapshot.session.activeAccordion = category
      this.sessionDirty = true
    },
    setViewport(session: Partial<EditorSnapshot['session']>) {
      this.draftSnapshot.session = { ...this.draftSnapshot.session, ...session }
      this.sessionDirty = true
    },
    apply(command: EditorCommand, record = true) {
      const entity = this.draftSnapshot as unknown as Record<string, unknown>
      writePath(entity, command.propertyPath, command.nextValue)
      this.hasUnsavedChanges = true
      if (record) {
        const coalesceKey = typeof command.metadata?.coalesceKey === 'string' ? command.metadata.coalesceKey : null
        const previous = this.commandHistory[this.commandHistory.length - 1]
        if (coalesceKey && previous?.metadata?.coalesceKey === coalesceKey && command.timestamp - previous.timestamp <= 1000) {
          previous.nextValue = clone(command.nextValue)
          previous.timestamp = command.timestamp
          previous.metadata = clone(command.metadata)
          this.redoHistory = []
          return
        }
        this.commandHistory.push(clone(command))
        if (this.commandHistory.length > 10) this.commandHistory.shift()
        this.redoHistory = []
      }
    },
    setProperty(entityId: string, propertyPath: string, nextValue: EditorValue, type: EditorCommand['type'] = 'SET_PROPERTY', metadata?: Record<string, unknown>) {
      const previousValue = readPath(this.draftSnapshot as unknown as Record<string, unknown>, propertyPath)
      if (Object.is(previousValue, nextValue)) return
      this.apply({ type, entityId, propertyPath, previousValue, nextValue, timestamp: Date.now(), metadata })
    },
    undo() {
      const command = this.commandHistory.pop()
      if (!command) return
      writePath(this.draftSnapshot as unknown as Record<string, unknown>, command.propertyPath, command.previousValue)
      this.redoHistory.push(command)
      this.hasUnsavedChanges = this.commandHistory.length > 0
    },
    redo() {
      const command = this.redoHistory.pop()
      if (!command) return
      writePath(this.draftSnapshot as unknown as Record<string, unknown>, command.propertyPath, command.nextValue)
      this.commandHistory.push(command)
      if (this.commandHistory.length > 10) this.commandHistory.shift()
      this.hasUnsavedChanges = true
    },
    markDraftSaved(revision: Partial<EditorRevisionState> = {}) {
      this.hasUnsavedChanges = false
      this.sessionDirty = false
      this.draftRevisionId = revision.draftRevisionId ?? this.draftRevisionId
      this.draftRevisionNumber = revision.draftRevisionNumber ?? this.draftRevisionNumber
      this.draftLockVersion = revision.draftLockVersion ?? this.draftLockVersion
      this.baseRevisionNumber = revision.baseRevisionNumber ?? this.baseRevisionNumber
    }
  }
})
