<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, toRaw, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import HomePage from '../guest/HomePage.vue'
import {
  useAdminEntityRegistry,
  type RuntimeAdminEntity,
  type RuntimeAdminProperty
} from '../../composables/useAdminEntityRegistry'
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
import { useEditorStore } from '../../stores/editor'
import { createEditorSnapshot } from '../../editor/editorSnapshot'
import {
  editorPublishErrors,
  editorPublishStatus,
  registerEditorPublish,
  resetEditorPublishFeedback
} from '../../composables/useEditorPublish'
import { invalidatePublishedRuntimeCache } from '../../runtime/publishedRuntime'
import { isPropertyEnabled, resolveProperties } from '../../editor/propertyRegistry'
import type {
  DraftMediaReference,
  EditorCommandType,
  EditorValue,
  EntityDescriptor,
  PropertyRegistryEntry,
  PropertyVisibilityContext
} from '../../types/editor'
import type { EditorSnapshot, SnapshotMediaModel } from '../../types/editorSnapshot'

interface EditorRuntimeEntity extends RuntimeAdminEntity {
  capabilities: string[]
  photoAreaId?: string
}

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

type LibraryRouteName = 'admin-drafts' | 'admin-favorites'

const site = useSiteStore()
const route = useRoute()
const router = useRouter()
const editor = useEditorStore()
const certificates = useCertificatesStore()
const runtimeEntities = useAdminEntityRegistry()
const photoRegistry = usePhotoAreaRegistry()
const photoAreas = photoRegistry.areas

const saveStatus = ref('')
const initializationError = ref('')
const editorReady = ref(false)
const showOpenModal = ref(false)
const showUnsavedModal = ref(false)
const pendingLibrary = ref<LibraryRouteName | null>(null)
const canvasScroll = ref<HTMLElement | null>(null)
const previewStage = ref<HTMLElement | null>(null)
const fitScale = ref(0.6)
const userZoom = ref<number | null>(null)
const previewHeight = ref(900)
const draftScope = ref(`editor-session-${crypto.randomUUID()}`)
const publishedBaseline = ref<EditorSnapshot | null>(null)
const mediaInputVersion = ref(0)
const mediaPreviewUrls = new Map<string, string>()
const managedMediaAreaIds = new Set<string>()
const styledPreviewElements = new Set<HTMLElement>()
const styleBaselines = new WeakMap<HTMLElement, Record<string, string>>()
let selectedPreviewElement: HTMLElement | null = null
let previewObserver: ResizeObserver | null = null
let unregisterSave: (() => void) | null = null
let unregisterPublish: (() => void) | null = null

const editorEntities = computed<EditorRuntimeEntity[]>(() => {
  const byId = new Map<string, EditorRuntimeEntity>()
  for (const entity of runtimeEntities.value) {
    const capabilities = new Set(entity.capabilities ?? entity.properties.map((property) => property.metadata.capability))
    const hasContent = entity.properties.some((property) => property.metadata.category === 'content' || property.metadata.capability === 'content')
    if (hasContent) {
      capabilities.add('content')
      capabilities.add('typography')
      capabilities.add('position')
      capabilities.add('rotate')
    }
    byId.set(entity.id, { ...entity, capabilities: [...capabilities] })
  }

  for (const area of photoAreas.value) {
    const existing = byId.get(area.id)
    const capabilities = new Set(existing?.capabilities ?? [])
    for (const capability of ['media', 'media-dimensions', 'media-outline', 'position', 'rotate']) capabilities.add(capability)
    byId.set(area.id, {
      id: area.id,
      section: area.section,
      label: area.label,
      kind: 'media',
      properties: existing?.properties ?? [],
      capabilities: [...capabilities],
      photoAreaId: area.id
    })
  }
  return [...byId.values()]
})

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
  get: () => editor.selectedEntityId,
  set: (entityId: string) => { selectEntity(entityId) }
})
const selectedEntity = computed(() => editorEntities.value.find((entity) => entity.id === editor.selectedEntityId))
const selectedPhotoArea = computed(() => selectedEntity.value?.photoAreaId ? photoRegistry.find(selectedEntity.value.photoAreaId) : undefined)
const previewScale = computed(() => userZoom.value ?? fitScale.value)
const sourceLabel = computed(() => editor.draftRevisionId
  ? `Editing: ${route.query.source === 'favorite' ? 'Favorite - ' : ''}Draft #${editor.draftRevisionNumber ?? '-'}`
  : 'Editing: New draft from Published')

const previewFrameStyle = computed(() => ({
  width: `${1440 * previewScale.value}px`,
  height: `${previewHeight.value * previewScale.value + 48}px`
}))

const previewStageStyle = computed(() => ({
  width: '1440px',
  transform: `scale(${previewScale.value})`
}))

function descriptorFor(entity: EditorRuntimeEntity): EntityDescriptor {
  return {
    entityId: entity.id,
    section: entity.section,
    label: entity.label,
    kind: entity.kind,
    capabilities: entity.capabilities,
    propertyValues: Object.fromEntries(entity.properties.map((property) => [property.metadata.propertyKey, property.read()]))
  }
}

const selectedDescriptor = computed(() => selectedEntity.value ? descriptorFor(selectedEntity.value) : null)
const mediaLibraryOptions = computed(() => site.current.mediaAssets
  .filter((asset) => Boolean(asset.id && asset.source))
  .map((asset) => ({ label: asset.alt.trim() || asset.id, value: asset.id })))

function resolveRuntimeMetadata(metadata: PropertyRegistryEntry): PropertyRegistryEntry {
  if (metadata.binding?.kind !== 'action' || metadata.binding.action !== 'choose-media') return metadata
  const hasMedia = mediaLibraryOptions.value.length > 0
  return {
    ...metadata,
    options: mediaLibraryOptions.value,
    enabledRule: ({ entity }) => entity.capabilities.includes('media') && hasMedia,
    helperText: hasMedia ? undefined : 'No repository media is available.'
  }
}

const registryPanelProperties = computed<PanelProperty[]>(() => {
  const descriptor = selectedDescriptor.value
  if (!descriptor) return []
  return resolveProperties(descriptor, editor.draftSnapshot).map((metadata) => {
    const resolved = resolveRuntimeMetadata(metadata)
    return { key: resolved.propertyKey, metadata: resolved }
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
      binding: { kind: 'runtime', path: runtimeProperty.path }
    }
  })))
const selectedPanelProperties = computed(() => [...runtimeContentProperties.value, ...registryPanelProperties.value]
  .sort((left, right) => (left.metadata.categoryOrder ?? 100) - (right.metadata.categoryOrder ?? 100) || left.metadata.order - right.metadata.order))
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

watch(() => editor.draftSnapshot, (snapshot) => {
  patchPreviewState(site.current.content, toRaw(snapshot.content))
  patchPreviewState(site.current.visual, toRaw(snapshot.visual))
  patchPreviewState(site.current.behavior, toRaw(snapshot.behavior))
  void nextTick(() => {
    decoratePreviewEntities()
    applyEditorPreviewStyles()
    void syncSnapshotMediaToPreview()
  })
}, { deep: true })

function patchPreviewState(target: unknown, source: unknown): void {
  if (Array.isArray(target) && Array.isArray(source)) {
    target.splice(0, target.length, ...structuredClone(source))
    return
  }
  if (!target || !source || typeof target !== 'object' || typeof source !== 'object') return
  const targetRecord = target as Record<string, unknown>
  const sourceRecord = source as Record<string, unknown>
  for (const key of Object.keys(targetRecord)) if (!(key in sourceRecord)) delete targetRecord[key]
  for (const [key, nextValue] of Object.entries(sourceRecord)) {
    const currentValue = targetRecord[key]
    if (Array.isArray(currentValue) && Array.isArray(nextValue)) patchPreviewState(currentValue, nextValue)
    else if (currentValue && nextValue && typeof currentValue === 'object' && typeof nextValue === 'object' && !Array.isArray(currentValue) && !Array.isArray(nextValue)) patchPreviewState(currentValue, nextValue)
    else targetRecord[key] = structuredClone(nextValue)
  }
}

watch(() => editor.draftSnapshot.certificateCards, (cards) => {
  if (cards.length) certificates.hydrateEditorCards(cards)
}, { deep: true })

watch(previewScale, (zoom) => {
  if (!editorReady.value) return
  editor.setViewport({ zoom, userZoom: userZoom.value })
  markSessionChanged()
})

watch(() => editor.selectedEntityId, () => void nextTick(updateSelectedOutline))

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
    publishedBaseline.value = structuredClone(publishedSnapshot)

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

    managedMediaAreaIds.clear()
    for (const assignment of editor.draftSnapshot.media.assignments) {
      if (photoRegistry.find(assignment.entityId)) managedMediaAreaIds.add(assignment.entityId)
    }
    if (editor.draftSnapshot.certificateCards.length) certificates.hydrateEditorCards(editor.draftSnapshot.certificateCards)
    restoreSelectionFromSession()
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

onMounted(() => { void initializeEditor() })

onBeforeUnmount(() => {
  previewObserver?.disconnect()
  unregisterSave?.()
  unregisterPublish?.()
  resetEditorPublishFeedback()
  restoreStyledPreviewElements()
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

function availableGroups(entity: EditorRuntimeEntity): string[] {
  const descriptor = descriptorFor(entity)
  const groups = resolveProperties(descriptor, editor.draftSnapshot).map((property) => property.category)
  if (entity.properties.some((property) => property.metadata.category === 'content' || property.metadata.capability === 'content')) groups.push('font')
  return [...new Set(groups)]
}

function defaultAccordion(entity: EditorRuntimeEntity): string {
  const groups = availableGroups(entity)
  if (entity.photoAreaId && groups.includes('media')) return 'media'
  if (groups.includes('font')) return 'font'
  return groups[0] ?? ''
}

function setSelection(entity: EditorRuntimeEntity, preferredAccordion?: string, markSession = true): void {
  const descriptor = descriptorFor(entity)
  if (markSession) editor.selectEntity(descriptor)
  else {
    editor.selectedEntityId = entity.id
    editor.selectedSection = entity.section
    editor.draftSnapshot.session.selectedEntityId = entity.id
    editor.draftSnapshot.session.selectedSection = entity.section
  }
  const groups = availableGroups(entity)
  const accordion = preferredAccordion && groups.includes(preferredAccordion) ? preferredAccordion : defaultAccordion(entity)
  if (markSession) editor.setAccordion(accordion)
  else {
    editor.activeAccordion = accordion
    editor.draftSnapshot.session.activeAccordion = accordion
  }
  if (markSession) markSessionChanged()
  void nextTick(() => {
    decoratePreviewEntities()
    updateSelectedOutline()
  })
}

function selectEntity(entityId: string, previewElement?: HTMLElement): void {
  const entity = editorEntities.value.find((candidate) => candidate.id === entityId)
  if (!entity) return
  selectedPreviewElement = previewElement ?? null
  setSelection(entity)
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

function readPath(root: unknown, path: string): EditorValue {
  return path.split('.').reduce<unknown>((value, key) => (value as Record<string, unknown> | undefined)?.[key], root) as EditorValue
}

function bindingPath(metadata: PropertyRegistryEntry, entityId: string): string {
  const binding = metadata.binding
  return binding?.kind === 'snapshot' ? binding.path.replaceAll('{entityId}', entityId) : metadata.propertyPath
}

function fallbackRuntimeValue(metadata: PropertyRegistryEntry): EditorValue {
  const property = selectedEntity.value?.properties.find((candidate) => candidate.path === metadata.propertyPath || candidate.key === metadata.propertyPath)
  return property?.read()
}

function readPanelValue(property: PanelProperty): string | number | boolean | null {
  if (property.runtimeProperty) return property.runtimeProperty.read()
  const metadata = property.metadata
  if (metadata.binding?.kind === 'action' && metadata.binding.action === 'choose-media') {
    const targetId = selectedPhotoArea.value?.id
    return targetId
      ? editor.draftSnapshot.media.assignments.find((assignment) => assignment.entityId === targetId)?.assetId ?? ''
      : ''
  }
  if (metadata.binding?.kind !== 'snapshot' || !selectedEntity.value) return primitiveValue(metadata.defaultValue)
  const value = readPath(editor.draftSnapshot, bindingPath(metadata, selectedEntity.value.id))
  return primitiveValue(value ?? fallbackRuntimeValue(metadata) ?? metadata.defaultValue)
}

function primitiveValue(value: EditorValue): string | number | boolean | null {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null ? value : ''
}

async function updatePanelProperty(property: PanelProperty, value: string | number | boolean): Promise<void> {
  const entity = selectedEntity.value
  if (!entity || !isPanelPropertyEnabled(property)) return
  if (property.metadata.binding?.kind === 'action' && property.metadata.binding.action === 'choose-media') {
    await chooseExistingMedia(String(value), property.metadata.commandType)
    return
  }
  if (property.runtimeProperty) {
    await writeRuntimeProperty(entity, property.runtimeProperty, value)
    return
  }
  if (property.metadata.binding?.kind !== 'snapshot') return
  const path = bindingPath(property.metadata, entity.id)
  editor.setProperty(entity.id, path, value, property.metadata.commandType, { coalesceKey: `${entity.id}:${path}` })
  markEditorChanged()
  await nextTick()
  applyEditorPreviewStyles()
  updateSelectedOutline()
}

async function writeRuntimeProperty(entity: EditorRuntimeEntity, property: RuntimeAdminProperty, value: string | number | boolean): Promise<void> {
  const previousValue = property.read()
  if (Object.is(previousValue, value)) return
  let path = property.target ? findObjectPath(site.current as unknown as Record<string, unknown>, property.target) : null
  if (!path) {
    const certificateIndex = editor.draftSnapshot.certificateCards.findIndex((card) => card.id === entity.id)
    if (certificateIndex >= 0) path = `certificateCards.${certificateIndex}`
  }
  if (!path) throw new Error(`Snapshot binding was not found for ${entity.id}.${property.path}.`)
  await property.write(value)
  const snapshotPath = `${path}.${property.path}`
  editor.setProperty(entity.id, snapshotPath, value, property.metadata.commandType, { coalesceKey: `${entity.id}:${snapshotPath}` })
  markEditorChanged()
}

function isPanelPropertyEnabled(property: PanelProperty): boolean {
  const descriptor = selectedDescriptor.value
  if (!descriptor) return false
  const context: PropertyVisibilityContext = {
    entity: descriptor,
    snapshot: editor.draftSnapshot,
    values: selectedPropertyValues.value
  }
  return isPropertyEnabled(property.metadata, context)
}

async function handlePropertyFile(property: PanelProperty, file: File): Promise<void> {
  const action = property.metadata.binding?.kind === 'action' ? property.metadata.binding.action : undefined
  if (action !== 'upload-media' && action !== 'replace-media') return
  await uploadSelectedMedia(file, property.metadata.commandType)
}

function handlePropertyAction(_property: PanelProperty): void {}

async function chooseExistingMedia(assetId: string, commandType: EditorCommandType): Promise<void> {
  const entity = selectedEntity.value
  const target = selectedPhotoArea.value
  const asset = site.current.mediaAssets.find((candidate) => candidate.id === assetId)
  if (!entity?.photoAreaId || !target || !asset?.source) return

  const currentMedia = structuredClone(toRaw(editor.draftSnapshot.media))
  const currentAssignment = currentMedia.assignments.find((assignment) => assignment.entityId === target.id)
  const currentReference = currentMedia.references.find((reference) => reference.assetId === asset.id)
  if (currentAssignment?.assetId === asset.id && currentReference?.uri === asset.source) return

  const nextMedia: SnapshotMediaModel = {
    ...currentMedia,
    references: [
      ...currentMedia.references.filter((reference) => reference.assetId !== asset.id),
      { assetId: asset.id, uri: asset.source, mimeType: asset.mimeType, alt: asset.alt }
    ],
    assignments: [
      ...currentMedia.assignments.filter((assignment) => assignment.entityId !== target.id),
      { entityId: target.id, role: target.role, assetId: asset.id, objectPosition: target.objectPosition }
    ]
  }
  editor.apply({
    type: commandType,
    entityId: entity.id,
    propertyPath: 'media',
    previousValue: currentMedia as unknown as EditorValue,
    nextValue: nextMedia as unknown as EditorValue,
    timestamp: Date.now(),
    metadata: { assetId: asset.id, photoAreaId: target.id, source: 'media-library' }
  })
  if (isBrowserUrl(asset.source)) mediaPreviewUrls.set(asset.id, asset.source)
  managedMediaAreaIds.add(target.id)
  await photoRegistry.updateSource(target.id, asset.source)
  markEditorChanged()
  saveStatus.value = 'Existing media selected. Save Draft to persist its reference.'
  await nextTick()
  updateSelectedOutline()
}

async function uploadSelectedMedia(file: File, commandType: EditorCommandType): Promise<void> {
  const entity = selectedEntity.value
  const target = selectedPhotoArea.value
  if (!entity?.photoAreaId || !target) return
  saveStatus.value = 'Uploading image...'
  try {
    const uploaded = await editorDraftRepository.uploadDraftMedia(file, draftScope.value)
    const currentMedia = structuredClone(toRaw(editor.draftSnapshot.media))
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
      selectedEntityId: editor.selectedEntityId,
      selectedSection: editor.selectedSection,
      activeAccordion: editor.activeAccordion,
      previewScrollTop: canvasScroll.value?.scrollTop ?? 0,
      previewScrollLeft: canvasScroll.value?.scrollLeft ?? 0,
      zoom: previewScale.value,
      userZoom: userZoom.value
    })
    const result = await editorDraftRepository.saveDraft({
      snapshot: structuredClone(toRaw(editor.draftSnapshot)),
      mediaReferences: structuredClone(toRaw(editor.draftMediaReferences)),
      expectedBaseRevision: editor.baseRevisionNumber,
      expectedDraftLockVersion: editor.draftLockVersion,
      draftRevisionId: editor.draftRevisionId,
      createNew: !editor.draftRevisionId
    })
    editor.draftSnapshot = structuredClone(result.revision.snapshot)
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
    publishedBaseline.value = structuredClone(snapshot)
    editor.initialize(snapshot, {
      publishedRevisionNumber: published?.revision.revision_number ?? null,
      baseRevisionNumber: published?.revision.revision_number ?? null
    })
    editor.draftMediaReferences = []
    mediaPreviewUrls.clear()
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
  userZoom.value = value === 'fit' ? null : Number(value)
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
  const target = (event.target as HTMLElement).closest<HTMLElement>('[data-editor-entity-id]')
  const entityId = target?.dataset.editorEntityId
  if (!entityId || !target) return
  selectEntity(entityId, target)
}

function decoratePreviewEntities(): void {
  const selector = '[data-media-usage-id], [data-photo-area-id], [data-certificate-id], [data-entity-id]'
  previewStage.value?.querySelectorAll<HTMLElement>(selector).forEach((element) => {
    const entityId = element.dataset.mediaUsageId
      ?? element.dataset.photoAreaId
      ?? element.dataset.certificateId
      ?? element.dataset.entityId
    if (entityId && editorEntities.value.some((entity) => entity.id === entityId)) element.dataset.editorEntityId = entityId
  })
  updateSelectedOutline()
}

function preferredPreviewElement(entityId: string): HTMLElement | null {
  const matches = [...(previewStage.value?.querySelectorAll<HTMLElement>('[data-editor-entity-id]') ?? [])]
    .filter((element) => element.dataset.editorEntityId === entityId)
  if (!matches.length) return null
  return matches.sort((left, right) => {
    const leftRect = left.getBoundingClientRect()
    const rightRect = right.getBoundingClientRect()
    return (leftRect.width * leftRect.height || Number.MAX_SAFE_INTEGER) - (rightRect.width * rightRect.height || Number.MAX_SAFE_INTEGER)
  })[0] ?? null
}

function updateSelectedOutline(): void {
  previewStage.value?.querySelectorAll<HTMLElement>('.editor-preview-selected').forEach((element) => element.classList.remove('editor-preview-selected'))
  const selected = selectedPreviewElement?.isConnected && selectedPreviewElement.dataset.editorEntityId === editor.selectedEntityId
    ? selectedPreviewElement
    : preferredPreviewElement(editor.selectedEntityId)
  selected?.classList.add('editor-preview-selected')
  selectedPreviewElement = selected ?? null
}

function baselineFor(element: HTMLElement): Record<string, string> {
  const existing = styleBaselines.get(element)
  if (existing) return existing
  const fields = ['font-family', 'font-size', 'letter-spacing', 'color', 'text-shadow', 'translate', 'rotate', 'width', 'height', 'outline', '--editor-hover-color']
  const baseline = Object.fromEntries(fields.map((field) => [field, element.style.getPropertyValue(field)]))
  styleBaselines.set(element, baseline)
  return baseline
}

function restoreStyledPreviewElements(): void {
  for (const element of styledPreviewElements) {
    const baseline = styleBaselines.get(element)
    if (!baseline) continue
    for (const [field, value] of Object.entries(baseline)) {
      if (value) element.style.setProperty(field, value)
      else element.style.removeProperty(field)
    }
    element.classList.remove('editor-has-hover-color')
  }
  styledPreviewElements.clear()
}

function cssLength(value: number | string | undefined): string {
  if (typeof value === 'number') return `${value}px`
  return value ?? ''
}

function cssRotation(value: number | string | undefined): string {
  if (typeof value === 'number') return `${value}deg`
  if (!value) return ''
  return /[a-z%]/i.test(value) ? value : `${value}deg`
}

function applyEditorPreviewStyles(): void {
  restoreStyledPreviewElements()
  for (const entity of editorEntities.value) {
    const element = preferredPreviewElement(entity.id)
    if (!element) continue
    const typography = editor.draftSnapshot.typography[entity.id]
    const layout = editor.draftSnapshot.layout[entity.id]
    const mediaStyle = editor.draftSnapshot.media.styles[entity.id]
    if (!typography && !layout && !mediaStyle) continue
    baselineFor(element)
    styledPreviewElements.add(element)
    if (typography?.fontFamily) element.style.setProperty('font-family', typography.fontFamily)
    if (typography?.fontSize) element.style.setProperty('font-size', typography.fontSize)
    if (typography?.letterSpacing) element.style.setProperty('letter-spacing', typography.letterSpacing)
    if (typography?.color) element.style.setProperty('color', typography.color)
    if (typography?.textShadow) element.style.setProperty('text-shadow', typography.textShadow)
    if (typography?.hoverColor) {
      element.style.setProperty('--editor-hover-color', typography.hoverColor)
      element.classList.add('editor-has-hover-color')
    }
    if (layout) {
      const x = cssLength(layout.x)
      const y = cssLength(layout.y)
      if (x || y) element.style.setProperty('translate', `${x || '0px'} ${y || '0px'}`)
      const rotation = cssRotation(layout.rotation)
      if (rotation) element.style.setProperty('rotate', rotation)
      if (layout.width !== undefined && layout.width !== '') element.style.setProperty('width', cssLength(layout.width))
      if (layout.height !== undefined && layout.height !== '') element.style.setProperty('height', cssLength(layout.height))
    }
    if (mediaStyle?.outlineEnabled) element.style.setProperty('outline', `${mediaStyle.outlineWidth ?? 1}px solid currentColor`)
  }
  updateSelectedOutline()
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
    <aside class="control-panel" aria-label="Editor property panel">
      <div class="panel-heading">
        <div>
          <h1>Edit</h1>
          <span class="panel-hint">Visual Property Editor</span>
        </div>
        <span v-if="selectedEntity" class="selected-kind">{{ selectedEntity.kind }}</span>
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
      </p>

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
          <div v-show="group.presentation === 'inline' || editor.activeAccordion === group.key" class="accordion-content">
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
                :class="{ 'property-field--disabled': !isPanelPropertyEnabled(property) }"
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
              </label>
            </div>
          </div>
        </div>
        <p v-if="!selectedPanelGroups.length" class="empty-properties">No registered properties are available for this entity.</p>
      </section>

      <button type="button" class="discard-draft-button" :disabled="editor.isSavingDraft" @click="discardDraft">Discard Draft</button>
      <p class="save-status" aria-live="polite">{{ saveStatus }}</p>
    </aside>

    <main class="canvas-container" aria-label="Live editor preview">
      <div class="preview-toolbar">
        <span class="source-indicator">{{ sourceLabel }}</span>
        <label class="zoom-control">
          <span>Zoom</span>
          <select :value="userZoom === null ? 'fit' : String(userZoom)" @change="setPreviewZoom">
            <option value="fit">Fit</option>
            <option value="0.5">50%</option>
            <option value="0.6">60%</option>
            <option value="0.75">75%</option>
            <option value="1">100%</option>
          </select>
        </label>
        <button type="button" class="open-source-button" aria-label="Open draft or favorite" @click="showOpenModal = true">+</button>
      </div>
      <div v-if="initializationError" class="editor-recovery" role="alert">
        <p>{{ saveStatus }}</p>
        <small>{{ initializationError }}</small>
        <button type="button" @click="void initializeEditor()">Retry</button>
      </div>
      <div class="canvas-label">LIVE EDITOR PREVIEW</div>
      <div ref="canvasScroll" class="canvas-scroll" @scroll="persistPreviewScroll">
        <div class="preview-frame" :style="previewFrameStyle">
          <div ref="previewStage" class="preview-stage" :style="previewStageStyle">
            <div class="editor-preview-runtime" data-editor-mode="true" @click.capture="selectPreviewEntity">
              <HomePage editor-preview />
            </div>
          </div>
        </div>
      </div>
    </main>

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
.edit-page { display: grid; grid-template-columns: clamp(320px, 25vw, 380px) minmax(0, 1fr); height: 100%; min-height: 0; overflow: hidden; background: #f6f4e8; color: #49362f; }
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
.selection-summary { margin: .9rem 0 0; padding: .65rem .75rem; border-radius: 10px; background: rgba(255,245,235,.8); color: #7b5f3b; font-size: .72rem; }
.property-group { margin-top: 1.1rem; border: 1px solid rgba(73,54,47,.13); border-radius: 13px; overflow: hidden; background: rgba(255,255,255,.35); }
.property-group--inline { border: 0; border-radius: 0; overflow: visible; background: transparent; }
.property-group--inline .accordion-content { padding: 0; }
.accordion-toggle { width: 100%; display: flex; justify-content: space-between; align-items: center; border: 0; padding: .85rem .9rem; background: #fff8ef; color: #5a3e35; font: inherit; font-size: .78rem; font-weight: 800; letter-spacing: .1em; text-align: left; cursor: pointer; }
.accordion-content { display: grid; gap: .15rem; padding: 0 .85rem .85rem; }
.property-row { display: grid; gap: .7rem; }
.property-row--paired { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.property-field--disabled { opacity: .48; filter: grayscale(.2); }
.empty-properties { color: #8c7568; font-size: .75rem; }
.discard-draft-button { width: 100%; margin-top: 1.25rem; border: 1px solid #d9b6b6; border-radius: 10px; padding: .7rem; background: #fffaf4; color: #8d363a; font-weight: 700; cursor: pointer; }
.save-status { min-height: 1.2em; color: #7b5f3b; font-size: .75rem; }
.canvas-container { min-width: 0; min-height: 0; position: relative; overflow: hidden; background: #ddd6c9; }
.preview-toolbar { position: absolute; z-index: 1001; top: .65rem; left: .75rem; display: flex; align-items: center; gap: .55rem; }
.source-indicator, .zoom-control { padding: .35rem .6rem; border: 1px solid rgba(232,222,208,.9); border-radius: 999px; background: rgba(255,255,255,.92); color: #5a3e35; font-size: .68rem; font-weight: 700; }
.zoom-control { display: flex; align-items: center; gap: .35rem; }
.zoom-control select { border: 0; background: transparent; color: inherit; font: inherit; }
.open-source-button { width: 2rem; height: 2rem; border: 1px solid #e8ded0; border-radius: 50%; background: #fff5eb; color: #8d363a; font-size: 1.4rem; line-height: 1; cursor: pointer; }
.editor-recovery { position: absolute; z-index: 1002; inset: 4rem auto auto 50%; transform: translateX(-50%); width: min(90%,440px); padding: 1rem; border: 1px solid #d99898; border-radius: 16px; background: #fffaf4; color: #8d363a; box-shadow: 0 1rem 2rem rgba(73,54,47,.15); }
.editor-recovery p { margin: 0 0 .35rem; }.editor-recovery small { display: block; margin-bottom: .75rem; }.editor-recovery button { border: 1px solid #e8ded0; border-radius: 10px; padding: .6rem 1rem; background: #fff5eb; color: #5a3e35; cursor: pointer; }
.canvas-label { position: absolute; z-index: 1000; top: .75rem; right: 1rem; padding: .35rem .55rem; border-radius: 999px; background: rgba(35,28,25,.78); color: #fff; font: 600 .68rem/1 system-ui; letter-spacing: .08em; }
.canvas-scroll { width: 100%; height: 100%; min-width: 0; min-height: 0; overflow: auto; overscroll-behavior: contain; touch-action: pan-x pan-y; background: #fff; scrollbar-gutter: stable; }
.preview-frame { position: relative; margin: 1.5rem auto 7rem; background: #fff; box-shadow: 0 1rem 2rem rgba(73,54,47,.12); }
.preview-stage { transform-origin: top left; }
.editor-preview-runtime :deep([data-editor-entity-id]) { cursor: pointer; outline-offset: 3px; border-radius: 4px; }
.editor-preview-runtime :deep([data-editor-entity-id]:hover) { outline: 1px dashed rgba(184,91,105,.55); background: transparent; }
.editor-preview-runtime :deep(.editor-preview-selected) { outline: 3px solid rgba(184,91,105,.95) !important; outline-offset: 4px !important; border-radius: 7px; background: transparent !important; }
.editor-preview-runtime :deep(.editor-has-hover-color:hover) { color: var(--editor-hover-color) !important; }
.modal-backdrop { position: fixed; z-index: 2000; inset: 0; display: grid; place-items: center; padding: 1rem; background: rgba(73,54,47,.35); }
.source-modal { position: relative; width: min(100%,620px); padding: 2rem; border-radius: 24px; background: #f6f4e8; color: #49362f; box-shadow: 0 1.5rem 4rem rgba(73,54,47,.25); }
.source-modal h2 { margin: 0; color: #5a3e35; }.source-modal p { color: #7b5f3b; }.modal-close { position: absolute; top: 1rem; right: 1rem; border: 0; background: transparent; font-size: 1.25rem; color: #7b5f3b; cursor: pointer; }
.source-options { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }.source-options button { display: grid; gap: .55rem; min-height: 140px; border: 1px solid #e8ded0; border-radius: 16px; padding: 1.2rem; background: #fff5eb; color: #5a3e35; text-align: left; cursor: pointer; }.source-options span { color: #7b5f3b; font-size: .85rem; font-weight: 400; }
.unsaved-actions { display: grid; gap: .65rem; }.unsaved-actions button { border: 1px solid #e8ded0; border-radius: 11px; padding: .75rem 1rem; background: #fffaf4; color: #5a3e35; cursor: pointer; font-weight: 700; }.unsaved-actions .primary-action { background: #8d363a; color: #fff; }
@media (max-width: 900px) { .edit-page { grid-template-columns: minmax(300px, 38vw) minmax(0, 1fr); }.control-panel { padding-left: 1rem; padding-right: 1rem; } }
@media (max-width: 700px) { .edit-page { display: flex; flex-direction: column; height: 100%; }.control-panel { flex: 0 0 52%; max-height: 52%; border-right: 0; border-bottom: 1px solid rgba(73,54,47,.16); }.canvas-container { flex: 1 1 48%; min-height: 0; }.canvas-label { display: none; }.source-options { grid-template-columns: 1fr; }.property-row--paired { grid-template-columns: 1fr 1fr; } }
</style>
