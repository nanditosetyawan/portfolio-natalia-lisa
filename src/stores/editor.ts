import { defineStore } from 'pinia'
import { createDefaultSiteSnapshot } from '../data/default/site'
import { createEditorSnapshot } from '../editor/editorSnapshot'
import { toSnapshotEntityReference } from '../editor/objectRegistry'
import { validateRegisteredProperties } from '../editor/propertyRegistry'
import type { EditorSnapshot } from '../types/editorSnapshot'
import type {
  DraftMediaReference,
  EditorCommand,
  EditorCommandChange,
  EditorObject,
  EditorObjectSessionState,
  EditorRevisionState,
  EditorStyleClipboard,
  EditorValue,
  EntityDescriptor
} from '../types/editor'

const clone = <T>(value: T): T => structuredClone(value)

function readPath(target: Record<string, unknown>, path: string): EditorValue {
  return path.split('.').reduce<unknown>((value, key) => (value as Record<string, unknown> | undefined)?.[key], target) as EditorValue
}

function writePath(target: Record<string, unknown>, path: string, value: EditorValue): void {
  const keys = path.split('.')
  const leaf = keys.pop()
  if (!leaf) return
  const parent = keys.reduce<Record<string, unknown>>((current, key) => {
    if (!current[key] || typeof current[key] !== 'object') current[key] = {}
    return current[key] as Record<string, unknown>
  }, target)
  if (value === undefined) delete parent[leaf]
  else parent[leaf] = clone(value)
}

function commandChanges(command: EditorCommand): EditorCommandChange[] {
  return command.changes?.length
    ? command.changes
    : [{ propertyPath: command.propertyPath, previousValue: command.previousValue, nextValue: command.nextValue }]
}

function applyCommandValue(snapshot: EditorSnapshot, command: EditorCommand, direction: 'previousValue' | 'nextValue'): void {
  const root = snapshot as unknown as Record<string, unknown>
  for (const change of commandChanges(command)) writePath(root, change.propertyPath, change[direction])
}

function contentSignature(snapshot: EditorSnapshot): string {
  return JSON.stringify({
    entities: snapshot.entities,
    content: snapshot.content,
    certificateCards: snapshot.certificateCards,
    typography: snapshot.typography,
    layout: snapshot.layout,
    media: snapshot.media,
    backgrounds: snapshot.backgrounds,
    buttons: snapshot.buttons,
    animations: snapshot.animations,
    visual: snapshot.visual,
    behavior: snapshot.behavior
  })
}

const defaultObjectState = (): EditorObjectSessionState => ({ locked: false, hidden: false })

export const useEditorStore = defineStore('editor', {
  state: () => ({
    selectedObjectId: '',
    selectedSection: '',
    activeAccordion: '' as string,
    objects: [] as EditorObject[],
    styleClipboard: null as EditorStyleClipboard | null,
    draftSnapshot: createEditorSnapshot(createDefaultSiteSnapshot()) as EditorSnapshot,
    savedContentSignature: '',
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
    /** Compatibility alias; selectedObjectId is the only stored selection ID. */
    selectedEntityId: (state) => state.selectedObjectId,
    selectedObject: (state) => state.objects.find((object) => object.id === state.selectedObjectId),
    selectedObjectType(): string {
      return this.selectedObject?.type ?? ''
    },
    selectedCapabilities(): string[] {
      return this.selectedObject ? [...this.selectedObject.capabilities] : []
    },
    selectedLayer(): string {
      return this.selectedObject?.layerId ?? ''
    },
    selectedObjectState(): EditorObjectSessionState {
      return this.draftSnapshot.session.objectStates[this.selectedObjectId] ?? defaultObjectState()
    },
    registeredPropertyErrors(state) {
      return validateRegisteredProperties(state.draftSnapshot, state.objects)
    },
    selectedPropertyErrors(): ReturnType<typeof validateRegisteredProperties> {
      return this.registeredPropertyErrors.filter((error) => error.entityId === this.selectedObjectId)
    },
    revisionState: (state): EditorRevisionState => ({
      draftRevisionId: state.draftRevisionId,
      draftRevisionNumber: state.draftRevisionNumber,
      draftLockVersion: state.draftLockVersion,
      publishedRevisionNumber: state.publishedRevisionNumber,
      baseRevisionNumber: state.baseRevisionNumber
    })
  },
  actions: {
    initialize(snapshot: EditorSnapshot, revision: Partial<EditorRevisionState> = {}) {
      this.draftSnapshot = clone(snapshot)
      this.draftSnapshot.session.objectStates ??= {}
      this.draftSnapshot.session.expandedLayers ??= []
      this.draftRevisionId = revision.draftRevisionId ?? null
      this.draftRevisionNumber = revision.draftRevisionNumber ?? null
      this.draftLockVersion = revision.draftLockVersion ?? null
      this.publishedRevisionNumber = revision.publishedRevisionNumber ?? null
      this.baseRevisionNumber = revision.baseRevisionNumber ?? revision.publishedRevisionNumber ?? null
      this.selectedObjectId = this.draftSnapshot.session.selectedEntityId
      this.activeAccordion = this.draftSnapshot.session.activeAccordion
      this.selectedSection = this.draftSnapshot.session.selectedSection
      this.savedContentSignature = contentSignature(this.draftSnapshot)
      this.hasUnsavedChanges = false
      this.sessionDirty = false
      this.commandHistory = []
      this.redoHistory = []
      this.styleClipboard = null
    },
    registerObjects(objects: EditorObject[]) {
      const normalizedObjects = objects.map((object) => clone({
        id: object.id,
        entityId: object.entityId,
        name: object.name,
        label: object.label,
        type: object.type,
        objectType: object.objectType,
        kind: object.kind,
        section: object.section,
        parentLayerId: object.parentLayerId,
        layerId: object.layerId,
        order: object.order,
        capabilities: object.capabilities,
        propertyValues: object.propertyValues,
        validation: object.validation
      }))
      if (JSON.stringify(this.objects) !== JSON.stringify(normalizedObjects)) this.objects = normalizedObjects
      const currentById = new Map(this.draftSnapshot.entities.map((entity) => [entity.entityId, entity]))
      for (const object of objects) currentById.set(object.id, toSnapshotEntityReference(object))
      const nextEntities = [...currentById.values()]
      if (JSON.stringify(this.draftSnapshot.entities) !== JSON.stringify(nextEntities)) this.draftSnapshot.entities = nextEntities
    },
    selectObject(entity: EntityDescriptor, markSession = true) {
      this.selectedObjectId = entity.entityId
      this.selectedSection = entity.section
      this.draftSnapshot.session.selectedEntityId = entity.entityId
      this.draftSnapshot.session.selectedSection = entity.section
      this.draftSnapshot.session.propertySearch ??= ''
      if (markSession) this.sessionDirty = true
    },
    selectEntity(entity: EntityDescriptor) {
      this.selectObject(entity)
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
    setObjectSearch(value: string) {
      this.draftSnapshot.session.propertySearch = value
      this.sessionDirty = true
    },
    setLayerExpanded(layerId: string, expanded: boolean) {
      const layers = new Set(this.draftSnapshot.session.expandedLayers)
      if (expanded) layers.add(layerId)
      else layers.delete(layerId)
      this.draftSnapshot.session.expandedLayers = [...layers]
      this.sessionDirty = true
    },
    objectState(objectId: string): EditorObjectSessionState {
      return this.draftSnapshot.session.objectStates[objectId] ?? defaultObjectState()
    },
    setObjectState(objectId: string, state: Partial<EditorObjectSessionState>) {
      this.draftSnapshot.session.objectStates[objectId] = { ...this.objectState(objectId), ...state }
      this.sessionDirty = true
    },
    setStyleClipboard(clipboard: EditorStyleClipboard | null) {
      this.styleClipboard = clipboard ? clone(clipboard) : null
    },
    refreshDirtyState() {
      this.hasUnsavedChanges = contentSignature(this.draftSnapshot) !== this.savedContentSignature
    },
    apply(command: EditorCommand, record = true): boolean {
      if (record && this.objectState(command.entityId).locked) return false
      applyCommandValue(this.draftSnapshot, command, 'nextValue')
      if (record) {
        const coalesceKey = typeof command.metadata?.coalesceKey === 'string' ? command.metadata.coalesceKey : null
        const previous = this.commandHistory[this.commandHistory.length - 1]
        if (coalesceKey && previous?.metadata?.coalesceKey === coalesceKey && command.timestamp - previous.timestamp <= 1000) {
          previous.nextValue = clone(command.nextValue)
          previous.changes = clone(command.changes)
          previous.timestamp = command.timestamp
          previous.metadata = clone(command.metadata)
          this.redoHistory = []
          this.refreshDirtyState()
          return true
        }
        this.commandHistory.push(clone(command))
        if (this.commandHistory.length > 10) this.commandHistory.shift()
        this.redoHistory = []
      }
      this.refreshDirtyState()
      return true
    },
    setProperty(entityId: string, propertyPath: string, nextValue: EditorValue, type: EditorCommand['type'] = 'SET_PROPERTY', metadata?: Record<string, unknown>): boolean {
      const previousValue = readPath(this.draftSnapshot as unknown as Record<string, unknown>, propertyPath)
      if (Object.is(previousValue, nextValue)) return false
      return this.apply({ type, entityId, propertyPath, previousValue, nextValue, timestamp: Date.now(), metadata })
    },
    setProperties(entityId: string, changes: Array<{ propertyPath: string; nextValue: EditorValue }>, metadata?: Record<string, unknown>): boolean {
      const root = this.draftSnapshot as unknown as Record<string, unknown>
      const commandChanges = changes
        .map((change) => ({ ...change, previousValue: readPath(root, change.propertyPath) }))
        .filter((change) => !Object.is(change.previousValue, change.nextValue))
      if (!commandChanges.length) return false
      return this.apply({
        type: 'PASTE_STYLE',
        entityId,
        propertyPath: commandChanges[0].propertyPath,
        previousValue: commandChanges[0].previousValue,
        nextValue: commandChanges[0].nextValue,
        changes: commandChanges,
        timestamp: Date.now(),
        metadata
      })
    },
    undo() {
      const command = this.commandHistory.pop()
      if (!command) return
      applyCommandValue(this.draftSnapshot, command, 'previousValue')
      this.redoHistory.push(command)
      this.refreshDirtyState()
    },
    redo() {
      const command = this.redoHistory.pop()
      if (!command) return
      applyCommandValue(this.draftSnapshot, command, 'nextValue')
      this.commandHistory.push(command)
      if (this.commandHistory.length > 10) this.commandHistory.shift()
      this.refreshDirtyState()
    },
    markDraftSaved(revision: Partial<EditorRevisionState> = {}) {
      this.savedContentSignature = contentSignature(this.draftSnapshot)
      this.hasUnsavedChanges = false
      this.sessionDirty = false
      this.draftRevisionId = revision.draftRevisionId ?? this.draftRevisionId
      this.draftRevisionNumber = revision.draftRevisionNumber ?? this.draftRevisionNumber
      this.draftLockVersion = revision.draftLockVersion ?? this.draftLockVersion
      this.baseRevisionNumber = revision.baseRevisionNumber ?? this.baseRevisionNumber
    }
  }
})
