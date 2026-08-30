<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, toRaw, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ClipboardCopy, ClipboardPaste, Eye, EyeOff, Lock, Unlock } from 'lucide-vue-next'
import HomePage from '../guest/HomePage.vue'
import type { RuntimeAdminProperty } from '../../composables/useAdminEntityRegistry'
import { useEditorObjectRegistry, type EditorRuntimeObject } from '../../composables/useEditorObjectRegistry'
import { usePhotoAreaRegistry } from '../../composables/usePhotoAreaRegistry'
import { useCertificatesStore } from '../../stores/certificates'
import { useSiteStore } from '../../stores/site'
import {
  editorDraftRepository,
  editorPublishRepository,
  guestPublishedRepository,
  PublishConflictError,
  PublishValidationError,
  RevisionConflictError
} from '../../repositories/editorRevisionRepository'
import {
  editorHasChanges,
  editorSaveStatus,
  markEditorChanged,
  registerEditorSave,
  saveEditor
} from '../../composables/useEditorSession'
import PropertyControl from './components/PropertyControl.vue'
import PropertyInputControl from './components/property-controls/PropertyInputControl.vue'
import EditorObjectNavigator from './components/EditorObjectNavigator.vue'
import AssetPickerModal from './components/AssetPickerModal.vue'
import { useEditorStore } from '../../stores/editor'
import { useMediaLibraryStore } from '../../stores/mediaLibrary'
import { createEditorSnapshot } from '../../editor/editorSnapshot'
import {
  editorPublishErrors,
  editorPublishStatus,
  registerEditorPublish,
  resetEditorPublishFeedback
} from '../../composables/useEditorPublish'
import { invalidatePublishedRuntimeCache } from '../../runtime/publishedRuntime'
import {
  isPropertyEnabled,
  readSnapshotPath,
  resolveProperties,
  resolvePropertyPath
} from '../../editor/propertyRegistry'
import { applyRegisteredObjectProperties, applyRegisteredSnapshotProperties, restoreRegisteredSnapshotProperties } from '../../editor/propertyRuntime'
import type {
  DraftMediaReference,
  EditorCommandType,
  EditorValue,
  EntityDescriptor,
  EditorObject,
  PropertyRegistryEntry,
  PropertyVisibilityContext
} from '../../types/editor'
import type { EditorSnapshot, SnapshotMediaModel } from '../../types/editorSnapshot'
import type { MediaLibraryAsset } from '../../types/mediaLibrary'

interface PanelProperty {
  key: string
  metadata: PropertyRegistryEntry
  runtimeProperty?: RuntimeAdminProperty
}

interface PanelRow {
  key: string
  properties: PanelProperty[]
}

interface PanelGroup {
  key: string
  label: string
  presentation: 'inline' | 'accordion'
  rows: PanelRow[]
}

type SelectionMode = 'replace' | 'additive' | 'range'
type AlignmentMode = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'

interface InlineTextEdit {
  entity: EditorRuntimeObject
  property: RuntimeAdminProperty
  element: HTMLElement
  originalValue: string
}

interface SelectionBoxState {
  active: boolean
  startX: number
  startY: number
  currentX: number
  currentY: number
}

interface ContextMenuState {
  open: boolean
  x: number
  y: number
}

interface PreviewDragState {
  pointerId: number
  startX: number
  startY: number
  moved: boolean
  elements: Array<{ objectId: string; element: HTMLElement; originalTranslate: string }>
}

type LibraryRouteName = 'admin-drafts' | 'admin-favorites'

const site = useSiteStore()
const route = useRoute()
const router = useRouter()
const editor = useEditorStore()
const certificates = useCertificatesStore()
const editorEntities = useEditorObjectRegistry()
const photoRegistry = usePhotoAreaRegistry()
const mediaLibrary = useMediaLibraryStore()

const saveStatus = ref('')
const initializationError = ref('')
const editorReady = ref(false)
const showOpenModal = ref(false)
const showUnsavedModal = ref(false)
const showAssetPicker = ref(false)
const pendingLibrary = ref<LibraryRouteName | null>(null)
const canvasScroll = ref<HTMLElement | null>(null)
const canvasContainer = ref<HTMLElement | null>(null)
const controlPanel = ref<HTMLElement | null>(null)
const previewStage = ref<HTMLElement | null>(null)
const previewRuntime = ref<HTMLElement | null>(null)
const fitScale = ref(0.6)
const userZoom = ref<number | null>(null)
const previewHeight = ref(900)
const draftScope = ref(`editor-session-${crypto.randomUUID()}`)
const publishedBaseline = ref<EditorSnapshot | null>(null)
const mediaInputVersion = ref(0)
const inlineTextEdit = ref<InlineTextEdit | null>(null)
const selectionBox = ref<SelectionBoxState>({ active: false, startX: 0, startY: 0, currentX: 0, currentY: 0 })
const contextMenu = ref<ContextMenuState>({ open: false, x: 0, y: 0 })
const selectionGap = ref(16)
const previewUpdateDuration = ref(0)
const previewUpdateCount = ref(0)
const mediaDropTargetId = ref<string | null>(null)
const isPanning = ref(false)
const mediaPreviewUrls = new Map<string, string>()
const managedMediaAreaIds = new Set<string>()
const pendingPreviewObjectIds = new Set<string>()
let selectedPreviewElement: HTMLElement | null = null
let previewObserver: ResizeObserver | null = null
let previewFrameRequest = 0
let panPointerId: number | null = null
let panStartX = 0
let panStartY = 0
let panScrollLeft = 0
let panScrollTop = 0
let selectionBoxMoved = false
let selectionBoxAdditive = false
let previewDrag: PreviewDragState | null = null
let unregisterSave: (() => void) | null = null
let unregisterPublish: (() => void) | null = null

function cloneEditorData<T>(value: T): T {
  const raw = value && typeof value === 'object' ? toRaw(value as object) : value
  if (Array.isArray(raw)) return raw.map((item) => cloneEditorData(item)) as T
  if (raw && typeof raw === 'object') {
    return Object.fromEntries(Object.entries(raw).map(([key, item]) => [key, cloneEditorData(item)])) as T
  }
  return raw as T
}

const sections = computed(() => [...new Set(editorEntities.value.map((entity) => entity.section))])
const selectedSection = computed({
  get: () => editor.selectedSection,
  set: (section: string) => {
    const first = editorEntities.value.find((entity) => entity.section === section)
    if (first) selectEntity(first.id)
  }
})
const sectionEntities = computed(() => editorEntities.value.filter((entity) => entity.section === selectedSection.value))
const selectedEntityId = computed({
  get: () => editor.selectedObjectId,
  set: (entityId: string) => { selectEntity(entityId) }
})
const selectedEntity = computed(() => editorEntities.value.find((entity) => entity.id === editor.selectedObjectId))
const selectedPhotoArea = computed(() => selectedEntity.value?.photoAreaId ? photoRegistry.find(selectedEntity.value.photoAreaId) : undefined)
const selectedMediaAssignment = computed(() => selectedPhotoArea.value
  ? editor.draftSnapshot.media.assignments.find((assignment) => assignment.entityId === selectedPhotoArea.value?.id) ?? null
  : null)
const selectedObjectLocked = computed(() => editor.selectedObjectState.locked)
const selectedObjectHidden = computed(() => editor.selectedObjectState.hidden)
const selectedObjectCount = computed(() => editor.selectedObjectIds.length)
const selectedRuntimeObjects = computed(() => editor.selectedObjectIds.flatMap((objectId) => {
  const object = editorEntities.value.find((candidate) => candidate.id === objectId)
  return object ? [object] : []
}))
const previewScale = computed(() => userZoom.value ?? fitScale.value)
const sourceLabel = computed(() => editor.draftRevisionId
  ? `Editing: ${route.query.source === 'favorite' ? 'Favorite - ' : ''}Draft #${editor.draftRevisionNumber ?? '-'}`
  : 'Editing: New draft from Published')
const canAlignSelection = computed(() => editor.selectedObjectIds.length > 1)
const canDistributeSelection = computed(() => editor.selectedObjectIds.length > 2)
const canDuplicateSelection = computed(() => selectedRuntimeObjects.value.some((object) => Boolean(object.ux?.collectionPath) && !editor.objectState(object.id).locked))
const propertySearch = computed({
  get: () => editor.draftSnapshot.session.propertySearch,
  set: (value: string) => {
    editor.setPropertySearch(value)
    markSessionChanged()
  }
})
const primaryLayout = computed(() => editor.draftSnapshot.layout[editor.selectedObjectId] ?? {})
const statusPosition = computed(() => `${formatStatusValue(primaryLayout.value.x, 0)}, ${formatStatusValue(primaryLayout.value.y, 0)}`)
const statusSize = computed(() => `${formatStatusValue(primaryLayout.value.width, 'auto')} × ${formatStatusValue(primaryLayout.value.height, 'auto')}`)
const statusDraft = computed(() => editorSaveStatus.value || (editor.hasUnsavedChanges || editorHasChanges.value ? 'Unsaved' : 'Saved'))
const previewFps = computed(() => previewUpdateDuration.value > 0 ? Math.min(60, Math.round(1000 / Math.max(16.67, previewUpdateDuration.value))) : 60)
const selectionBoxStyle = computed(() => {
  const state = selectionBox.value
  return {
    left: `${Math.min(state.startX, state.currentX)}px`,
    top: `${Math.min(state.startY, state.currentY)}px`,
    width: `${Math.abs(state.currentX - state.startX)}px`,
    height: `${Math.abs(state.currentY - state.startY)}px`
  }
})

function formatStatusValue(value: EditorValue, fallback: string | number): string {
  return value === undefined || value === null || value === '' ? String(fallback) : String(value)
}

const previewFrameStyle = computed(() => ({
  width: `${1440 * previewScale.value}px`,
  height: `${previewHeight.value * previewScale.value + 48}px`
}))

const previewStageStyle = computed(() => ({
  width: '1440px',
  transform: `scale(${previewScale.value})`
}))

function descriptorFor(entity: EditorRuntimeObject): EntityDescriptor {
  return {
    entityId: entity.id,
    section: entity.section,
    label: entity.label,
    kind: entity.kind,
    objectType: entity.type,
    layerId: entity.layerId,
    parentLayerId: entity.parentLayerId,
    capabilities: entity.capabilities,
    propertyValues: Object.fromEntries(entity.properties.map((property) => [property.metadata.propertyKey, property.read()])),
    ux: entity.ux
  }
}

const selectedDescriptor = computed(() => selectedEntity.value ? descriptorFor(selectedEntity.value) : null)
function resolveRuntimeMetadata(metadata: PropertyRegistryEntry): PropertyRegistryEntry {
  return metadata
}

const registryPanelProperties = computed<PanelProperty[]>(() => {
  const descriptor = selectedDescriptor.value
  if (!descriptor) return []
  return resolveProperties(descriptor, editor.draftSnapshot).filter((metadata) => metadata.category !== 'content').map((metadata) => {
    const resolved = resolveRuntimeMetadata(metadata)
    const runtimeProperty = resolved.databaseMapping.kind === 'runtime'
      ? selectedEntity.value?.properties.find((property) => property.metadata.propertyKey === resolved.propertyKey)
      : undefined
    return { key: resolved.propertyKey, metadata: resolved, runtimeProperty }
  })
})
const runtimeContentProperties = computed<PanelProperty[]>(() => (selectedEntity.value?.properties ?? [])
  .filter((property) => property.metadata.category === 'content' || property.metadata.capability === 'content')
  .map((runtimeProperty, index) => ({
    key: `runtime.${selectedEntity.value?.id}.${runtimeProperty.key}`,
    runtimeProperty,
    metadata: {
      ...runtimeProperty.metadata,
      propertyKey: `runtime.${selectedEntity.value?.id}.${runtimeProperty.key}`,
      category: 'content',
      categoryLabel: 'CONTENT',
      categoryOrder: 0,
      presentation: 'inline',
      order: index,
      databaseMapping: { kind: 'runtime', path: runtimeProperty.path },
      binding: { kind: 'runtime', path: runtimeProperty.path }
    }
  })))
const selectedPanelProperties = computed(() => [...runtimeContentProperties.value, ...registryPanelProperties.value]
  .sort((left, right) => (left.metadata.categoryOrder ?? 100) - (right.metadata.categoryOrder ?? 100) || left.metadata.order - right.metadata.order))
const canCopyStyle = computed(() => registryPanelProperties.value.some((property) => property.metadata.copyable && property.metadata.styleKey))
const canPasteStyle = computed(() => {
  if (!editor.styleClipboard || selectedObjectLocked.value) return false
  const styleKeys = new Set(registryPanelProperties.value.filter((property) => property.metadata.copyable).map((property) => property.metadata.styleKey))
  return editor.styleClipboard.entries.some((entry) => styleKeys.has(entry.styleKey))
})
const selectedPropertyValues = computed(() => Object.fromEntries(selectedPanelProperties.value.map((property) => [property.metadata.propertyKey, readPanelValue(property)])))
const selectedPanelGroups = computed<PanelGroup[]>(() => {
  const groups = new Map<string, { label: string; order: number; presentation: 'inline' | 'accordion'; properties: PanelProperty[] }>()
  for (const property of selectedPanelProperties.value) {
    const category = property.metadata.category
    const current = groups.get(category) ?? {
      label: property.metadata.categoryLabel ?? category.toUpperCase(),
      order: property.metadata.categoryOrder ?? 100,
      presentation: property.metadata.presentation ?? 'accordion',
      properties: []
    }
    current.properties.push(property)
    groups.set(category, current)
  }
  return [...groups.entries()]
    .sort((left, right) => left[1].order - right[1].order)
    .map(([key, group]) => {
      const rows = new Map<string, PanelProperty[]>()
      for (const property of group.properties.sort((left, right) => left.metadata.order - right.metadata.order)) {
        const rowKey = property.metadata.rowKey ?? property.key
        rows.set(rowKey, [...(rows.get(rowKey) ?? []), property])
      }
      return { key, label: group.label, presentation: group.presentation, rows: [...rows.entries()].map(([rowKey, properties]) => ({ key: rowKey, properties })) }
    })
})

watch(() => editor.previewMutation.version, async () => {
  const mutation = editor.previewMutation
  const sitePaths = mutation.propertyPaths.filter((path) => /^(content|visual|behavior)(\.|$)/.test(path))
  if (mutation.propertyPaths.includes('*')) hydrateEditorPreviewSnapshot()
  else {
    if (sitePaths.length) site.hydrateEditorPreviewPaths({
      content: toRaw(editor.draftSnapshot.content),
      visual: toRaw(editor.draftSnapshot.visual),
      behavior: toRaw(editor.draftSnapshot.behavior)
    }, sitePaths)
    if (mutation.propertyPaths.some((path) => /^certificateCards(\.|$)/.test(path))) certificates.hydrateEditorCards(editor.draftSnapshot.certificateCards)
  }
  if (mutation.propertyPaths.some((path) => path === '*' || /^media(\.|$)/.test(path))) await syncSnapshotMediaToPreview()
  await nextTick()
  schedulePreviewObjects(mutation.objectIds)
})

watch(previewScale, (zoom) => {
  if (!editorReady.value) return
  editor.setViewport({ zoom, userZoom: userZoom.value })
  markSessionChanged()
})

watch(() => editor.selectedObjectIds.join('|'), () => void nextTick(updateSelectedOutline))

watch(editorEntities, (objects) => {
  if (!editorReady.value) return
  editor.registerObjects(objects)
  void nextTick(() => {
    decoratePreviewEntities()
    applyEditorPreviewStyles()
  })
}, { deep: false })

function hydrateEditorPreviewSnapshot(): void {
  const snapshot = editor.draftSnapshot
  site.hydrateEditorPreview({
    content: toRaw(snapshot.content),
    visual: toRaw(snapshot.visual),
    behavior: toRaw(snapshot.behavior)
  })
  if (snapshot.certificateCards.length) certificates.hydrateEditorCards(snapshot.certificateCards)
}

function schedulePreviewObjects(objectIds: string[]): void {
  for (const objectId of objectIds) pendingPreviewObjectIds.add(objectId)
  if (previewFrameRequest) return
  previewFrameRequest = requestAnimationFrame(() => {
    previewFrameRequest = 0
    const started = performance.now()
    const root = previewStage.value
    if (root) {
      if (!pendingPreviewObjectIds.size) applyRegisteredSnapshotProperties(root, editor.draftSnapshot)
      else for (const objectId of pendingPreviewObjectIds) applyRegisteredObjectProperties(root, editor.draftSnapshot, objectId)
    }
    pendingPreviewObjectIds.clear()
    decoratePreviewEntities()
    updateSelectedOutline()
    previewUpdateDuration.value = performance.now() - started
    previewUpdateCount.value += 1
  })
}

async function initializeEditor(): Promise<void> {
  initializationError.value = ''
  editorReady.value = false
  previewObserver?.disconnect()
  unregisterSave?.()
  unregisterPublish?.()
  previewObserver = null
  unregisterSave = null
  unregisterPublish = null
  try {
    await certificates.loadInitial()
    const requestedDraftId = typeof route.query.draft === 'string' ? route.query.draft : undefined
    const savedDraft = requestedDraftId === 'new' ? null : await editorDraftRepository.loadDraft(requestedDraftId)
    if (requestedDraftId && requestedDraftId !== 'new' && !savedDraft) throw new Error('The requested Draft could not be found. Retry or return to the Draft Library.')
    const published = await guestPublishedRepository.loadPublishedSnapshot()
    if (!published) await site.load()
    const publishedSnapshot = published
      ? await guestPublishedRepository.resolvePublishedMedia(published.snapshot)
      : createEditorSnapshot(toRaw(site.current))
    publishedBaseline.value = cloneEditorData(publishedSnapshot)

    if (savedDraft) {
      editor.initialize(savedDraft.revision.snapshot, {
        draftRevisionId: savedDraft.revision.id,
        draftRevisionNumber: savedDraft.revision.revision_number,
        draftLockVersion: savedDraft.revision.lock_version,
        baseRevisionNumber: published?.revision.source_draft_revision_id === savedDraft.revision.id
          ? published.revision.revision_number
          : savedDraft.revision.base_revision_number,
        publishedRevisionNumber: published?.revision.revision_number ?? savedDraft.revision.base_revision_number
      })
      editor.draftMediaReferences = savedDraft.mediaReferences
      draftScope.value = savedDraft.revision.id
    } else {
      editor.initialize(publishedSnapshot, {
        publishedRevisionNumber: published?.revision.revision_number ?? null,
        baseRevisionNumber: published?.revision.revision_number ?? null
      })
      editor.draftSnapshot.certificateCards = certificates.editableCards.map(({ origin: _origin, ...card }) => card)
      editor.draftMediaReferences = []
    }

    hydrateEditorPreviewSnapshot()
    await nextTick()
    editor.registerObjects(editorEntities.value)

    managedMediaAreaIds.clear()
    for (const assignment of editor.draftSnapshot.media.assignments) {
      if (photoRegistry.find(assignment.entityId)) managedMediaAreaIds.add(assignment.entityId)
    }
    restoreSelectionFromSession()
    const requestedObjectId = typeof route.query.object === 'string' ? route.query.object : ''
    if (requestedObjectId) void nextTick(() => {
      selectRegisteredObject(requestedObjectId)
      focusPreviewObject(requestedObjectId)
    })
    userZoom.value = editor.draftSnapshot.session.userZoom ?? null
    await nextTick()
    if (canvasScroll.value) {
      canvasScroll.value.scrollTop = editor.draftSnapshot.session.previewScrollTop
      canvasScroll.value.scrollLeft = editor.draftSnapshot.session.previewScrollLeft
    }
    if (savedDraft) await restoreDraftMedia(savedDraft.mediaReferences)

    editorHasChanges.value = false
    editorSaveStatus.value = ''
    saveStatus.value = ''
    editorReady.value = true
    unregisterSave = registerEditorSave(saveDraft)
    unregisterPublish = registerEditorPublish(publishCurrentDraft)
    previewObserver = new ResizeObserver(updatePreviewMetrics)
    if (canvasScroll.value) previewObserver.observe(canvasScroll.value)
    if (previewStage.value) previewObserver.observe(previewStage.value)
    updatePreviewMetrics()
    decoratePreviewEntities()
    applyEditorPreviewStyles()
  } catch (error) {
    initializationError.value = error instanceof Error ? error.message : 'Editor data could not be loaded.'
    editorSaveStatus.value = 'Error'
    saveStatus.value = 'Editor could not load. Local editor state was kept. Retry to continue.'
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleEditorKeydown)
  document.addEventListener('pointerdown', closeContextMenuOnOutside)
  void initializeEditor()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleEditorKeydown)
  document.removeEventListener('pointerdown', closeContextMenuOnOutside)
  endCanvasPan()
  endPreviewObjectDrag()
  endSelectionBox()
  clearMediaDropTarget()
  if (previewFrameRequest) cancelAnimationFrame(previewFrameRequest)
  if (inlineTextEdit.value) cancelInlineTextEdit()
  previewObserver?.disconnect()
  unregisterSave?.()
  unregisterPublish?.()
  resetEditorPublishFeedback()
  if (previewStage.value) restoreRegisteredSnapshotProperties(previewStage.value)
})

function restoreSelectionFromSession(): void {
  const session = editor.draftSnapshot.session
  const exact = editorEntities.value.find((entity) => entity.id === session.selectedEntityId)
  const sectionFallback = editorEntities.value.find((entity) => entity.section === session.selectedSection)
  const fallback = editorEntities.value.find((entity) => entity.section === 'Portfolio') ?? editorEntities.value[0]
  const entity = exact ?? sectionFallback ?? fallback
  if (!entity) return
  setSelection(entity, session.activeAccordion, false)
}

function availableGroups(entity: EditorRuntimeObject): string[] {
  const descriptor = descriptorFor(entity)
  const groups = resolveProperties(descriptor, editor.draftSnapshot).map((property) => property.category)
  if (entity.properties.some((property) => property.metadata.category === 'content' || property.metadata.capability === 'content')) groups.push('font')
  return [...new Set(groups)]
}

function defaultAccordion(entity: EditorRuntimeObject): string {
  const properties = resolveProperties(descriptorFor(entity), editor.draftSnapshot)
  const groups = [...new Set(properties.map((property) => property.category))]
  return properties.find((property) => property.categoryDefaultOpen && groups.includes(property.category))?.category
    ?? (entity.photoAreaId && groups.includes('media') ? 'media' : groups[0] ?? '')
}

function setSelection(entity: EditorRuntimeObject, preferredAccordion?: string, markSession = true, mode: SelectionMode = 'replace'): void {
  const descriptor = descriptorFor(entity)
  if (mode === 'additive') editor.selectObjectAdditive(descriptor, markSession)
  else if (mode === 'range') editor.selectObjectRange(descriptor, editor.objects.map((object) => object.id), markSession)
  else editor.selectObject(descriptor, markSession)
  const primary = editorEntities.value.find((candidate) => candidate.id === editor.selectedObjectId) ?? entity
  const objectQuery = editor.objectSearch.trim().toLocaleLowerCase()
  if (objectQuery && ![primary.label, primary.id, primary.type].some((value) => value.toLocaleLowerCase().includes(objectQuery))) editor.setObjectSearch('')
  const groups = availableGroups(primary)
  const accordion = preferredAccordion && groups.includes(preferredAccordion) ? preferredAccordion : defaultAccordion(primary)
  if (markSession) editor.setAccordion(accordion)
  else {
    editor.activeAccordion = accordion
    editor.draftSnapshot.session.activeAccordion = accordion
  }
  if (markSession) markSessionChanged()
  void nextTick(() => {
    decoratePreviewEntities()
    updateSelectedOutline()
    scrollInspectorToActive()
  })
}

function selectEntity(entityId: string, previewElement?: HTMLElement, mode: SelectionMode = 'replace'): void {
  const entity = editorEntities.value.find((candidate) => candidate.id === entityId)
  if (!entity) return
  selectedPreviewElement = previewElement ?? null
  setSelection(entity, undefined, true, mode)
}

function findObjectPath(root: Record<string, unknown>, target: Record<string, unknown>): string | null {
  const visited = new WeakSet<object>()
  function visit(value: unknown, path: string): string | null {
    if (!value || typeof value !== 'object' || visited.has(value as object)) return null
    if (toRaw(value) === toRaw(target)) return path
    visited.add(value as object)
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const result = visit(child, path ? `${path}.${key}` : key)
      if (result) return result
    }
    return null
  }
  return visit(root, '')
}

function bindingPath(metadata: PropertyRegistryEntry, entityId: string): string {
  return resolvePropertyPath(metadata, entityId) ?? metadata.propertyPath
}

function fallbackRuntimeValue(metadata: PropertyRegistryEntry): EditorValue {
  const property = selectedEntity.value?.properties.find((candidate) => candidate.path === metadata.propertyPath || candidate.key === metadata.propertyPath)
  return property?.read()
}

function readPanelValue(property: PanelProperty): string | number | boolean | null {
  if (property.runtimeProperty) return property.runtimeProperty.read()
  const metadata = property.metadata
  if (metadata.databaseMapping.kind === 'metadata') {
    const valueByField: Record<string, string> = {
      objectId: selectedEntity.value?.id ?? '',
      objectType: selectedEntity.value?.type ?? '',
      capabilities: selectedEntity.value?.capabilities.join(', ') ?? '',
      validationStatus: editor.selectedPropertyErrors.length ? `${editor.selectedPropertyErrors.length} error(s)` : 'Valid',
      section: selectedEntity.value?.section ?? '',
      layer: selectedEntity.value?.layerId ?? ''
    }
    return valueByField[metadata.databaseMapping.field]
  }
  if (metadata.databaseMapping.kind === 'action') {
    const targetId = selectedPhotoArea.value?.id
    const assignment = targetId ? editor.draftSnapshot.media.assignments.find((candidate) => candidate.entityId === targetId) : undefined
    if (metadata.databaseMapping.action === 'choose-media') return assignment?.assetId ?? ''
    if (metadata.databaseMapping.action === 'set-media-crop') return assignment?.objectPosition ?? selectedPhotoArea.value?.objectPosition ?? '50% 50%'
    if (metadata.databaseMapping.action === 'set-media-fit') {
      const path = selectedEntity.value?.ux?.mediaFitPath
      return path ? primitiveValue(readSnapshotPath(editor.draftSnapshot, path) ?? metadata.defaultValue) : primitiveValue(metadata.defaultValue)
    }
    if (metadata.databaseMapping.action === 'preview-media') {
      const reference = assignment ? editor.draftSnapshot.media.references.find((candidate) => candidate.assetId === assignment.assetId) : undefined
      return reference ? mediaPreviewUrls.get(reference.assetId) ?? reference.uri : ''
    }
    return primitiveValue(metadata.defaultValue)
  }
  if (metadata.databaseMapping.kind !== 'snapshot' || !selectedEntity.value) return primitiveValue(metadata.defaultValue)
  const value = readSnapshotPath(editor.draftSnapshot, bindingPath(metadata, selectedEntity.value.id))
  return primitiveValue(metadata.serializer.deserialize(value ?? fallbackRuntimeValue(metadata) ?? metadata.defaultValue))
}

function primitiveValue(value: EditorValue): string | number | boolean | null {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null ? value : ''
}

type PropertyAction = Extract<PropertyRegistryEntry['databaseMapping'], { kind: 'action' }>['action']
const propertyActionHandlers: Partial<Record<PropertyAction, (value: string | number | boolean, property: PanelProperty) => Promise<void>>> = {
  'choose-media': async (value, property) => chooseExistingMedia(String(value), property.metadata.commandType),
  'set-media-crop': async (value, property) => setMediaCrop(String(value), property.metadata.commandType),
  'set-media-fit': async (value, property) => setMediaFit(String(value), property.metadata.commandType)
}

async function updatePanelProperty(property: PanelProperty, value: string | number | boolean): Promise<void> {
  const entity = selectedEntity.value
  if (!entity || !isPanelPropertyEnabled(property)) return
  if (property.metadata.databaseMapping.kind === 'action') {
    const handler = propertyActionHandlers[property.metadata.databaseMapping.action]
    if (handler) await handler(value, property)
    return
  }
  if (property.runtimeProperty) {
    await writeRuntimeProperty(entity, property.runtimeProperty, value)
    return
  }
  if (property.metadata.databaseMapping.kind !== 'snapshot') return
  const path = bindingPath(property.metadata, entity.id)
  const serialized = property.metadata.serializer.serialize(value)
  const applied = editor.setProperty(entity.id, path, serialized, property.metadata.commandType, { coalesceKey: `${entity.id}:${path}` })
  if (!applied) return
  markEditorChanged()
  await nextTick()
  updateSelectedOutline()
}

async function writeRuntimeProperty(entity: EditorRuntimeObject, property: RuntimeAdminProperty, value: string | number | boolean): Promise<void> {
  const previousValue = property.read()
  if (Object.is(previousValue, value)) return
  let path = property.target ? findObjectPath(site.current as unknown as Record<string, unknown>, property.target) : null
  if (!path) {
    const certificateIndex = editor.draftSnapshot.certificateCards.findIndex((card) => card.id === entity.id)
    if (certificateIndex >= 0) path = `certificateCards.${certificateIndex}`
  }
  if (!path) throw new Error(`Snapshot binding was not found for ${entity.id}.${property.path}.`)
  const snapshotPath = `${path}.${property.path}`
  const applied = editor.setProperty(entity.id, snapshotPath, property.metadata.serializer.serialize(value), property.metadata.commandType, { coalesceKey: `${entity.id}:${snapshotPath}` })
  if (!applied) return
  markEditorChanged()
}

function isPanelPropertyEnabled(property: PanelProperty): boolean {
  const descriptor = selectedDescriptor.value
  if (!descriptor) return false
  if (property.metadata.databaseMapping.kind === 'action'
    && ['remove-media', 'duplicate-media-reference', 'reveal-media-library'].includes(property.metadata.databaseMapping.action)
    && !selectedMediaAssignment.value) return false
  const context: PropertyVisibilityContext = {
    entity: descriptor,
    snapshot: editor.draftSnapshot,
    values: selectedPropertyValues.value
  }
  return (property.metadata.readOnly || !selectedObjectLocked.value) && isPropertyEnabled(property.metadata, context)
}

function panelPropertyError(property: PanelProperty): string {
  if (!selectedEntity.value || property.metadata.databaseMapping.kind !== 'snapshot') return ''
  const path = bindingPath(property.metadata, selectedEntity.value.id)
  return editor.registeredPropertyErrors.find((error) => error.propertyPath === path)?.message ?? ''
}

async function handlePropertyFile(property: PanelProperty, file: File): Promise<void> {
  const action = property.metadata.databaseMapping.kind === 'action' ? property.metadata.databaseMapping.action : undefined
  if (action !== 'upload-media' && action !== 'replace-media') return
  await uploadSelectedMedia(file, property.metadata.commandType)
}

const propertyButtonActionHandlers: Partial<Record<PropertyAction, (property: PanelProperty) => void | Promise<void>>> = {
  'choose-media': () => {
    showAssetPicker.value = true
    if (!mediaLibrary.lastLoadedAt && !mediaLibrary.loading) void mediaLibrary.refresh().catch((error) => {
      saveStatus.value = error instanceof Error ? error.message : 'Asset Library could not be loaded.'
    })
  },
  'remove-media': (property) => removeSelectedMedia(property.metadata.commandType),
  'duplicate-media-reference': (property) => duplicateSelectedMediaReference(property.metadata.commandType),
  'reveal-media-library': () => revealSelectedMedia()
}

function handlePropertyAction(property: PanelProperty): void {
  if (property.metadata.databaseMapping.kind !== 'action' || !isPanelPropertyEnabled(property)) return
  const handler = propertyButtonActionHandlers[property.metadata.databaseMapping.action]
  if (handler) void handler(property)
}

async function setMediaCrop(objectPosition: string, commandType: EditorCommandType): Promise<void> {
  const entity = selectedEntity.value
  const target = selectedPhotoArea.value
  if (!entity || !target) return
  const currentMedia = cloneEditorData(editor.draftSnapshot.media)
  const assignment = currentMedia.assignments.find((candidate) => candidate.entityId === target.id)
  if (!assignment || assignment.objectPosition === objectPosition) return
  const nextMedia: SnapshotMediaModel = {
    ...currentMedia,
    assignments: currentMedia.assignments.map((candidate) => candidate.entityId === target.id ? { ...candidate, objectPosition } : candidate)
  }
  editor.apply({
    type: commandType,
    entityId: entity.id,
    propertyPath: 'media',
    previousValue: currentMedia as unknown as EditorValue,
    nextValue: nextMedia as unknown as EditorValue,
    timestamp: Date.now(),
    metadata: { objectIds: [entity.id], photoAreaId: target.id, interaction: 'media-crop' }
  })
  await photoRegistry.updateObjectPosition(target.id, objectPosition)
  markEditorChanged()
}

async function setMediaFit(objectFit: string, commandType: EditorCommandType): Promise<void> {
  const entity = selectedEntity.value
  const path = entity?.ux?.mediaFitPath
  if (!entity || !path) return
  if (!editor.setProperty(entity.id, path, objectFit, commandType, { objectIds: [entity.id], interaction: 'media-fit' })) return
  markEditorChanged()
}

async function chooseExistingMedia(assetInput: string | MediaLibraryAsset, commandType: EditorCommandType): Promise<void> {
  const entity = selectedEntity.value
  const target = selectedPhotoArea.value
  const assetId = typeof assetInput === 'string' ? assetInput : assetInput.id
  const libraryAsset = typeof assetInput === 'string' ? mediaLibrary.assets.find((candidate) => candidate.id === assetInput) : assetInput
  const legacyAsset = site.current.mediaAssets.find((candidate) => candidate.id === assetId)
  const source = libraryAsset?.sourceUrl || legacyAsset?.source || ''
  if (!entity?.photoAreaId || !target || !source) return

  const currentMedia = cloneEditorData(editor.draftSnapshot.media)
  const currentAssignment = currentMedia.assignments.find((assignment) => assignment.entityId === target.id)
  const currentReference = currentMedia.references.find((reference) => reference.assetId === assetId)
  if (currentAssignment?.assetId === assetId && currentReference?.uri === source) return

  const nextMedia: SnapshotMediaModel = {
    ...currentMedia,
    references: [
      ...currentMedia.references.filter((reference) => reference.assetId !== assetId),
      {
        assetId,
        uri: source,
        bucket: libraryAsset?.bucket ?? undefined,
        storagePath: libraryAsset?.storagePath ?? undefined,
        mimeType: libraryAsset?.mimeType || legacyAsset?.mimeType,
        width: libraryAsset?.width ?? undefined,
        height: libraryAsset?.height ?? undefined,
        alt: libraryAsset?.name || legacyAsset?.alt
      }
    ],
    assignments: [
      ...currentMedia.assignments.filter((assignment) => assignment.entityId !== target.id),
      { entityId: target.id, role: target.role, assetId, objectPosition: target.objectPosition }
    ]
  }
  editor.apply({
    type: commandType,
    entityId: entity.id,
    propertyPath: 'media',
    previousValue: currentMedia as unknown as EditorValue,
    nextValue: nextMedia as unknown as EditorValue,
    timestamp: Date.now(),
    metadata: { assetId, photoAreaId: target.id, source: 'media-library' }
  })
  if (libraryAsset?.bucket && libraryAsset.storagePath?.startsWith('draft/')) {
    editor.draftMediaReferences = [
      ...editor.draftMediaReferences.filter((reference) => reference.assetId !== assetId),
      {
        assetId,
        bucket: libraryAsset.bucket,
        storagePath: libraryAsset.storagePath,
        mimeType: libraryAsset.mimeType,
        width: libraryAsset.width ?? 0,
        height: libraryAsset.height ?? 0,
        previewUrl: source
      }
    ]
  }
  if (isBrowserUrl(source)) mediaPreviewUrls.set(assetId, source)
  managedMediaAreaIds.add(target.id)
  await photoRegistry.updateSource(target.id, source)
  markEditorChanged()
  saveStatus.value = 'Existing media selected. Save Draft to persist its reference.'
  await nextTick()
  updateSelectedOutline()
}

async function applyPickerAsset(asset: MediaLibraryAsset): Promise<void> {
  await chooseExistingMedia(asset, 'SET_IMAGE_REFERENCE')
  showAssetPicker.value = false
}

async function removeSelectedMedia(commandType: EditorCommandType): Promise<void> {
  const entity = selectedEntity.value
  const target = selectedPhotoArea.value
  const assignment = selectedMediaAssignment.value
  if (!entity || !target || !assignment) return
  const currentMedia = cloneEditorData(editor.draftSnapshot.media)
  const nextMedia: SnapshotMediaModel = {
    ...currentMedia,
    assignments: currentMedia.assignments.filter((candidate) => candidate.entityId !== target.id)
  }
  editor.apply({
    type: commandType,
    entityId: entity.id,
    propertyPath: 'media',
    previousValue: currentMedia as unknown as EditorValue,
    nextValue: nextMedia as unknown as EditorValue,
    timestamp: Date.now(),
    metadata: { assetId: assignment.assetId, photoAreaId: target.id, interaction: 'remove-reference' }
  })
  managedMediaAreaIds.add(target.id)
  await photoRegistry.updateSource(target.id, '')
  markEditorChanged()
  saveStatus.value = 'Media reference removed from this object. The Asset Library item was not deleted.'
}

async function duplicateSelectedMediaReference(commandType: EditorCommandType): Promise<void> {
  const entity = selectedEntity.value
  const target = selectedPhotoArea.value
  const assignment = selectedMediaAssignment.value
  if (!entity || !target || !assignment) return
  const currentMedia = cloneEditorData(editor.draftSnapshot.media)
  const reference = currentMedia.references.find((candidate) => candidate.assetId === assignment.assetId)
  if (!reference) return
  const assetId = crypto.randomUUID()
  const nextMedia: SnapshotMediaModel = {
    ...currentMedia,
    references: [...currentMedia.references, { ...reference, assetId }],
    assignments: currentMedia.assignments.map((candidate) => candidate.entityId === target.id ? { ...candidate, assetId } : candidate)
  }
  editor.apply({
    type: commandType,
    entityId: entity.id,
    propertyPath: 'media',
    previousValue: currentMedia as unknown as EditorValue,
    nextValue: nextMedia as unknown as EditorValue,
    timestamp: Date.now(),
    metadata: { assetId, duplicatedFrom: reference.assetId, photoAreaId: target.id, interaction: 'duplicate-reference' }
  })
  const draftReference = editor.draftMediaReferences.find((candidate) => candidate.assetId === reference.assetId)
  if (draftReference) editor.draftMediaReferences = [...editor.draftMediaReferences, { ...draftReference, assetId }]
  const previewUrl = mediaPreviewUrls.get(reference.assetId) ?? reference.uri
  if (previewUrl) mediaPreviewUrls.set(assetId, previewUrl)
  markEditorChanged()
  saveStatus.value = 'A separate stable reference now points to the same asset.'
}

function revealSelectedMedia(): void {
  const assetId = selectedMediaAssignment.value?.assetId
  if (!assetId) return
  const href = router.resolve({ name: 'admin-media', query: { asset: assetId } }).href
  window.open(href, '_blank', 'noopener,noreferrer')
}

function clearMediaDropTarget(): void {
  previewStage.value?.querySelectorAll<HTMLElement>('.editor-media-drop-target').forEach((element) => element.classList.remove('editor-media-drop-target'))
  mediaDropTargetId.value = null
}

function mediaDropTarget(event: DragEvent): { entity: EditorRuntimeObject; element: HTMLElement | null } | null {
  const element = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-editor-object-id]') ?? null
  const objectId = element?.dataset.editorObjectId
  const direct = objectId ? editorEntities.value.find((candidate) => candidate.id === objectId && candidate.photoAreaId) : undefined
  if (direct) return { entity: direct, element }
  const selected = selectedEntity.value?.photoAreaId ? selectedEntity.value : undefined
  return selected ? { entity: selected, element: preferredPreviewElement(selected.id) } : null
}

function handleAssetDragOver(event: DragEvent): void {
  if (![...(event.dataTransfer?.types ?? [])].includes('application/x-portfolio-asset')) return
  const target = mediaDropTarget(event)
  if (!target || editor.objectState(target.entity.id).locked) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
  if (mediaDropTargetId.value !== target.entity.id) {
    clearMediaDropTarget()
    mediaDropTargetId.value = target.entity.id
    target.element?.classList.add('editor-media-drop-target')
  }
}

function handleAssetDragLeave(event: DragEvent): void {
  const bounds = canvasContainer.value?.getBoundingClientRect()
  if (!bounds || event.clientX <= bounds.left || event.clientX >= bounds.right || event.clientY <= bounds.top || event.clientY >= bounds.bottom) clearMediaDropTarget()
}

async function handleAssetDrop(event: DragEvent): Promise<void> {
  const assetId = event.dataTransfer?.getData('application/x-portfolio-asset') || event.dataTransfer?.getData('text/plain')
  const target = mediaDropTarget(event)
  clearMediaDropTarget()
  if (!assetId || !target || editor.objectState(target.entity.id).locked) return
  const asset = mediaLibrary.assets.find((candidate) => candidate.id === assetId)
  if (!asset) return
  event.preventDefault()
  selectEntity(target.entity.id, target.element ?? undefined)
  await nextTick()
  await chooseExistingMedia(asset, 'SET_IMAGE_REFERENCE')
  saveStatus.value = `${asset.name} applied to ${target.entity.label}. Save Draft to persist it.`
}

async function uploadSelectedMedia(file: File, commandType: EditorCommandType): Promise<void> {
  const entity = selectedEntity.value
  const target = selectedPhotoArea.value
  if (!entity?.photoAreaId || !target) return
  saveStatus.value = 'Uploading image...'
  try {
    const uploaded = await editorDraftRepository.uploadDraftMedia(file, draftScope.value)
    const currentMedia = cloneEditorData(editor.draftSnapshot.media)
    const nextMedia: SnapshotMediaModel = {
      ...currentMedia,
      references: [
        ...currentMedia.references.filter((reference) => reference.assetId !== uploaded.assetId),
        {
          assetId: uploaded.assetId,
          uri: uploaded.previewUrl,
          bucket: uploaded.bucket,
          storagePath: uploaded.storagePath,
          mimeType: uploaded.mimeType,
          width: uploaded.width,
          height: uploaded.height
        }
      ],
      assignments: [
        ...currentMedia.assignments.filter((assignment) => assignment.entityId !== target.id),
        { entityId: target.id, role: target.role, assetId: uploaded.assetId, objectPosition: target.objectPosition }
      ]
    }
    editor.apply({
      type: commandType,
      entityId: entity.id,
      propertyPath: 'media',
      previousValue: currentMedia as unknown as EditorValue,
      nextValue: nextMedia as unknown as EditorValue,
      timestamp: Date.now(),
      metadata: { assetId: uploaded.assetId, photoAreaId: target.id }
    })
    editor.draftMediaReferences = [
      ...editor.draftMediaReferences.filter((reference) => reference.assetId !== uploaded.assetId),
      uploaded
    ]
    mediaPreviewUrls.set(uploaded.assetId, uploaded.previewUrl)
    managedMediaAreaIds.add(target.id)
    await photoRegistry.updateSource(target.id, uploaded.previewUrl)
    mediaInputVersion.value += 1
    markEditorChanged()
    saveStatus.value = 'Image staged. Save Draft to persist its reference.'
  } catch (error) {
    saveStatus.value = error instanceof Error ? error.message : 'Image upload failed.'
  }
}

async function saveDraft(): Promise<void> {
  editor.isSavingDraft = true
  editorSaveStatus.value = 'Saving...'
  try {
    editor.setViewport({
      selectedEntityId: editor.selectedObjectId,
      selectedSection: editor.selectedSection,
      activeAccordion: editor.activeAccordion,
      previewScrollTop: canvasScroll.value?.scrollTop ?? 0,
      previewScrollLeft: canvasScroll.value?.scrollLeft ?? 0,
      zoom: previewScale.value,
      userZoom: userZoom.value
    })
    const result = await editorDraftRepository.saveDraft({
      snapshot: cloneEditorData(editor.draftSnapshot),
      mediaReferences: cloneEditorData(editor.draftMediaReferences),
      expectedBaseRevision: editor.baseRevisionNumber,
      expectedDraftLockVersion: editor.draftLockVersion,
      draftRevisionId: editor.draftRevisionId,
      createNew: !editor.draftRevisionId
    })
    editor.draftSnapshot = cloneEditorData(result.revision.snapshot)
    editor.draftMediaReferences = result.mediaReferences
    editor.markDraftSaved({
      draftRevisionId: result.revision.id,
      draftRevisionNumber: result.revision.revision_number,
      draftLockVersion: result.revision.lock_version,
      baseRevisionNumber: result.revision.base_revision_number
    })
    draftScope.value = result.revision.id
    editorHasChanges.value = false
    editorSaveStatus.value = 'Saved'
    saveStatus.value = 'Saved'
    await restoreDraftMedia(result.mediaReferences)
  } catch (error) {
    editorHasChanges.value = true
    if (error instanceof RevisionConflictError) {
      editorSaveStatus.value = 'Conflict'
      saveStatus.value = 'This draft is outdated. Reload latest draft.'
    } else {
      editorSaveStatus.value = 'Error / Unsaved'
      saveStatus.value = error instanceof Error ? error.message : 'Draft save failed.'
    }
    throw error
  } finally {
    editor.isSavingDraft = false
  }
}

async function publishCurrentDraft(note: string): Promise<void> {
  editorPublishErrors.value = []
  if (editor.registeredPropertyErrors.length) {
    const error = new PublishValidationError(editor.registeredPropertyErrors.map((item) => `${item.entityId} · ${item.message}`))
    editorPublishStatus.value = 'Failed'
    editorPublishErrors.value = error.errors
    throw error
  }
  if (!editor.draftRevisionId || editor.draftLockVersion === null) {
    const error = new PublishValidationError(['Save this workspace as a Draft before publishing.'])
    editorPublishStatus.value = 'Failed'
    editorPublishErrors.value = error.errors
    throw error
  }
  if (editorHasChanges.value || editor.hasUnsavedChanges) {
    const error = new PublishValidationError(['Save Draft before publishing unsaved content.'])
    editorPublishStatus.value = 'Failed'
    editorPublishErrors.value = error.errors
    throw error
  }

  editor.isPublishing = true
  editorPublishStatus.value = 'Publishing...'
  try {
    const validation = await editorPublishRepository.validateDraft(editor.draftRevisionId)
    if (!validation.valid) throw new PublishValidationError(validation.errors)
    const published = await editorPublishRepository.publishDraft({
      draftRevisionId: editor.draftRevisionId,
      expectedPublishedRevision: editor.publishedRevisionNumber,
      expectedDraftLockVersion: editor.draftLockVersion,
      note
    })
    editor.publishedRevisionNumber = published.revision_number
    editor.baseRevisionNumber = published.revision_number
    editorPublishStatus.value = 'Published'
    saveStatus.value = `Published revision #${published.revision_number}. You are still editing Draft #${editor.draftRevisionNumber ?? '-'}.`
    invalidatePublishedRuntimeCache(published.revision_number)
  } catch (error) {
    editorPublishStatus.value = 'Failed'
    if (error instanceof PublishValidationError) editorPublishErrors.value = error.errors
    else if (error instanceof PublishConflictError) editorPublishErrors.value = [error.message]
    else editorPublishErrors.value = [error instanceof Error ? error.message : 'Publish failed.']
    throw error
  } finally {
    editor.isPublishing = false
  }
}

async function discardDraft(): Promise<void> {
  if (editor.draftRevisionId && !window.confirm('Discard this Draft? The Published site will not be changed.')) return
  try {
    await editorDraftRepository.discardDraft(editor.draftRevisionId ?? undefined)
    const published = await guestPublishedRepository.loadPublishedSnapshot()
    const snapshot = published
      ? await guestPublishedRepository.resolvePublishedMedia(published.snapshot)
      : publishedBaseline.value ?? createEditorSnapshot(toRaw(site.current))
    publishedBaseline.value = cloneEditorData(snapshot)
    editor.initialize(snapshot, {
      publishedRevisionNumber: published?.revision.revision_number ?? null,
      baseRevisionNumber: published?.revision.revision_number ?? null
    })
    editor.draftMediaReferences = []
    mediaPreviewUrls.clear()
    hydrateEditorPreviewSnapshot()
    await nextTick()
    editor.registerObjects(editorEntities.value)
    restoreSelectionFromSession()
    userZoom.value = editor.draftSnapshot.session.userZoom ?? null
    editorHasChanges.value = false
    editorSaveStatus.value = 'Saved'
    saveStatus.value = 'Draft discarded. Published-derived workspace restored.'
  } catch (error) {
    editorSaveStatus.value = 'Error / Unsaved'
    saveStatus.value = error instanceof Error ? error.message : 'Draft could not be discarded.'
  }
}

function isBrowserUrl(value: string): boolean {
  return /^(blob:|data:|https?:|\/)/i.test(value) && !value.startsWith('/draft/')
}

async function restoreDraftMedia(references: DraftMediaReference[]): Promise<void> {
  for (const reference of references) {
    try {
      const previewUrl = await editorDraftRepository.getDraftMediaUrl(reference)
      mediaPreviewUrls.set(reference.assetId, previewUrl)
    } catch {
      saveStatus.value = 'One or more Draft media previews could not be restored.'
    }
  }
  await syncSnapshotMediaToPreview()
}

async function syncSnapshotMediaToPreview(): Promise<void> {
  const assignedIds = new Set(editor.draftSnapshot.media.assignments.map((assignment) => assignment.entityId))
  for (const areaId of managedMediaAreaIds) {
    if (!assignedIds.has(areaId) && photoRegistry.find(areaId)) await photoRegistry.updateSource(areaId, '')
  }
  for (const assignment of editor.draftSnapshot.media.assignments) {
    const reference = editor.draftSnapshot.media.references.find((candidate) => candidate.assetId === assignment.assetId)
    if (!reference || !photoRegistry.find(assignment.entityId)) continue
    managedMediaAreaIds.add(assignment.entityId)
    let previewUrl = mediaPreviewUrls.get(reference.assetId)
    if (!previewUrl && isBrowserUrl(reference.uri)) previewUrl = reference.uri
    if (!previewUrl && reference.bucket && reference.storagePath) {
      try {
        previewUrl = await editorDraftRepository.getDraftMediaUrl({
          assetId: reference.assetId,
          bucket: reference.bucket,
          storagePath: reference.storagePath,
          mimeType: reference.mimeType ?? '',
          width: reference.width ?? 0,
          height: reference.height ?? 0
        })
        mediaPreviewUrls.set(reference.assetId, previewUrl)
      } catch {
        continue
      }
    }
    if (previewUrl) await photoRegistry.updateSource(assignment.entityId, previewUrl)
  }
}

function updatePreviewMetrics(): void {
  const viewportWidth = canvasScroll.value?.clientWidth ?? 900
  fitScale.value = Math.min(1, Math.max(0.34, (viewportWidth - 48) / 1440))
  void nextTick(() => { previewHeight.value = previewStage.value?.scrollHeight ?? previewHeight.value })
}

function setPreviewZoom(event: Event): void {
  const value = (event.target as HTMLSelectElement).value
  setZoom(value === 'fit' ? null : Number(value))
}

function setZoom(zoom: number | null, focalX?: number, focalY?: number): void {
  const viewport = canvasScroll.value
  const oldScale = previewScale.value
  const localX = focalX ?? (viewport?.clientWidth ?? 0) / 2
  const localY = focalY ?? (viewport?.clientHeight ?? 0) / 2
  const contentX = ((viewport?.scrollLeft ?? 0) + localX) / oldScale
  const contentY = ((viewport?.scrollTop ?? 0) + localY) / oldScale
  userZoom.value = zoom === null ? null : Math.min(2, Math.max(.25, Number(zoom.toFixed(2))))
  void nextTick(() => {
    if (!viewport) return
    viewport.scrollLeft = contentX * previewScale.value - localX
    viewport.scrollTop = contentY * previewScale.value - localY
    updateSelectedOutline()
  })
}

function handleCanvasWheel(event: WheelEvent): void {
  if (!event.ctrlKey) return
  event.preventDefault()
  const bounds = canvasScroll.value?.getBoundingClientRect()
  const current = previewScale.value
  setZoom(current + (event.deltaY < 0 ? .05 : -.05), bounds ? event.clientX - bounds.left : undefined, bounds ? event.clientY - bounds.top : undefined)
}

function beginCanvasPan(event: PointerEvent): void {
  if (event.button !== 1 || !canvasScroll.value) return
  event.preventDefault()
  panPointerId = event.pointerId
  panStartX = event.clientX
  panStartY = event.clientY
  panScrollLeft = canvasScroll.value.scrollLeft
  panScrollTop = canvasScroll.value.scrollTop
  isPanning.value = true
  window.addEventListener('pointermove', moveCanvasPan)
  window.addEventListener('pointerup', endCanvasPan, { once: true })
}

function beginPreviewPointer(event: PointerEvent): void {
  const target = (event.target as HTMLElement).closest<HTMLElement>('[data-editor-object-id]')
  const objectId = target?.dataset.editorObjectId
  if (!target || !objectId) {
    beginSelectionBox(event)
    return
  }
  if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey) return
  const object = editor.objects.find((candidate) => candidate.id === objectId)
  if (!object || editor.objectState(object.id).locked || !object.capabilities.includes('position')) return
  if (!editor.selectedObjectIds.includes(objectId)) selectEntity(objectId, target)
  const elements = editor.selectedObjects.flatMap((selected) => {
    if (!selected.capabilities.includes('position') || editor.objectState(selected.id).locked) return []
    const element = preferredPreviewElement(selected.id)
    return element ? [{ objectId: selected.id, element, originalTranslate: element.style.translate }] : []
  })
  if (!elements.length) return
  previewDrag = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, moved: false, elements }
  window.addEventListener('pointermove', movePreviewObjectDrag)
  window.addEventListener('pointerup', endPreviewObjectDrag, { once: true })
}

function movePreviewObjectDrag(event: PointerEvent): void {
  const drag = previewDrag
  if (!drag || drag.pointerId !== event.pointerId) return
  const clientX = event.clientX - drag.startX
  const clientY = event.clientY - drag.startY
  if (!drag.moved && Math.hypot(clientX, clientY) < 3) return
  event.preventDefault()
  drag.moved = true
  selectionBoxMoved = true
  const x = clientX / (previewScale.value || 1)
  const y = clientY / (previewScale.value || 1)
  for (const item of drag.elements) {
    item.element.classList.add('editor-preview-dragging')
    item.element.style.translate = `${x}px ${y}px`
  }
}

function endPreviewObjectDrag(event?: PointerEvent): void {
  window.removeEventListener('pointermove', movePreviewObjectDrag)
  const drag = previewDrag
  if (!drag) return
  previewDrag = null
  const x = ((event?.clientX ?? drag.startX) - drag.startX) / (previewScale.value || 1)
  const y = ((event?.clientY ?? drag.startY) - drag.startY) / (previewScale.value || 1)
  for (const item of drag.elements) {
    item.element.style.translate = item.originalTranslate
    item.element.classList.remove('editor-preview-dragging')
  }
  if (!drag.moved) return
  const offsets = new Map(drag.elements.map((item) => [item.objectId, { x, y }]))
  if (applySelectionOffsets(offsets, 'NUDGE') && previewStage.value) {
    for (const item of drag.elements) applyRegisteredObjectProperties(previewStage.value, editor.draftSnapshot, item.objectId)
    updateSelectedOutline()
    saveStatus.value = `Moved ${drag.elements.length} object${drag.elements.length === 1 ? '' : 's'}.`
  }
}

function moveCanvasPan(event: PointerEvent): void {
  if (panPointerId !== event.pointerId || !canvasScroll.value) return
  canvasScroll.value.scrollLeft = panScrollLeft - (event.clientX - panStartX)
  canvasScroll.value.scrollTop = panScrollTop - (event.clientY - panStartY)
}

function endCanvasPan(): void {
  window.removeEventListener('pointermove', moveCanvasPan)
  panPointerId = null
  isPanning.value = false
}

function persistPreviewScroll(event: Event): void {
  const element = event.currentTarget as HTMLElement
  editor.setViewport({ previewScrollTop: element.scrollTop, previewScrollLeft: element.scrollLeft })
  markSessionChanged()
}

function markSessionChanged(): void {
  if (!editorReady.value) return
  if (!editorHasChanges.value && !['Conflict', 'Error / Unsaved'].includes(editorSaveStatus.value)) editorSaveStatus.value = 'Unsaved session'
}

function selectPreviewEntity(event: MouseEvent): void {
  if (selectionBoxMoved) {
    selectionBoxMoved = false
    return
  }
  const target = (event.target as HTMLElement).closest<HTMLElement>('[data-editor-object-id]')
  const entityId = target?.dataset.editorObjectId
  if (!entityId || !target) return
  selectEntity(entityId, target, event.shiftKey ? 'range' : event.ctrlKey || event.metaKey ? 'additive' : 'replace')
}

function decoratePreviewEntities(): void {
  const selector = '[data-media-usage-id], [data-photo-area-id], [data-certificate-id], [data-entity-id]'
  previewStage.value?.querySelectorAll<HTMLElement>(selector).forEach((element) => {
    const entityId = element.dataset.mediaUsageId
      ?? element.dataset.photoAreaId
      ?? element.dataset.certificateId
      ?? element.dataset.entityId
    const object = entityId ? editorEntities.value.find((candidate) => candidate.id === entityId) : undefined
    if (!object) return
    const state = editor.objectState(object.id)
    element.dataset.editorEntityId = object.id
    element.dataset.editorObjectId = object.id
    element.dataset.editorObjectType = object.type
    element.dataset.editorCapabilities = object.capabilities.join(' ')
    element.classList.toggle('editor-preview-locked', state.locked)
    element.classList.toggle('editor-preview-hidden', state.hidden)
  })
  updateSelectedOutline()
}

function preferredPreviewElement(entityId: string): HTMLElement | null {
  const matches = [...(previewStage.value?.querySelectorAll<HTMLElement>('[data-editor-object-id]') ?? [])]
    .filter((element) => element.dataset.editorObjectId === entityId)
  if (!matches.length) return null
  return matches.sort((left, right) => {
    const leftRect = left.getBoundingClientRect()
    const rightRect = right.getBoundingClientRect()
    return (leftRect.width * leftRect.height || Number.MAX_SAFE_INTEGER) - (rightRect.width * rightRect.height || Number.MAX_SAFE_INTEGER)
  })[0] ?? null
}

function updateSelectedOutline(): void {
  previewStage.value?.querySelectorAll<HTMLElement>('.editor-preview-selected').forEach((element) => element.classList.remove('editor-preview-selected'))
  previewStage.value?.querySelectorAll<HTMLElement>('.editor-preview-selected--primary').forEach((element) => element.classList.remove('editor-preview-selected--primary'))
  for (const objectId of editor.selectedObjectIds) preferredPreviewElement(objectId)?.classList.add('editor-preview-selected')
  const selected = selectedPreviewElement?.isConnected && selectedPreviewElement.dataset.editorObjectId === editor.selectedObjectId
    ? selectedPreviewElement
    : preferredPreviewElement(editor.selectedObjectId)
  selected?.classList.add('editor-preview-selected', 'editor-preview-selected--primary')
  selectedPreviewElement = selected ?? null
}

function applyEditorPreviewStyles(): void {
  if (previewStage.value) applyRegisteredSnapshotProperties(previewStage.value, editor.draftSnapshot)
  decoratePreviewEntities()
  updateSelectedOutline()
}

function focusPreviewObject(objectId: string): void {
  void nextTick(() => {
    const element = preferredPreviewElement(objectId)
    element?.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' })
    selectedPreviewElement = element
    updateSelectedOutline()
  })
}

function selectNavigatorObject(objectId: string, focusPreview: boolean, additive = false, range = false): void {
  selectEntity(objectId, undefined, range ? 'range' : additive ? 'additive' : 'replace')
  if (focusPreview) focusPreviewObject(objectId)
}

function setObjectSearch(value: string): void {
  editor.setObjectSearch(value)
}

function setLayerExpanded(layerId: string, expanded: boolean): void {
  editor.setLayerExpanded(layerId, expanded)
  markSessionChanged()
}

function reorderLayerObject(objectId: string, targetObjectId: string): void {
  const source = editor.objects.find((object) => object.id === objectId)
  const target = editor.objects.find((object) => object.id === targetObjectId)
  if (!source || !target || source.section !== target.section || !editor.reorderObject(objectId, targetObjectId)) return
  const layerObjects = editor.objects.filter((object) => object.section === source.section && object.capabilities.includes('position') && !editor.objectState(object.id).locked)
  const changes = layerObjects.map((object, index) => ({ propertyPath: `layout.${object.id}.zIndex`, nextValue: index }))
  if (changes.length) {
    editor.setProperties(objectId, changes, { objectIds: layerObjects.map((object) => object.id), interaction: 'layer-reorder' }, 'REORDER')
    markEditorChanged()
  }
}

function renameLayerObject(objectId: string, name: string): void {
  if (!editor.renameObject(objectId, name)) return
  markEditorChanged()
  saveStatus.value = `Layer renamed to “${name.trim()}”.`
}

function setObjectLocked(objectId: string, locked: boolean): void {
  editor.setObjectState(objectId, { locked })
  markSessionChanged()
  decoratePreviewEntities()
}

function setObjectHidden(objectId: string, hidden: boolean): void {
  editor.setObjectState(objectId, { hidden })
  markSessionChanged()
  decoratePreviewEntities()
}

function copySelectedStyle(): void {
  const object = selectedEntity.value
  if (!object) return
  const copied = new Set<string>()
  const entries = registryPanelProperties.value.flatMap((property) => {
    const styleKey = property.metadata.styleKey
    if (!styleKey || !property.metadata.copyable || property.metadata.databaseMapping.kind !== 'snapshot' || copied.has(styleKey)) return []
    const value = property.metadata.serializer.serialize(readPanelValue(property))
    if (value === undefined || value === null || (typeof value === 'string' && !value.trim())) return []
    copied.add(styleKey)
    return [{ styleKey, capability: property.metadata.capability, value }]
  })
  editor.setStyleClipboard({ sourceObjectId: object.id, sourceObjectType: object.type, entries })
  saveStatus.value = entries.length ? `Copied ${entries.length} compatible style properties.` : 'No copyable styles are available.'
}

function pasteSelectedStyle(): void {
  const object = editor.selectedObject
  const clipboard = editor.styleClipboard
  if (!object || !clipboard || selectedObjectLocked.value) return
  const targetObjects = editor.selectedObjects.filter((target) => !editor.objectState(target.id).locked)
  const changes = targetObjects.flatMap((target) => {
    const properties = resolveProperties(target, editor.draftSnapshot)
    const targetByStyle = new Map<string, PropertyRegistryEntry>()
    for (const property of properties) {
      const styleKey = property.styleKey
      if (styleKey && property.copyable && property.databaseMapping.kind === 'snapshot' && !targetByStyle.has(styleKey)) targetByStyle.set(styleKey, property)
    }
    const values = Object.fromEntries(properties.map((property) => {
      const path = resolvePropertyPath(property, target.id)
      return [property.propertyKey, path ? readSnapshotPath(editor.draftSnapshot, path) : property.defaultValue]
    }))
    return clipboard.entries.flatMap((entry) => {
      const property = targetByStyle.get(entry.styleKey)
      if (!property) return []
      const context: PropertyVisibilityContext = { entity: target, snapshot: editor.draftSnapshot, values }
      if (!isPropertyEnabled(property, context)) return []
      return [{ propertyPath: bindingPath(property, target.id), nextValue: property.serializer.serialize(entry.value) }]
    })
  })
  if (!editor.setProperties(object.id, changes, { sourceObjectId: clipboard.sourceObjectId, objectIds: targetObjects.map((target) => target.id) }, 'PASTE_STYLE')) {
    saveStatus.value = 'No compatible style changes were available.'
    return
  }
  markEditorChanged()
  saveStatus.value = `Pasted ${changes.length} compatible style properties.`
}

function offsetValue(value: EditorValue, delta: number): EditorValue {
  if (typeof value === 'number') return Number((value + delta).toFixed(3))
  if (typeof value === 'string') {
    const match = value.trim().match(/^(-?\d+(?:\.\d+)?)([a-z%]*)$/i)
    if (match) return `${Number((Number(match[1]) + delta).toFixed(3))}${match[2]}`
  }
  return Number(delta.toFixed(3))
}

function applySelectionOffsets(offsets: Map<string, { x: number; y: number }>, type: EditorCommandType): boolean {
  const editableObjects = editor.selectedObjects.filter((object) => object.capabilities.includes('position') && !editor.objectState(object.id).locked && offsets.has(object.id))
  const changes = editableObjects.flatMap((object) => {
    const offset = offsets.get(object.id) ?? { x: 0, y: 0 }
    const layout = editor.draftSnapshot.layout[object.id]
    return [
      ...(offset.x ? [{ propertyPath: `layout.${object.id}.x`, nextValue: offsetValue(layout?.x, offset.x) }] : []),
      ...(offset.y ? [{ propertyPath: `layout.${object.id}.y`, nextValue: offsetValue(layout?.y, offset.y) }] : [])
    ]
  })
  if (!changes.length || !editor.selectedObjectId) return false
  const applied = editor.setProperties(editor.selectedObjectId, changes, {
    objectIds: editableObjects.map((object) => object.id),
    interaction: type.toLowerCase()
  }, type)
  if (applied) markEditorChanged()
  return applied
}

function nudgeSelection(x: number, y: number): void {
  const offsets = new Map(editor.selectedObjectIds.map((objectId) => [objectId, { x, y }]))
  if (applySelectionOffsets(offsets, 'NUDGE')) saveStatus.value = `Moved ${editor.selectedObjectIds.length} object${editor.selectedObjectIds.length === 1 ? '' : 's'}.`
}

function selectedElementRects(): Array<{ object: EditorObject; element: HTMLElement; rect: DOMRect }> {
  return editor.selectedObjects.flatMap((object) => {
    const element = preferredPreviewElement(object.id)
    if (!element || !element.getClientRects().length) return []
    return [{ object, element, rect: element.getBoundingClientRect() }]
  })
}

function alignSelection(mode: AlignmentMode): void {
  const items = selectedElementRects().filter((item) => item.object.capabilities.includes('position') && !editor.objectState(item.object.id).locked)
  if (items.length < 2) return
  const bounds = {
    left: Math.min(...items.map((item) => item.rect.left)),
    right: Math.max(...items.map((item) => item.rect.right)),
    top: Math.min(...items.map((item) => item.rect.top)),
    bottom: Math.max(...items.map((item) => item.rect.bottom))
  }
  const centerX = (bounds.left + bounds.right) / 2
  const centerY = (bounds.top + bounds.bottom) / 2
  const scale = previewScale.value || 1
  const offsets = new Map<string, { x: number; y: number }>()
  for (const item of items) {
    let x = 0
    let y = 0
    if (mode === 'left') x = bounds.left - item.rect.left
    else if (mode === 'center') x = centerX - (item.rect.left + item.rect.right) / 2
    else if (mode === 'right') x = bounds.right - item.rect.right
    else if (mode === 'top') y = bounds.top - item.rect.top
    else if (mode === 'middle') y = centerY - (item.rect.top + item.rect.bottom) / 2
    else if (mode === 'bottom') y = bounds.bottom - item.rect.bottom
    offsets.set(item.object.id, { x: x / scale, y: y / scale })
  }
  if (applySelectionOffsets(offsets, 'ALIGN')) saveStatus.value = `Aligned ${items.length} objects ${mode}.`
}

function distributeSelection(axis: 'horizontal' | 'vertical', explicitSpacing = false): void {
  const items = selectedElementRects()
    .filter((item) => item.object.capabilities.includes('position') && !editor.objectState(item.object.id).locked)
    .sort((left, right) => axis === 'horizontal' ? left.rect.left - right.rect.left : left.rect.top - right.rect.top)
  if (items.length < 3) return
  const first = items[0]
  const last = items[items.length - 1]
  if (!first || !last) return
  const scale = previewScale.value || 1
  const totalSize = items.reduce((sum, item) => sum + (axis === 'horizontal' ? item.rect.width : item.rect.height), 0)
  const span = axis === 'horizontal' ? last.rect.right - first.rect.left : last.rect.bottom - first.rect.top
  const gap = explicitSpacing ? selectionGap.value * scale : (span - totalSize) / (items.length - 1)
  let cursor = axis === 'horizontal' ? first.rect.left : first.rect.top
  const offsets = new Map<string, { x: number; y: number }>()
  for (const item of items) {
    const current = axis === 'horizontal' ? item.rect.left : item.rect.top
    const delta = (cursor - current) / scale
    offsets.set(item.object.id, axis === 'horizontal' ? { x: delta, y: 0 } : { x: 0, y: delta })
    cursor += (axis === 'horizontal' ? item.rect.width : item.rect.height) + gap
  }
  if (applySelectionOffsets(offsets, 'DISTRIBUTE')) saveStatus.value = `${explicitSpacing ? 'Spaced' : 'Distributed'} ${items.length} objects ${axis === 'horizontal' ? 'horizontally' : 'vertically'}.`
}

function updateSelectionGap(value: string | number): void {
  const normalized = Number(value)
  selectionGap.value = Number.isFinite(normalized) ? Math.max(0, normalized) : 0
}

function uniqueCopyId(sourceId: string, reserved: Set<string>): string {
  const base = `${sourceId}-copy`.slice(0, 116)
  let candidate = `${base}-${Date.now().toString(36)}`
  let suffix = 1
  while (reserved.has(candidate)) candidate = `${base}-${Date.now().toString(36)}-${suffix++}`
  reserved.add(candidate)
  return candidate
}

function selectRegisteredObject(objectId: string, attempt = 0): void {
  const object = editorEntities.value.find((candidate) => candidate.id === objectId)
  if (object) {
    setSelection(object)
    return
  }
  if (attempt < 40) setTimeout(() => selectRegisteredObject(objectId, attempt + 1), 25)
}

function selectAfterObjectRemoval(removedIds: string[], attempt = 0): void {
  const next = editorEntities.value.find((object) => !removedIds.includes(object.id) && editor.draftSnapshot.entities.some((entity) => entity.entityId === object.id))
  if (next) {
    setSelection(next)
    return
  }
  if (attempt < 40) setTimeout(() => selectAfterObjectRemoval(removedIds, attempt + 1), 25)
}

async function duplicateSelectedObjects(): Promise<void> {
  saveStatus.value = 'Duplicating selected objects...'
  const sources = selectedRuntimeObjects.value.filter((object) => object.ux?.collectionPath && !editor.objectState(object.id).locked)
  if (!sources.length || !editor.selectedObjectId) {
    saveStatus.value = 'Duplicate is available for repeatable objects declared by object metadata.'
    return
  }
  const reserved = new Set(editor.objects.map((object) => object.id))
  const pairs: Array<{ sourceId: string; duplicateId: string }> = []
  const changes: Array<{ propertyPath: string; nextValue: EditorValue }> = []
  const byPath = new Map<string, EditorObject[]>()
  for (const source of sources) {
    const path = source.ux?.collectionPath
    if (path) byPath.set(path, [...(byPath.get(path) ?? []), source])
  }
  for (const [path, objects] of byPath) {
    const current = readSnapshotPath(editor.draftSnapshot, path)
    if (!Array.isArray(current)) continue
    const sourceItems = cloneEditorData(current) as Array<Record<string, unknown>>
    const next = cloneEditorData(sourceItems)
    for (const object of objects) {
      const source = sourceItems.find((item) => item && typeof item === 'object' && item.id === object.id)
      if (!source || typeof source !== 'object') continue
      const duplicate = cloneEditorData(source) as Record<string, unknown>
      const duplicateId = uniqueCopyId(object.id, reserved)
      duplicate.id = duplicateId
      if (typeof duplicate.order === 'number') duplicate.order = next.length
      next.push(duplicate)
      pairs.push({ sourceId: object.id, duplicateId })
    }
    changes.push({ propertyPath: path, nextValue: next as unknown as EditorValue })
  }
  for (const domain of ['typography', 'layout', 'backgrounds', 'buttons', 'animations'] as const) {
    const record = cloneEditorData(editor.draftSnapshot[domain]) as Record<string, EditorValue>
    let changed = false
    for (const pair of pairs) {
      if (record[pair.sourceId] === undefined) continue
      record[pair.duplicateId] = cloneEditorData(record[pair.sourceId])
      changed = true
    }
    if (changed) changes.push({ propertyPath: domain, nextValue: record })
  }
  if (!pairs.length || !editor.setProperties(editor.selectedObjectId, changes, {
    objectIds: [...sources.map((object) => object.id), ...pairs.map((pair) => pair.duplicateId)],
    duplicatedObjectIds: pairs.map((pair) => pair.duplicateId)
  }, 'DUPLICATE_OBJECT')) {
    saveStatus.value = 'No metadata-declared object could be duplicated.'
    return
  }
  markEditorChanged()
  site.hydrateEditorPreviewPaths({
    content: toRaw(editor.draftSnapshot.content),
    visual: toRaw(editor.draftSnapshot.visual),
    behavior: toRaw(editor.draftSnapshot.behavior)
  }, [...byPath.keys()])
  const duplicateId = pairs[0]?.duplicateId
  if (duplicateId) selectRegisteredObject(duplicateId)
  saveStatus.value = `Duplicated ${pairs.length} object${pairs.length === 1 ? '' : 's'}.`
}

async function deleteSelectedObjects(): Promise<void> {
  const sources = selectedRuntimeObjects.value.filter((object) => !editor.objectState(object.id).locked)
  if (!sources.length || !editor.selectedObjectId) return
  const hardDeleteIds = new Set(sources.filter((object) => object.ux?.collectionPath).map((object) => object.id))
  const changes: Array<{ propertyPath: string; nextValue: EditorValue }> = []
  const paths = [...new Set(sources.map((object) => object.ux?.collectionPath).filter((path): path is string => Boolean(path)))]
  for (const path of paths) {
    const current = readSnapshotPath(editor.draftSnapshot, path)
    if (Array.isArray(current)) changes.push({
      propertyPath: path,
      nextValue: cloneEditorData(current).filter((item) => !(item && typeof item === 'object' && hardDeleteIds.has(String((item as Record<string, unknown>).id)))) as unknown as EditorValue
    })
  }
  for (const source of sources.filter((object) => !hardDeleteIds.has(object.id))) {
    changes.push({ propertyPath: `layout.${source.id}.display`, nextValue: 'none' })
  }
  if (hardDeleteIds.size) {
    changes.push({ propertyPath: 'entities', nextValue: cloneEditorData(editor.draftSnapshot.entities).filter((entity) => !hardDeleteIds.has(entity.entityId)) as unknown as EditorValue })
    for (const domain of ['typography', 'layout', 'backgrounds', 'buttons', 'animations'] as const) {
      const record = cloneEditorData(editor.draftSnapshot[domain]) as Record<string, EditorValue>
      for (const objectId of hardDeleteIds) delete record[objectId]
      changes.push({ propertyPath: domain, nextValue: record })
    }
  }
  const removedIds = sources.map((object) => object.id)
  if (!editor.setProperties(editor.selectedObjectId, changes, { objectIds: removedIds }, 'DELETE_OBJECT')) return
  markEditorChanged()
  if (paths.length) site.hydrateEditorPreviewPaths({
    content: toRaw(editor.draftSnapshot.content),
    visual: toRaw(editor.draftSnapshot.visual),
    behavior: toRaw(editor.draftSnapshot.behavior)
  }, paths)
  selectAfterObjectRemoval(removedIds)
  saveStatus.value = `Deleted ${sources.length} object${sources.length === 1 ? '' : 's'}${hardDeleteIds.size < sources.length ? ' (fixed template objects use reversible display removal)' : ''}.`
}

function moveSelectionLayer(direction: 'front' | 'back'): void {
  const editable = editor.selectedObjects.filter((object) => object.capabilities.includes('position') && !editor.objectState(object.id).locked)
  if (!editable.length || !editor.selectedObjectId) return
  const zIndexes = editor.objects.map((object) => Number(editor.draftSnapshot.layout[object.id]?.zIndex ?? 0))
  const edge = direction === 'front' ? Math.max(0, ...zIndexes) + 1 : Math.min(0, ...zIndexes) - editable.length
  const changes = editable.map((object, index) => ({ propertyPath: `layout.${object.id}.zIndex`, nextValue: edge + index }))
  if (editor.setProperties(editor.selectedObjectId, changes, { objectIds: editable.map((object) => object.id), interaction: direction }, 'REORDER')) markEditorChanged()
  contextMenu.value.open = false
}

function openPreviewContextMenu(event: MouseEvent): void {
  const target = (event.target as HTMLElement).closest<HTMLElement>('[data-editor-object-id]')
  const entityId = target?.dataset.editorObjectId
  if (entityId && !editor.selectedObjectIds.includes(entityId)) selectEntity(entityId, target)
  const bounds = canvasContainer.value?.getBoundingClientRect()
  if (!bounds) return
  contextMenu.value = { open: true, x: event.clientX - bounds.left, y: event.clientY - bounds.top }
}

function closeContextMenuOnOutside(event: PointerEvent): void {
  if (contextMenu.value.open && !(event.target as HTMLElement | null)?.closest('.editor-context-menu')) contextMenu.value.open = false
}

function editableTextTarget(target: HTMLElement, boundary: HTMLElement): HTMLElement | null {
  if (!['IMG', 'SVG', 'PATH', 'INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) && target.textContent?.trim()) return target
  return boundary.querySelector<HTMLElement>('h1,h2,h3,h4,h5,h6,p,a,button,span')
}

async function beginInlineTextEdit(event: MouseEvent): Promise<void> {
  const boundary = (event.target as HTMLElement).closest<HTMLElement>('[data-editor-object-id]')
  const entityId = boundary?.dataset.editorObjectId
  const entity = entityId ? editorEntities.value.find((candidate) => candidate.id === entityId) : undefined
  const contentProperties = entity?.properties.filter((candidate) => candidate.metadata.category === 'content' && ['text', 'textarea'].includes(candidate.metadata.control)) ?? []
  if (!boundary || !entity || !contentProperties.length || editor.objectState(entity.id).locked) return
  const element = editableTextTarget(event.target as HTMLElement, boundary)
  if (!element) return
  const visibleText = element.innerText.trim().replace(/\s+/g, ' ')
  const property = contentProperties.find((candidate) => String(candidate.read()).trim().replace(/\s+/g, ' ') === visibleText)
    ?? (contentProperties.length === 1 ? contentProperties[0] : undefined)
  if (!property) return
  event.preventDefault()
  event.stopPropagation()
  if (inlineTextEdit.value) await commitInlineTextEdit()
  selectEntity(entity.id, boundary)
  const originalValue = String(property.read())
  inlineTextEdit.value = { entity, property, element, originalValue }
  element.classList.add('editor-inline-text-edit')
  element.setAttribute('contenteditable', 'true')
  element.setAttribute('role', 'textbox')
  element.setAttribute('aria-label', `Edit ${entity.label}`)
  element.focus({ preventScroll: true })
  const range = document.createRange()
  range.selectNodeContents(element)
  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
  element.addEventListener('blur', handleInlineBlur, { once: true })
}

function finishInlineElement(edit: InlineTextEdit): void {
  edit.element.removeEventListener('blur', handleInlineBlur)
  edit.element.removeAttribute('contenteditable')
  edit.element.removeAttribute('role')
  edit.element.removeAttribute('aria-label')
  edit.element.classList.remove('editor-inline-text-edit')
}

async function commitInlineTextEdit(): Promise<void> {
  const edit = inlineTextEdit.value
  if (!edit) return
  inlineTextEdit.value = null
  const value = edit.property.metadata.control === 'textarea' ? edit.element.innerText.trimEnd() : edit.element.innerText.trim()
  finishInlineElement(edit)
  if (value === edit.originalValue) return
  await writeRuntimeProperty(edit.entity, edit.property, value)
  saveStatus.value = `Updated ${edit.entity.label}.`
}

function cancelInlineTextEdit(): void {
  const edit = inlineTextEdit.value
  if (!edit) return
  inlineTextEdit.value = null
  edit.element.innerText = edit.originalValue
  finishInlineElement(edit)
  edit.element.blur()
  saveStatus.value = 'Inline text edit cancelled.'
}

function handleInlineBlur(): void {
  void commitInlineTextEdit()
}

function cycleEditableObject(direction: 1 | -1): void {
  const editable = editor.objects.filter((object) => !editor.objectState(object.id).hidden)
  if (!editable.length) return
  const current = editable.findIndex((object) => object.id === editor.selectedObjectId)
  const next = editable[(current + direction + editable.length) % editable.length]
  if (next) selectNavigatorObject(next.id, true)
}

function isTextEntryTarget(target: EventTarget | null): boolean {
  const element = target instanceof HTMLElement ? target : null
  return Boolean(element?.closest('input,textarea,select,[contenteditable="true"]'))
}

function handleEditorKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    if (inlineTextEdit.value) {
      event.preventDefault()
      cancelInlineTextEdit()
    }
    contextMenu.value.open = false
    return
  }
  if (isTextEntryTarget(event.target)) return
  const modifier = event.ctrlKey || event.metaKey
  const key = event.key.toLowerCase()
  if (modifier && key === 'c') {
    event.preventDefault()
    copySelectedStyle()
  } else if (modifier && key === 'v') {
    event.preventDefault()
    pasteSelectedStyle()
  } else if (modifier && key === 'd') {
    event.preventDefault()
    void duplicateSelectedObjects()
  } else if (!modifier && event.key === 'Delete') {
    event.preventDefault()
    void deleteSelectedObjects()
  } else if (!modifier && event.key === 'Tab') {
    event.preventDefault()
    cycleEditableObject(event.shiftKey ? -1 : 1)
  } else if (!modifier && !event.altKey && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
    event.preventDefault()
    const amount = event.shiftKey ? 10 : 1
    nudgeSelection(event.key === 'ArrowLeft' ? -amount : event.key === 'ArrowRight' ? amount : 0, event.key === 'ArrowUp' ? -amount : event.key === 'ArrowDown' ? amount : 0)
  }
}

function searchInspector(value: string): void {
  const query = value.trim().toLocaleLowerCase()
  if (!query) return
  const ranked = selectedPanelProperties.value.map((property) => {
    const exactSearchTerm = property.metadata.searchTerms?.some((term) => term.toLocaleLowerCase() === query)
    const label = property.metadata.label.toLocaleLowerCase()
    const key = property.metadata.propertyKey.toLocaleLowerCase()
    const category = (property.metadata.categoryLabel ?? property.metadata.category).toLocaleLowerCase()
    const score = exactSearchTerm ? 0 : label === query ? 1 : label.includes(query) ? 2 : key.includes(query) ? 3 : category.includes(query) ? 4 : 99
    return { property, score }
  }).filter((item) => item.score < 99).sort((left, right) => left.score - right.score || left.property.metadata.order - right.property.metadata.order)
  const match = ranked[0]?.property
  if (!match) return
  if (match.metadata.presentation !== 'inline') editor.setAccordion(match.metadata.category)
  void nextTick(() => scrollInspectorToActive(match.key))
}

function scrollInspectorToActive(propertyKey?: string): void {
  const selector = propertyKey
    ? `[data-property-key="${CSS.escape(propertyKey)}"]`
    : `[data-property-category="${CSS.escape(editor.activeAccordion)}"]`
  controlPanel.value?.querySelector<HTMLElement>(selector)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
}

watch(propertySearch, (value) => searchInspector(value))

function beginSelectionBox(event: PointerEvent): void {
  if (
    event.button !== 0
    || !previewRuntime.value?.contains(event.target as Node)
    || (event.target as HTMLElement).closest('[data-editor-object-id]')
  ) return
  const bounds = canvasContainer.value?.getBoundingClientRect()
  if (!bounds) return
  selectionBoxAdditive = event.ctrlKey || event.metaKey || event.shiftKey
  selectionBoxMoved = false
  selectionBox.value = {
    active: true,
    startX: event.clientX - bounds.left,
    startY: event.clientY - bounds.top,
    currentX: event.clientX - bounds.left,
    currentY: event.clientY - bounds.top
  }
  window.addEventListener('pointermove', moveSelectionBox)
  window.addEventListener('pointerup', endSelectionBox, { once: true })
}

function moveSelectionBox(event: PointerEvent): void {
  const bounds = canvasContainer.value?.getBoundingClientRect()
  if (!bounds || !selectionBox.value.active) return
  selectionBox.value.currentX = event.clientX - bounds.left
  selectionBox.value.currentY = event.clientY - bounds.top
  selectionBoxMoved = Math.abs(selectionBox.value.currentX - selectionBox.value.startX) > 4 || Math.abs(selectionBox.value.currentY - selectionBox.value.startY) > 4
}

function endSelectionBox(): void {
  window.removeEventListener('pointermove', moveSelectionBox)
  if (!selectionBox.value.active) return
  const bounds = canvasContainer.value?.getBoundingClientRect()
  if (bounds && selectionBoxMoved) {
    const left = bounds.left + Math.min(selectionBox.value.startX, selectionBox.value.currentX)
    const top = bounds.top + Math.min(selectionBox.value.startY, selectionBox.value.currentY)
    const right = bounds.left + Math.max(selectionBox.value.startX, selectionBox.value.currentX)
    const bottom = bounds.top + Math.max(selectionBox.value.startY, selectionBox.value.currentY)
    const selectedIds = editor.objects.flatMap((object) => {
      const element = preferredPreviewElement(object.id)
      if (!element || !element.getClientRects().length) return []
      const rect = element.getBoundingClientRect()
      return rect.right >= left && rect.left <= right && rect.bottom >= top && rect.top <= bottom ? [object.id] : []
    })
    const nextIds = selectionBoxAdditive ? [...new Set([...editor.selectedObjectIds, ...selectedIds])] : selectedIds
    editor.setObjectSelection(nextIds, selectedIds.at(-1) ?? editor.selectedObjectId)
    const primary = editorEntities.value.find((entity) => entity.id === editor.selectedObjectId)
    if (primary) editor.setAccordion(defaultAccordion(primary))
    markSessionChanged()
    void nextTick(updateSelectedOutline)
  }
  selectionBox.value.active = false
  setTimeout(() => { selectionBoxMoved = false }, 0)
}

function toggleAccordion(category: string): void {
  editor.setAccordion(editor.activeAccordion === category ? '' : category)
  markSessionChanged()
}

function requestOpenLibrary(name: LibraryRouteName): void {
  showOpenModal.value = false
  if (editorHasChanges.value) {
    pendingLibrary.value = name
    showUnsavedModal.value = true
    return
  }
  void router.push({ name })
}

async function saveAndContinue(): Promise<void> {
  const destination = pendingLibrary.value
  if (!destination) return
  try {
    await saveEditor()
    showUnsavedModal.value = false
    pendingLibrary.value = null
    await router.push({ name: destination })
  } catch {
    // The save flow owns the visible error and switching remains blocked.
  }
}

async function discardAndContinue(): Promise<void> {
  const destination = pendingLibrary.value
  if (!destination) return
  showUnsavedModal.value = false
  pendingLibrary.value = null
  editorHasChanges.value = false
  await router.push({ name: destination })
}

function cancelLibrarySwitch(): void {
  showUnsavedModal.value = false
  pendingLibrary.value = null
}
</script>

<template>
  <div class="edit-page">
    <EditorObjectNavigator
      :objects="editor.objects"
      :selected-object-id="editor.selectedObjectId"
      :selected-object-ids="editor.selectedObjectIds"
      :search="editor.objectSearch"
      :expanded-layers="editor.draftSnapshot.session.expandedLayers"
      :object-states="editor.draftSnapshot.session.objectStates"
      @select="selectNavigatorObject"
      @search="setObjectSearch"
      @expand="setLayerExpanded"
      @lock="setObjectLocked"
      @hide="setObjectHidden"
      @reorder="reorderLayerObject"
      @rename="renameLayerObject"
    />
    <aside ref="controlPanel" class="control-panel" aria-label="Editor property panel">
      <div class="panel-heading">
        <div>
          <h1>Inspector</h1>
          <span class="panel-hint">Professional Object Editor</span>
        </div>
        <span v-if="selectedEntity" class="selected-kind">{{ selectedEntity.type }}</span>
      </div>

      <label class="field-label" for="section-select">Section</label>
      <select id="section-select" v-model="selectedSection" class="input-field">
        <option v-for="section in sections" :key="section" :value="section">{{ section }}</option>
      </select>

      <label class="field-label" for="entity-select">Entity / element</label>
      <select id="entity-select" v-model="selectedEntityId" class="input-field" data-admin-entity-select>
        <option v-for="entity in sectionEntities" :key="entity.id" :value="entity.id">{{ entity.label }} - {{ entity.id }}</option>
      </select>

      <p v-if="selectedEntity" class="selection-summary" :data-selected-entity-id="selectedEntity.id">
        Editing <strong>{{ selectedEntity.label }}</strong>
        <em v-if="selectedObjectCount > 1">+ {{ selectedObjectCount - 1 }} selected</em>
        <span>{{ editor.selectedLayer }}</span>
      </p>

      <label class="property-search" for="property-search-input">
        <span>Search properties</span>
        <input id="property-search-input" v-model="propertySearch" type="search" placeholder="Color, shadow, layout…" data-property-search />
      </label>

      <div v-if="selectedEntity" class="object-actions" aria-label="Selected object actions">
        <button type="button" :aria-pressed="selectedObjectLocked" @click="setObjectLocked(selectedEntity.id, !selectedObjectLocked)">
          <Unlock v-if="selectedObjectLocked" :size="15" />
          <Lock v-else :size="15" />
          {{ selectedObjectLocked ? 'Unlock' : 'Lock' }}
        </button>
        <button type="button" :aria-pressed="selectedObjectHidden" @click="setObjectHidden(selectedEntity.id, !selectedObjectHidden)">
          <Eye v-if="selectedObjectHidden" :size="15" />
          <EyeOff v-else :size="15" />
          {{ selectedObjectHidden ? 'Show' : 'Hide' }}
        </button>
        <button type="button" :disabled="!canCopyStyle" @click="copySelectedStyle"><ClipboardCopy :size="15" />Copy Style</button>
        <button type="button" :disabled="!canPasteStyle" @click="pasteSelectedStyle"><ClipboardPaste :size="15" />Paste Style</button>
      </div>

      <p v-if="selectedObjectLocked" class="object-state-notice">This object is locked. Inspector controls are read-only until it is unlocked.</p>
      <p v-if="selectedObjectHidden" class="object-state-notice">Hidden only in the Admin preview. Guest Runtime remains unchanged.</p>

      <section v-if="selectedEntity" class="property-editor">
        <div v-for="group in selectedPanelGroups" :key="group.key" class="property-group" :class="{ 'property-group--inline': group.presentation === 'inline' }" :data-property-category="group.key">
          <button
            v-if="group.presentation === 'accordion'"
            type="button"
            class="accordion-toggle"
            :aria-expanded="editor.activeAccordion === group.key"
            @click="toggleAccordion(group.key)"
          >
            <span>{{ group.label }}</span>
            <span aria-hidden="true">{{ editor.activeAccordion === group.key ? '-' : '+' }}</span>
          </button>
          <Transition name="accordion-panel">
          <div v-if="group.presentation === 'inline' || editor.activeAccordion === group.key" class="accordion-content">
            <div
              v-for="row in group.rows"
              :key="row.key"
              class="property-row"
              :class="{ 'property-row--paired': row.properties.length > 1 }"
            >
              <label
                v-for="property in row.properties"
                :key="property.key"
                class="property-field"
                :class="{ 'property-field--disabled': !isPanelPropertyEnabled(property), 'property-field--error': Boolean(panelPropertyError(property)) }"
                :title="!isPanelPropertyEnabled(property) ? property.metadata.helperText : undefined"
              >
                <span>{{ property.metadata.label }}</span>
                <PropertyControl
                  :key="`${selectedEntity.id}-${property.key}-${property.metadata.control === 'file' ? mediaInputVersion : 0}`"
                  :property="property.metadata"
                  :value="readPanelValue(property)"
                  :disabled="!isPanelPropertyEnabled(property)"
                  :data-property-key="property.key"
                  @change="updatePanelProperty(property, $event)"
                  @file="handlePropertyFile(property, $event)"
                  @action="handlePropertyAction(property)"
                />
                <small v-if="!isPanelPropertyEnabled(property) && property.metadata.helperText">{{ property.metadata.helperText }}</small>
                <small v-if="panelPropertyError(property)" class="property-error" role="alert">{{ panelPropertyError(property) }}</small>
              </label>
            </div>
          </div>
          </Transition>
        </div>
        <p v-if="!selectedPanelGroups.length" class="empty-properties">No registered properties are available for this entity.</p>
      </section>

      <div v-if="editor.selectedPropertyErrors.length" class="validation-summary" role="status">
        {{ editor.selectedPropertyErrors.length }} invalid {{ editor.selectedPropertyErrors.length === 1 ? 'property' : 'properties' }}. Publish is blocked until corrected.
      </div>

      <button type="button" class="discard-draft-button" :disabled="editor.isSavingDraft" @click="discardDraft">Discard Draft</button>
      <p class="save-status" aria-live="polite">{{ saveStatus }}</p>
    </aside>

    <main
      ref="canvasContainer"
      class="canvas-container"
      aria-label="Live editor preview"
      tabindex="0"
      @contextmenu.prevent="openPreviewContextMenu"
      @dragover="handleAssetDragOver"
      @dragleave="handleAssetDragLeave"
      @drop="void handleAssetDrop($event)"
    >
      <div class="preview-toolbar">
        <span class="source-indicator">{{ sourceLabel }}</span>
        <label class="zoom-control">
          <span>Zoom</span>
          <select :value="userZoom === null ? 'fit' : String(userZoom)" @change="setPreviewZoom">
            <option value="fit">Fit</option>
            <option value="0.25">25%</option>
            <option value="0.5">50%</option>
            <option value="0.75">75%</option>
            <option value="1">100%</option>
            <option value="1.25">125%</option>
            <option value="1.5">150%</option>
            <option value="2">200%</option>
          </select>
        </label>
        <button type="button" class="open-source-button" aria-label="Open draft or favorite" @click="showOpenModal = true">+</button>
      </div>
      <div v-if="selectedObjectCount > 1" class="selection-toolbar" role="toolbar" aria-label="Multi-selection alignment">
        <span>{{ selectedObjectCount }} objects</span>
        <button type="button" aria-label="Align left" title="Align left" :disabled="!canAlignSelection" @click="alignSelection('left')">L</button>
        <button type="button" aria-label="Align horizontal center" title="Align center" :disabled="!canAlignSelection" @click="alignSelection('center')">C</button>
        <button type="button" aria-label="Align right" title="Align right" :disabled="!canAlignSelection" @click="alignSelection('right')">R</button>
        <button type="button" aria-label="Align top" title="Align top" :disabled="!canAlignSelection" @click="alignSelection('top')">T</button>
        <button type="button" aria-label="Align vertical middle" title="Align middle" :disabled="!canAlignSelection" @click="alignSelection('middle')">M</button>
        <button type="button" aria-label="Align bottom" title="Align bottom" :disabled="!canAlignSelection" @click="alignSelection('bottom')">B</button>
        <button type="button" aria-label="Distribute horizontally" title="Distribute horizontally" :disabled="!canDistributeSelection" @click="distributeSelection('horizontal')">H↔</button>
        <button type="button" aria-label="Distribute vertically" title="Distribute vertically" :disabled="!canDistributeSelection" @click="distributeSelection('vertical')">V↕</button>
        <label class="selection-spacing"><span>Gap</span><PropertyInputControl control="number" label="Distribution spacing" :model-value="selectionGap" :step="1" :minimum="0" @update:model-value="updateSelectionGap" /></label>
        <button type="button" aria-label="Apply horizontal spacing" title="Apply horizontal spacing" :disabled="!canDistributeSelection" @click="distributeSelection('horizontal', true)">Space H</button>
        <button type="button" aria-label="Apply vertical spacing" title="Apply vertical spacing" :disabled="!canDistributeSelection" @click="distributeSelection('vertical', true)">Space V</button>
      </div>
      <div v-if="initializationError" class="editor-recovery" role="alert">
        <p>{{ saveStatus }}</p>
        <small>{{ initializationError }}</small>
        <button type="button" @click="void initializeEditor()">Retry</button>
      </div>
      <div class="canvas-label">LIVE EDITOR PREVIEW</div>
      <div ref="canvasScroll" class="canvas-scroll" :class="{ 'is-panning': isPanning }" @scroll="persistPreviewScroll" @wheel="handleCanvasWheel" @pointerdown="beginCanvasPan">
        <div class="preview-frame" :style="previewFrameStyle">
          <div ref="previewStage" class="preview-stage" :style="previewStageStyle">
            <div ref="previewRuntime" class="editor-preview-runtime" data-editor-mode="true" @pointerdown.capture="beginPreviewPointer" @click.capture="selectPreviewEntity" @dblclick.capture="beginInlineTextEdit">
              <HomePage editor-preview />
            </div>
          </div>
        </div>
      </div>
      <div v-if="selectionBox.active" class="selection-box" :style="selectionBoxStyle" aria-hidden="true" />
      <menu v-if="contextMenu.open" class="editor-context-menu" :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }" aria-label="Object context menu">
        <button type="button" :disabled="!canDuplicateSelection" @click="void duplicateSelectedObjects(); contextMenu.open = false">Duplicate <kbd>Ctrl+D</kbd></button>
        <button type="button" :disabled="!canCopyStyle" @click="copySelectedStyle(); contextMenu.open = false">Copy Style <kbd>Ctrl+C</kbd></button>
        <button type="button" :disabled="!canPasteStyle" @click="pasteSelectedStyle(); contextMenu.open = false">Paste Style <kbd>Ctrl+V</kbd></button>
        <button type="button" @click="moveSelectionLayer('front')">Bring Front</button>
        <button type="button" @click="moveSelectionLayer('back')">Send Back</button>
        <button type="button" class="danger" @click="void deleteSelectedObjects(); contextMenu.open = false">Delete <kbd>Del</kbd></button>
      </menu>
      <footer class="editor-status-bar" aria-label="Editor status">
        <span><strong>Selection</strong>{{ selectedObjectCount ? `${selectedObjectCount} · ${editor.selectedObject?.name ?? editor.selectedObjectId}` : 'None' }}</span>
        <span><strong>Position</strong>{{ statusPosition }}</span>
        <span><strong>Size</strong>{{ statusSize }}</span>
        <span><strong>Draft</strong>{{ statusDraft }}</span>
        <span><strong>Revision</strong>{{ editor.draftRevisionNumber ?? 'New' }}</span>
        <span><strong>Zoom</strong>{{ Math.round(previewScale * 100) }}%</span>
        <span class="performance-status" :data-preview-update-count="previewUpdateCount" :title="`${previewUpdateCount} targeted preview updates`"><strong>Preview</strong>{{ previewFps }} FPS</span>
      </footer>
    </main>

    <AssetPickerModal
      :open="showAssetPicker"
      :target-label="selectedEntity?.label"
      :current-asset-id="selectedMediaAssignment?.assetId"
      @close="showAssetPicker = false"
      @apply="void applyPickerAsset($event)"
    />

    <div v-if="showOpenModal" class="modal-backdrop" role="presentation" @click.self="showOpenModal = false">
      <section class="source-modal" role="dialog" aria-modal="true" aria-labelledby="source-modal-title">
        <button class="modal-close" type="button" aria-label="Close" @click="showOpenModal = false">x</button>
        <h2 id="source-modal-title">Open workspace</h2>
        <p>Choose a saved editor source.</p>
        <div class="source-options">
          <button type="button" @click="requestOpenLibrary('admin-drafts')">
            <strong>Open from Draft</strong>
            <span>Continue editing one of your saved drafts.</span>
          </button>
          <button type="button" @click="requestOpenLibrary('admin-favorites')">
            <strong>Open from Favorite</strong>
            <span>Open one of your favorite drafts.</span>
          </button>
        </div>
      </section>
    </div>

    <div v-if="showUnsavedModal" class="modal-backdrop" role="presentation">
      <section class="source-modal unsaved-modal" role="dialog" aria-modal="true" aria-labelledby="unsaved-modal-title">
        <h2 id="unsaved-modal-title">You have unsaved changes.</h2>
        <p>Choose what to do before opening another workspace.</p>
        <div class="unsaved-actions">
          <button type="button" class="primary-action" :disabled="editor.isSavingDraft" @click="saveAndContinue">Save Draft &amp; Continue</button>
          <button type="button" @click="discardAndContinue">Discard Changes &amp; Continue</button>
          <button type="button" @click="cancelLibrarySwitch">Cancel</button>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.edit-page { display: grid; grid-template-columns: clamp(220px, 17vw, 270px) clamp(330px, 24vw, 390px) minmax(0, 1fr); height: 100%; min-height: 0; overflow: hidden; background: #f6f4e8; color: #49362f; }
.control-panel { min-width: 0; min-height: 0; overflow: auto; overscroll-behavior: contain; touch-action: pan-x pan-y; padding: 1.5rem 1.25rem 6rem; border-right: 1px solid rgba(73,54,47,.16); scrollbar-gutter: stable; }
.panel-heading { display: flex; justify-content: space-between; align-items: center; gap: 1rem; padding-bottom: .9rem; border-bottom: 1px solid rgba(73,54,47,.13); }
.panel-heading h1 { margin: 0; font-size: 1.5rem; }
.panel-hint, .selected-kind { color: #9a806f; font-size: .68rem; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
.selected-kind { padding: .3rem .55rem; border: 1px solid #e8ded0; border-radius: 999px; background: #fffaf4; }
.field-label, .property-field { display: grid; gap: .35rem; margin-top: 1rem; font-size: .76rem; font-weight: 700; }
.input-field, .property-field :deep(input:not([type='checkbox'])), .property-field :deep(textarea), .property-field :deep(select) { width: 100%; border: 1px solid rgba(73,54,47,.22); border-radius: 8px; padding: .62rem; background: #fffdf4; color: inherit; box-sizing: border-box; }
.property-field :deep(textarea) { min-height: 72px; resize: vertical; }
.property-field :deep(input[type='color']) { min-height: 42px; padding: .2rem; }
.property-field :deep(input[type='checkbox']) { width: 1.1rem; height: 1.1rem; accent-color: #b85b69; }
.property-field :deep(button) { width: 100%; border: 1px solid #e8ded0; border-radius: 9px; padding: .68rem; background: #fff5eb; color: #5a3e35; font-weight: 700; cursor: pointer; }
.property-field :deep(:disabled) { cursor: not-allowed; }
.property-field small { color: #9a806f; font-size: .65rem; font-weight: 500; line-height: 1.35; }
.property-field :deep(.property-readonly) { display: block; width: 100%; overflow-wrap: anywhere; padding: .62rem; border: 1px dashed rgba(73,54,47,.18); border-radius: 8px; background: rgba(246,244,232,.75); color: #78645b; font: 500 .7rem/1.45 system-ui; }
.selection-summary { display: grid; gap: .18rem; margin: .9rem 0 0; padding: .65rem .75rem; border-radius: 10px; background: rgba(255,245,235,.8); color: #7b5f3b; font-size: .72rem; }.selection-summary span { color: #a18b80; font-size: .58rem; overflow-wrap: anywhere; }.selection-summary em { color: #a44955; font-size: .66rem; font-style: normal; font-weight: 800; }
.property-search { display: grid; gap: .35rem; margin-top: .85rem; color: #765f55; font-size: .7rem; font-weight: 800; }.property-search input { width: 100%; box-sizing: border-box; border: 1px solid rgba(73,54,47,.19); border-radius: 10px; padding: .62rem .7rem; background: #fffdf7; color: inherit; font: 500 .74rem/1.2 system-ui; }.property-search input:focus { border-color: #b85b69; outline: 2px solid rgba(184,91,105,.18); outline-offset: 1px; }
.object-actions { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: .4rem; margin-top: .65rem; }.object-actions button { display: inline-flex; align-items: center; justify-content: center; gap: .35rem; min-width: 0; padding: .5rem .35rem; border: 1px solid #e4d4ca; border-radius: 9px; background: #fffaf4; color: #684e45; font-size: .65rem; font-weight: 800; cursor: pointer; }.object-actions button:hover:not(:disabled) { border-color: #c98a8f; color: #8d363a; }.object-actions button:disabled { cursor: not-allowed; opacity: .42; }
.object-state-notice { margin: .55rem 0 0; padding: .55rem .65rem; border-left: 3px solid #c98a8f; border-radius: 0 8px 8px 0; background: rgba(255,245,235,.72); color: #80675d; font-size: .66rem; line-height: 1.45; }
.property-group { margin-top: 1.1rem; border: 1px solid rgba(73,54,47,.13); border-radius: 13px; overflow: hidden; background: rgba(255,255,255,.35); }
.property-group--inline { border: 0; border-radius: 0; overflow: visible; background: transparent; }
.property-group--inline .accordion-content { padding: 0; }
.accordion-toggle { width: 100%; display: flex; justify-content: space-between; align-items: center; border: 0; padding: .85rem .9rem; background: #fff8ef; color: #5a3e35; font: inherit; font-size: .78rem; font-weight: 800; letter-spacing: .1em; text-align: left; cursor: pointer; }
.accordion-content { display: grid; gap: .15rem; padding: 0 .85rem .85rem; transition: opacity .18s ease, transform .18s ease; }
.accordion-panel-enter-active,.accordion-panel-leave-active { overflow: hidden; transition: opacity .18s ease, transform .18s ease; }.accordion-panel-enter-from,.accordion-panel-leave-to { opacity: 0; transform: translateY(-4px); }
.property-row { display: grid; gap: .7rem; }
.property-row--paired { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.property-field--disabled { opacity: .48; filter: grayscale(.2); }
.property-field--error :deep(input),.property-field--error :deep(select),.property-field--error :deep(textarea) { border-color: #bd4c4c !important; box-shadow: 0 0 0 2px rgba(189,76,76,.1); }.property-field .property-error { color: #a53f32; }.validation-summary { margin-top: 1rem; padding: .7rem .75rem; border: 1px solid rgba(165,63,50,.22); border-radius: 10px; background: #fff0eb; color: #8d363a; font-size: .7rem; font-weight: 700; line-height: 1.45; }
.empty-properties { color: #8c7568; font-size: .75rem; }
.discard-draft-button { width: 100%; margin-top: 1.25rem; border: 1px solid #d9b6b6; border-radius: 10px; padding: .7rem; background: #fffaf4; color: #8d363a; font-weight: 700; cursor: pointer; }
.save-status { min-height: 1.2em; color: #7b5f3b; font-size: .75rem; }
.canvas-container { min-width: 0; min-height: 0; position: relative; overflow: hidden; background: #ddd6c9; }.canvas-container:focus-visible { outline: 3px solid rgba(184,91,105,.52); outline-offset: -3px; }
.preview-toolbar { position: absolute; z-index: 1001; top: .65rem; left: .75rem; display: flex; align-items: center; gap: .55rem; }
.source-indicator, .zoom-control { padding: .35rem .6rem; border: 1px solid rgba(232,222,208,.9); border-radius: 999px; background: rgba(255,255,255,.92); color: #5a3e35; font-size: .68rem; font-weight: 700; }
.zoom-control { display: flex; align-items: center; gap: .35rem; }
.zoom-control select { border: 0; background: transparent; color: inherit; font: inherit; }
.open-source-button { width: 2rem; height: 2rem; border: 1px solid #e8ded0; border-radius: 50%; background: #fff5eb; color: #8d363a; font-size: 1.4rem; line-height: 1; cursor: pointer; }
.selection-toolbar { position: absolute; z-index: 1001; top: 3.15rem; left: .75rem; right: .75rem; display: flex; align-items: center; gap: .3rem; width: max-content; max-width: calc(100% - 1.5rem); padding: .38rem .45rem; overflow-x: auto; border: 1px solid rgba(232,222,208,.96); border-radius: 12px; background: rgba(255,253,247,.96); box-shadow: 0 .45rem 1.25rem rgba(73,54,47,.11); color: #5a3e35; scrollbar-width: thin; }.selection-toolbar > span { padding: 0 .35rem; white-space: nowrap; color: #8d5960; font-size: .68rem; font-weight: 800; }.selection-toolbar button { flex: 0 0 auto; min-width: 1.85rem; height: 1.85rem; border: 1px solid rgba(73,54,47,.13); border-radius: 7px; background: #fff8ef; color: #684e45; font-size: .62rem; font-weight: 900; cursor: pointer; }.selection-toolbar button:hover:not(:disabled) { border-color: #c98a8f; background: #fff1e8; color: #8d363a; }.selection-toolbar button:disabled { cursor: not-allowed; opacity: .4; }.selection-spacing { display: flex; align-items: center; gap: .3rem; padding-left: .3rem; color: #80675d; font-size: .6rem; font-weight: 800; }.selection-spacing :deep(.property-input) { width: 4.8rem; }.selection-spacing :deep(input) { border-color: rgba(73,54,47,.17); padding: .34rem .4rem; background: #fff; color: inherit; font: 700 .65rem system-ui; }.selection-spacing :deep(.numeric-scrub) { width: 1.4rem; }
.editor-recovery { position: absolute; z-index: 1002; inset: 4rem auto auto 50%; transform: translateX(-50%); width: min(90%,440px); padding: 1rem; border: 1px solid #d99898; border-radius: 16px; background: #fffaf4; color: #8d363a; box-shadow: 0 1rem 2rem rgba(73,54,47,.15); }
.editor-recovery p { margin: 0 0 .35rem; }.editor-recovery small { display: block; margin-bottom: .75rem; }.editor-recovery button { border: 1px solid #e8ded0; border-radius: 10px; padding: .6rem 1rem; background: #fff5eb; color: #5a3e35; cursor: pointer; }
.canvas-label { position: absolute; z-index: 1000; top: .75rem; right: 1rem; padding: .35rem .55rem; border-radius: 999px; background: rgba(35,28,25,.78); color: #fff; font: 600 .68rem/1 system-ui; letter-spacing: .08em; }
.canvas-scroll { width: 100%; height: calc(100% - 2.2rem); min-width: 0; min-height: 0; overflow: auto; overscroll-behavior: contain; touch-action: pan-x pan-y; background: #fff; scrollbar-gutter: stable; }.canvas-scroll.is-panning,.canvas-scroll.is-panning :deep(*) { cursor: grabbing !important; user-select: none !important; }
.preview-frame { position: relative; margin: 1.5rem auto 7rem; background: #fff; box-shadow: 0 1rem 2rem rgba(73,54,47,.12); }
.preview-stage { transform-origin: top left; }
.editor-preview-runtime :deep([data-editor-object-id]) { cursor: pointer; outline-offset: 3px; border-radius: 4px; }
.editor-preview-runtime :deep([data-editor-object-id]:hover) { outline: 1px dashed rgba(184,91,105,.55); background: transparent; }
.editor-preview-runtime :deep(.editor-preview-selected) { outline: 1.5px solid rgba(184,91,105,.78) !important; outline-offset: 3px !important; border-radius: 6px; background: transparent !important; }.editor-preview-runtime :deep(.editor-preview-selected--primary) { outline-width: 3px !important; outline-color: rgba(184,91,105,.98) !important; outline-offset: 4px !important; border-radius: 7px; }
.editor-preview-runtime :deep(.editor-media-drop-target) { outline: 4px solid rgba(172,78,94,.98) !important; outline-offset: 6px !important; border-radius: 9px; background: rgba(255,244,236,.12) !important; box-shadow: 0 0 0 5px rgba(255,255,255,.72),0 0 0 9px rgba(172,78,94,.18); }
.editor-preview-runtime :deep(.editor-preview-locked) { cursor: default; }.editor-preview-runtime :deep(.editor-preview-locked.editor-preview-selected) { outline-style: dashed !important; outline-color: rgba(139,100,65,.95) !important; }
.editor-preview-runtime :deep(.editor-preview-hidden) { opacity: .08 !important; pointer-events: none; }.editor-preview-runtime :deep(.editor-preview-hidden.editor-preview-selected) { opacity: .2 !important; outline-style: dotted !important; }
.editor-preview-runtime :deep(.editor-inline-text-edit) { min-width: 1ch; cursor: text !important; outline: 2px solid rgba(184,91,105,.92) !important; outline-offset: 3px !important; border-radius: 3px; caret-color: #8d363a; background: transparent !important; }
.editor-preview-runtime :deep(.editor-preview-dragging) { cursor: move !important; will-change: translate; }
.selection-box { position: absolute; z-index: 1100; pointer-events: none; border: 1.5px solid rgba(184,91,105,.92); border-radius: 4px; background: rgba(184,91,105,.035); box-shadow: 0 0 0 1px rgba(255,255,255,.75) inset; }
.editor-context-menu { position: absolute; z-index: 1300; display: grid; width: 215px; margin: 0; padding: .42rem; border: 1px solid rgba(73,54,47,.16); border-radius: 12px; background: rgba(255,253,247,.98); box-shadow: 0 .85rem 2.2rem rgba(73,54,47,.2); list-style: none; }.editor-context-menu button { display: flex; align-items: center; justify-content: space-between; gap: .75rem; width: 100%; border: 0; border-radius: 8px; padding: .55rem .62rem; background: transparent; color: #5a3e35; text-align: left; font: 700 .7rem system-ui; cursor: pointer; }.editor-context-menu button:hover:not(:disabled),.editor-context-menu button:focus-visible { outline: 0; background: #fff1e8; color: #8d363a; }.editor-context-menu button:disabled { cursor: not-allowed; opacity: .4; }.editor-context-menu button.danger { color: #9b3f3f; }.editor-context-menu kbd { color: #a18b80; font: 600 .58rem system-ui; }
.editor-status-bar { position: absolute; z-index: 1003; inset: auto 0 0; display: flex; align-items: stretch; gap: 0; height: 2.2rem; overflow-x: auto; border-top: 1px solid rgba(73,54,47,.14); background: rgba(246,244,232,.98); color: #765f55; scrollbar-width: thin; }.editor-status-bar span { display: flex; align-items: center; gap: .35rem; flex: 0 0 auto; min-width: 82px; padding: 0 .7rem; border-right: 1px solid rgba(73,54,47,.1); white-space: nowrap; font-size: .61rem; }.editor-status-bar strong { color: #9a806f; font-size: .55rem; letter-spacing: .04em; text-transform: uppercase; }.editor-status-bar .performance-status { margin-left: auto; color: #55725d; }
.canvas-container button:focus-visible,.canvas-container select:focus-visible,.canvas-container input:focus-visible,.object-actions button:focus-visible,.accordion-toggle:focus-visible,.discard-draft-button:focus-visible { outline: 2px solid #b85b69; outline-offset: 2px; }
.modal-backdrop { position: fixed; z-index: 2000; inset: 0; display: grid; place-items: center; padding: 1rem; background: rgba(73,54,47,.35); }
.source-modal { position: relative; width: min(100%,620px); padding: 2rem; border-radius: 24px; background: #f6f4e8; color: #49362f; box-shadow: 0 1.5rem 4rem rgba(73,54,47,.25); }
.source-modal h2 { margin: 0; color: #5a3e35; }.source-modal p { color: #7b5f3b; }.modal-close { position: absolute; top: 1rem; right: 1rem; border: 0; background: transparent; font-size: 1.25rem; color: #7b5f3b; cursor: pointer; }
.source-options { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }.source-options button { display: grid; gap: .55rem; min-height: 140px; border: 1px solid #e8ded0; border-radius: 16px; padding: 1.2rem; background: #fff5eb; color: #5a3e35; text-align: left; cursor: pointer; }.source-options span { color: #7b5f3b; font-size: .85rem; font-weight: 400; }
.unsaved-actions { display: grid; gap: .65rem; }.unsaved-actions button { border: 1px solid #e8ded0; border-radius: 11px; padding: .75rem 1rem; background: #fffaf4; color: #5a3e35; cursor: pointer; font-weight: 700; }.unsaved-actions .primary-action { background: #8d363a; color: #fff; }
@media (max-width: 1100px) { .edit-page { grid-template-columns: 210px 330px minmax(0,1fr); }.control-panel { padding-left: 1rem; padding-right: 1rem; } }
@media (max-width: 760px) { .edit-page { display: flex; flex-direction: column; height: 100%; }.edit-page :deep(.object-navigator) { flex: 0 0 28%; max-height: 28%; border-right: 0; border-bottom: 1px solid rgba(73,54,47,.16); }.control-panel { flex: 0 0 40%; max-height: 40%; border-right: 0; border-bottom: 1px solid rgba(73,54,47,.16); }.canvas-container { flex: 1 1 32%; min-height: 0; }.canvas-label { display: none; }.preview-toolbar { max-width: calc(100% - 1.5rem); }.source-indicator { max-width: 42vw; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.selection-toolbar { top: 3rem; }.editor-status-bar span { min-width: auto; }.editor-status-bar .performance-status { margin-left: 0; }.source-options { grid-template-columns: 1fr; }.property-row--paired { grid-template-columns: 1fr 1fr; } }
</style>
