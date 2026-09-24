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

function clone<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => clone(item)) as T
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, clone(item)])) as T
  }
  return value
}

function readPath(target: Record<string, unknown>, path: string): EditorValue {
  return path.split('.').reduce<unknown>((value, key) => (value as Record<string, unknown> | undefined)?.[key], target) as EditorValue
}

function writePath(target: Record<string, unknown>, path: string, value: EditorValue): void {
  const keys = path.split('.')
  const leaf = keys.pop()
  if (!leaf) return
  if (value === undefined) {
    let parent: Record<string, unknown> = target
    for (const key of keys) {
      const next = parent[key]
      if (!next || typeof next !== 'object' || Array.isArray(next)) return
      parent = next as Record<string, unknown>
    }
    delete parent[leaf]
    return
  }
  const parent = keys.reduce<Record<string, unknown>>((current, key) => {
    if (!current[key] || typeof current[key] !== 'object') current[key] = {}
    return current[key] as Record<string, unknown>
  }, target)
  parent[leaf] = clone(value)
}

function pruneEmptyEntityRecord(snapshot: EditorSnapshot, path: string): void {
  const keys = path.split('.')
  let collection: Record<string, unknown> | undefined
  let recordId: string | undefined

  if (['typography', 'layout', 'backgrounds', 'buttons', 'animations'].includes(keys[0] ?? '') && keys.length >= 3) {
    collection = (snapshot as unknown as Record<string, Record<string, unknown>>)[keys[0]!]
    recordId = keys[1]
  } else if (keys[0] === 'media' && keys[1] === 'styles' && keys.length >= 4) {
    collection = snapshot.media.styles as unknown as Record<string, unknown>
    recordId = keys[2]
  } else if (keys[0] === 'session' && keys[1] === 'objectStates' && keys.length >= 4) {
    collection = snapshot.session.objectStates as unknown as Record<string, unknown>
    recordId = keys[2]
  }

  if (!collection || !recordId) return
  const record = collection[recordId]
  if (record && typeof record === 'object' && !Array.isArray(record) && Object.keys(record as Record<string, unknown>).length === 0) {
    delete collection[recordId]
  }
}

function commandChanges(command: EditorCommand): EditorCommandChange[] {
  return command.changes?.length
    ? command.changes
    : [{ propertyPath: command.propertyPath, previousValue: command.previousValue, nextValue: command.nextValue }]
}

function applyCommandValue(snapshot: EditorSnapshot, command: EditorCommand, direction: 'previousValue' | 'nextValue'): void {
  const root = snapshot as unknown as Record<string, unknown>
  const changes = commandChanges(command)
  for (const change of changes) writePath(root, change.propertyPath, change[direction])
  for (const change of changes) pruneEmptyEntityRecord(snapshot, change.propertyPath)
}

function contentSignature(snapshot: EditorSnapshot): string {
  return JSON.stringify({
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

const navigatorPreferenceKey = 'portfolio-editor-navigator-open'

function readNavigatorPreference(): boolean {
  if (typeof window === 'undefined') return true
  try {
    return window.localStorage.getItem(navigatorPreferenceKey) !== 'false'
  } catch {
    return true
  }
}

export const useEditorStore = defineStore('editor', {
  state: () => ({
    navigatorOpen: readNavigatorPreference(),
    selectedObjectId: '',
    additionalSelectedObjectIds: [] as string[],
    selectedSection: '',
    activeAccordion: '' as string,
    objects: [] as EditorObject[],
    objectSearch: '',
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
    draftMediaReferences: [] as DraftMediaReference[],
    previewMutation: {
      version: 0,
      objectIds: [] as string[],
      propertyPaths: [] as string[]
    }
  }),
  getters: {
    canUndo: (state) => state.commandHistory.length > 0,
    canRedo: (state) => state.redoHistory.length > 0,
    /** Compatibility alias; selectedObjectId remains the primary selection anchor. */
    selectedEntityId: (state) => state.selectedObjectId,
    selectedObjectIds: (state): string[] => state.selectedObjectId
      ? [state.selectedObjectId, ...state.additionalSelectedObjectIds.filter((id) => id !== state.selectedObjectId)]
      : [],
    selectedObjects(): EditorObject[] {
      const selected = new Set(this.selectedObjectIds)
      return this.objects.filter((object) => selected.has(object.id))
    },
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
    setNavigatorOpen(open: boolean) {
      this.navigatorOpen = open
      if (typeof window === 'undefined') return
      try {
        window.localStorage.setItem(navigatorPreferenceKey, String(open))
      } catch {
        // The layout preference remains usable for this session when storage is unavailable.
      }
    },
    toggleNavigator() {
      this.setNavigatorOpen(!this.navigatorOpen)
    },
    initialize(snapshot: EditorSnapshot, revision: Partial<EditorRevisionState> = {}) {
      this.draftSnapshot = clone(snapshot)
      this.draftSnapshot.instances ??= []
      this.draftSnapshot.session.objectStates ??= {}
      this.draftSnapshot.session.expandedLayers ??= []
      this.draftRevisionId = revision.draftRevisionId ?? null
      this.draftRevisionNumber = revision.draftRevisionNumber ?? null
      this.draftLockVersion = revision.draftLockVersion ?? null
      this.publishedRevisionNumber = revision.publishedRevisionNumber ?? null
      this.baseRevisionNumber = revision.baseRevisionNumber ?? revision.publishedRevisionNumber ?? null
      this.selectedObjectId = this.draftSnapshot.session.selectedEntityId
      this.additionalSelectedObjectIds = []
      this.activeAccordion = this.draftSnapshot.session.activeAccordion
      this.selectedSection = this.draftSnapshot.session.selectedSection
      this.savedContentSignature = contentSignature(this.draftSnapshot)
      this.hasUnsavedChanges = false
      this.sessionDirty = false
      this.commandHistory = []
      this.redoHistory = []
      this.styleClipboard = null
      this.objectSearch = ''
      this.previewMutation = {
        version: this.previewMutation.version + 1,
        objectIds: [],
        propertyPaths: ['*']
      }
    },
    registerObjects(objects: EditorObject[]) {
      const currentById = new Map(this.draftSnapshot.entities.map((entity) => [entity.entityId, entity]))
      const instanceLabels = new Map(this.draftSnapshot.instances.map((instance) => [instance.instanceId, instance.label]))
      const previousById = new Map(this.objects.map((object) => [object.id, object]))
      const previousOrder = new Map(this.objects.map((object, index) => [object.id, index]))
      const normalizedObjects = objects.map((object) => {
        const previous = previousById.get(object.id)
        return clone({
        id: object.id,
        entityId: object.entityId,
        name: currentById.get(object.id)?.label ?? instanceLabels.get(object.id) ?? object.name,
        label: currentById.get(object.id)?.label ?? instanceLabels.get(object.id) ?? object.label,
        type: object.type,
        objectType: object.objectType,
        kind: object.kind,
        section: object.section,
        parentLayerId: object.parentLayerId,
        layerId: object.layerId,
        order: object.order,
        capabilities: object.capabilities,
        propertyValues: object.propertyValues,
        ux: object.ux || previous?.ux
          ? { ...(previous?.ux ?? {}), ...(object.ux ?? {}) }
          : undefined,
        validation: object.validation
      })
      }).sort((left, right) => {
        const leftOrder = previousOrder.get(left.id)
        const rightOrder = previousOrder.get(right.id)
        if (leftOrder !== undefined && rightOrder !== undefined) return leftOrder - rightOrder
        if (leftOrder !== undefined) return -1
        if (rightOrder !== undefined) return 1
        return left.order - right.order
      }).map((object, order) => ({ ...object, order }))
      if (JSON.stringify(this.objects) !== JSON.stringify(normalizedObjects)) this.objects = normalizedObjects
      for (const object of objects) {
        if (object.ux?.dynamicInstance) continue
        const next = toSnapshotEntityReference(object)
        const existing = currentById.get(object.id)
        currentById.set(object.id, existing ? { ...next, label: existing.label } : next)
      }
      const nextEntities = [...currentById.values()]
      if (JSON.stringify(this.draftSnapshot.entities) !== JSON.stringify(nextEntities)) this.draftSnapshot.entities = nextEntities
      const validIds = new Set(normalizedObjects.map((object) => object.id))
      this.additionalSelectedObjectIds = this.additionalSelectedObjectIds.filter((id) => validIds.has(id) && id !== this.selectedObjectId)
    },
    selectObject(entity: EntityDescriptor, markSession = true) {
      this.selectedObjectId = entity.entityId
      this.additionalSelectedObjectIds = []
      this.selectedSection = entity.section
      this.draftSnapshot.session.selectedEntityId = entity.entityId
      this.draftSnapshot.session.selectedSection = entity.section
      this.draftSnapshot.session.propertySearch ??= ''
      if (markSession) this.sessionDirty = true
    },
    selectObjectAdditive(entity: EntityDescriptor, markSession = true) {
      const selected = this.selectedObjectIds
      if (selected.includes(entity.entityId)) {
        if (selected.length === 1) return
        const remaining = selected.filter((id) => id !== entity.entityId)
        const nextPrimary = entity.entityId === this.selectedObjectId ? remaining[0] : this.selectedObjectId
        this.selectedObjectId = nextPrimary
        this.additionalSelectedObjectIds = remaining.filter((id) => id !== nextPrimary)
      } else {
        const previous = this.selectedObjectId
        this.selectedObjectId = entity.entityId
        this.additionalSelectedObjectIds = [previous, ...this.additionalSelectedObjectIds]
          .filter((id, index, all) => Boolean(id) && id !== entity.entityId && all.indexOf(id) === index)
      }
      this.selectedSection = entity.section
      this.draftSnapshot.session.selectedEntityId = this.selectedObjectId
      this.draftSnapshot.session.selectedSection = entity.section
      if (markSession) this.sessionDirty = true
    },
    selectObjectRange(entity: EntityDescriptor, orderedIds: string[], markSession = true) {
      const anchorIndex = orderedIds.indexOf(this.selectedObjectId)
      const targetIndex = orderedIds.indexOf(entity.entityId)
      if (anchorIndex < 0 || targetIndex < 0) {
        this.selectObject(entity, markSession)
        return
      }
      const range = orderedIds.slice(Math.min(anchorIndex, targetIndex), Math.max(anchorIndex, targetIndex) + 1)
      this.selectedObjectId = entity.entityId
      this.additionalSelectedObjectIds = range.filter((id) => id !== entity.entityId)
      this.selectedSection = entity.section
      this.draftSnapshot.session.selectedEntityId = entity.entityId
      this.draftSnapshot.session.selectedSection = entity.section
      if (markSession) this.sessionDirty = true
    },
    setObjectSelection(objectIds: string[], primaryId?: string, markSession = true) {
      const unique = [...new Set(objectIds)].filter((id) => this.objects.some((object) => object.id === id))
      const primary = primaryId && unique.includes(primaryId) ? primaryId : unique[0]
      if (!primary) {
        this.selectedObjectId = ''
        this.additionalSelectedObjectIds = []
        return
      }
      const object = this.objects.find((candidate) => candidate.id === primary)
      if (!object) return
      this.selectedObjectId = primary
      this.additionalSelectedObjectIds = unique.filter((id) => id !== primary)
      this.selectedSection = object.section
      this.draftSnapshot.session.selectedEntityId = primary
      this.draftSnapshot.session.selectedSection = object.section
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
      this.objectSearch = value
    },
    setPropertySearch(value: string) {
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
    reorderObject(objectId: string, targetObjectId: string) {
      const sourceIndex = this.objects.findIndex((object) => object.id === objectId)
      const targetIndex = this.objects.findIndex((object) => object.id === targetObjectId)
      if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return false
      const next = [...this.objects]
      const [source] = next.splice(sourceIndex, 1)
      if (!source) return false
      next.splice(targetIndex, 0, source)
      this.objects = next.map((object, order) => ({ ...object, order }))
      this.sessionDirty = true
      return true
    },
    syncObjectLabels() {
      const labels = new Map(this.draftSnapshot.entities.map((entity) => [entity.entityId, entity.label]))
      for (const instance of this.draftSnapshot.instances) labels.set(instance.instanceId, instance.label)
      this.objects = this.objects.map((object) => {
        const label = labels.get(object.id)
        return label === undefined || (object.name === label && object.label === label)
          ? object
          : { ...object, name: label, label }
      })
    },
    renameObject(objectId: string, name: string): boolean {
      const normalized = name.trim()
      const index = this.draftSnapshot.entities.findIndex((entity) => entity.entityId === objectId)
      const instanceIndex = this.draftSnapshot.instances.findIndex((instance) => instance.instanceId === objectId)
      if (!normalized || (index < 0 && instanceIndex < 0)) return false
      const path = instanceIndex >= 0 ? `instances.${instanceIndex}.label` : `entities.${index}.label`
      const applied = this.setProperty(objectId, path, normalized, 'RENAME')
      if (applied) this.syncObjectLabels()
      return applied
    },
    recordPreviewMutation(objectIds: string[], propertyPaths: string[]) {
      this.previewMutation = {
        version: this.previewMutation.version + 1,
        objectIds: [...new Set(objectIds.filter(Boolean))],
        propertyPaths: [...new Set(propertyPaths.filter(Boolean))]
      }
    },
    refreshDirtyState() {
      this.hasUnsavedChanges = contentSignature(this.draftSnapshot) !== this.savedContentSignature
    },
    apply(command: EditorCommand, record = true): boolean {
      if (record && this.objectState(command.entityId).locked) return false
      applyCommandValue(this.draftSnapshot, command, 'nextValue')
      const affectedObjectIds = Array.isArray(command.metadata?.objectIds)
        ? command.metadata.objectIds.filter((value): value is string => typeof value === 'string')
        : [command.entityId]
      const affectedPaths = commandChanges(command).map((change) => change.propertyPath)
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
          this.recordPreviewMutation(affectedObjectIds, affectedPaths)
          return true
        }
        this.commandHistory.push(clone(command))
        if (this.commandHistory.length > 10) this.commandHistory.shift()
        this.redoHistory = []
      }
      this.refreshDirtyState()
      this.recordPreviewMutation(affectedObjectIds, affectedPaths)
      return true
    },
    setProperty(entityId: string, propertyPath: string, nextValue: EditorValue, type: EditorCommand['type'] = 'SET_PROPERTY', metadata?: Record<string, unknown>): boolean {
      const previousValue = readPath(this.draftSnapshot as unknown as Record<string, unknown>, propertyPath)
      if (Object.is(previousValue, nextValue)) return false
      return this.apply({ type, entityId, propertyPath, previousValue, nextValue, timestamp: Date.now(), metadata })
    },
    setProperties(entityId: string, changes: Array<{ propertyPath: string; nextValue: EditorValue }>, metadata?: Record<string, unknown>, type: EditorCommand['type'] = 'PASTE_STYLE'): boolean {
      const root = this.draftSnapshot as unknown as Record<string, unknown>
      const commandChanges = changes
        .map((change) => ({ ...change, previousValue: readPath(root, change.propertyPath) }))
        .filter((change) => !Object.is(change.previousValue, change.nextValue))
      if (!commandChanges.length) return false
      return this.apply({
        type,
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
      this.syncObjectLabels()
      const objectIds = Array.isArray(command.metadata?.objectIds)
        ? command.metadata.objectIds.filter((value): value is string => typeof value === 'string')
        : [command.entityId]
      this.recordPreviewMutation(objectIds, commandChanges(command).map((change) => change.propertyPath))
    },
    redo() {
      const command = this.redoHistory.pop()
      if (!command) return
      applyCommandValue(this.draftSnapshot, command, 'nextValue')
      this.commandHistory.push(command)
      if (this.commandHistory.length > 10) this.commandHistory.shift()
      this.refreshDirtyState()
      this.syncObjectLabels()
      const objectIds = Array.isArray(command.metadata?.objectIds)
        ? command.metadata.objectIds.filter((value): value is string => typeof value === 'string')
        : [command.entityId]
      this.recordPreviewMutation(objectIds, commandChanges(command).map((change) => change.propertyPath))
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
