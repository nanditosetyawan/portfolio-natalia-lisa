<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, toRaw } from 'vue'
import HomePage from '../guest/HomePage.vue'
import { useAdminEntityRegistry, type RuntimeAdminProperty } from '../../composables/useAdminEntityRegistry'
import { usePhotoAreaRegistry } from '../../composables/usePhotoAreaRegistry'
import { useCertificatesStore } from '../../stores/certificates'
import { useSiteStore } from '../../stores/site'
import { uploadPortfolioMedia } from '../../repositories/mediaRepository'
import { editorHasChanges, editorSaveStatus, markEditorChanged, registerEditorSave } from '../../composables/useEditorSession'
import PropertyControl from './components/PropertyControl.vue'
import { useEditorStore } from '../../stores/editor'
import { createEditorSnapshot } from '../../editor/editorSnapshot'
import { isPropertyEnabled } from '../../editor/propertyRegistry'
import type { PropertyVisibilityContext } from '../../types/editor'

const site = useSiteStore()
const editor = useEditorStore()
const certificates = useCertificatesStore()
const entities = useAdminEntityRegistry()
const photoRegistry = usePhotoAreaRegistry()
const photoAreas = photoRegistry.areas

const sections = computed(() => [...new Set(entities.value.map((entity) => entity.section))])
const selectedSection = ref('Portfolio')
const sectionEntities = computed(() => entities.value.filter((entity) => entity.section === selectedSection.value))
const selectedEntityId = ref('portfolio-hero')
const selectedEntity = computed(() => sectionEntities.value.find((entity) => entity.id === selectedEntityId.value) ?? sectionEntities.value[0])
const selectedPropertyGroups = computed(() => [...new Set(selectedEntity.value?.properties.map((property) => property.metadata.category) ?? [])])
const selectedPropertyValues = computed(() => Object.fromEntries((selectedEntity.value?.properties ?? []).map((property) => [property.metadata.propertyKey, property.read()])))
const selectedPhotoAreaId = ref('about-frame-back-2')
const selectedPhotoArea = computed(() => photoRegistry.find(selectedPhotoAreaId.value))
const saveStatus = ref('')
const canvasScroll = ref<HTMLElement | null>(null)
const previewStage = ref<HTMLElement | null>(null)
const previewScale = ref(0.6)
const previewHeight = ref(900)
const previewSelectedEntityId = ref('')
let previewObserver: ResizeObserver | null = null
let unregisterSave: (() => void) | null = null

const previewFrameStyle = computed(() => ({
  width: `${1440 * previewScale.value}px`,
  height: `${previewHeight.value * previewScale.value + 48}px`
}))

const previewStageStyle = computed(() => ({
  width: '1440px',
  transform: `scale(${previewScale.value})`
}))

watch(selectedSection, () => { selectedEntityId.value = sectionEntities.value[0]?.id ?? '' })
watch(selectedEntity, (entity) => {
  if (!entity) return
  editor.selectEntity({ entityId: entity.id, section: entity.section, label: entity.label, kind: entity.kind, capabilities: entity.properties.map((property) => property.metadata.capability), propertyValues: Object.fromEntries(entity.properties.map((property) => [property.metadata.propertyKey, property.read()])) })
  if (!editor.activeAccordion) editor.setAccordion(entity.properties[0]?.metadata.category ?? '')
})
watch(() => editor.draftSnapshot, (snapshot) => {
  site.current = {
    ...site.current,
    content: structuredClone(snapshot.content),
    visual: structuredClone(snapshot.visual),
    behavior: structuredClone(snapshot.behavior)
  }
}, { deep: true })
watch(() => photoAreas.value.map((area) => area.id).join('|'), () => {
  if (!photoRegistry.find(selectedPhotoAreaId.value)) selectedPhotoAreaId.value = photoRegistry.areas.value[0]?.id ?? ''
})

onMounted(() => {
  certificates.loadInitial()
  editor.initialize(createEditorSnapshot(site.current))
  editor.activeAccordion = selectedPropertyGroups.value[0] ?? ''
  editorHasChanges.value = false
  editorSaveStatus.value = ''
  unregisterSave = registerEditorSave(saveDraft)
  previewObserver = new ResizeObserver(updatePreviewMetrics)
  if (canvasScroll.value) previewObserver.observe(canvasScroll.value)
  if (previewStage.value) previewObserver.observe(previewStage.value)
  nextTick(() => { updatePreviewMetrics(); decoratePreviewEntities() })
})

onBeforeUnmount(() => {
  previewObserver?.disconnect()
  unregisterSave?.()
})

async function writeProperty(property: RuntimeAdminProperty, value: string | number | boolean) {
  const previousValue = property.read()
  await property.write(value)
  const path = property.target ? findObjectPath(site.current as unknown as Record<string, unknown>, property.target) : null
  if (path && !Object.is(previousValue, value)) {
    editor.apply({ type: 'SET_PROPERTY', entityId: selectedEntityId.value, propertyPath: `${path}.${property.path}`, previousValue, nextValue: value, timestamp: Date.now() })
  }
  markEditorChanged()
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

async function uploadPhoto(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  const target = selectedPhotoAreaId.value ? photoRegistry.find(selectedPhotoAreaId.value) : undefined
  if (!file || !target) return
  saveStatus.value = 'Uploading image…'
  try {
    const uploaded = await uploadPortfolioMedia({ file, entityType: target.ownerType, entityId: target.ownerId, mediaId: target.id })
    const updated = await photoRegistry.updateSource(target.id, uploaded.publicUrl)
    if (!updated) throw new Error('Media target could not be updated')
    markEditorChanged()
    saveStatus.value = 'Image uploaded. Save draft to persist the media relation.'
  } catch (error) {
    saveStatus.value = error instanceof Error ? error.message : 'Image upload failed.'
  } finally {
    input.value = ''
  }
}

async function updateObjectPosition(value: string) {
  await photoRegistry.updateObjectPosition(selectedPhotoAreaId.value, value)
  markEditorChanged()
}

async function removePhoto() {
  await photoRegistry.updateSource(selectedPhotoAreaId.value, '')
  markEditorChanged()
}

async function saveDraft() {
  try {
    await site.saveDraft()
    saveStatus.value = 'Saved'
  } catch (error) {
    saveStatus.value = error instanceof Error ? error.message : 'Draft save failed.'
  }
}

function updatePreviewMetrics() {
  const viewportWidth = canvasScroll.value?.clientWidth ?? 900
  previewScale.value = Math.min(1, Math.max(.34, (viewportWidth - 48) / 1440))
  nextTick(() => {
    previewHeight.value = previewStage.value?.scrollHeight ?? previewHeight.value
  })
}

function selectPreviewEntity(event: MouseEvent) {
  const target = (event.target as HTMLElement).closest<HTMLElement>('[data-editor-entity-id], [data-entity-id], [data-certificate-id]')
  const entityId = target?.dataset.editorEntityId ?? target?.dataset.entityId ?? target?.dataset.certificateId
  if (!entityId) return
  previewSelectedEntityId.value = entityId
  previewStage.value?.querySelectorAll('.editor-preview-selected').forEach((element) => element.classList.remove('editor-preview-selected'))
  target?.classList.add('editor-preview-selected')
  const entity = entities.value.find((candidate) => candidate.id === previewSelectedEntityId.value)
  if (entity) {
    selectedEntityId.value = entity.id
    selectedSection.value = entity.section
    editor.selectEntity({ entityId: entity.id, section: entity.section, label: entity.label, kind: entity.kind, capabilities: entity.properties.map((property) => property.metadata.capability), propertyValues: Object.fromEntries(entity.properties.map((property) => [property.metadata.propertyKey, property.read()])) })
    editor.setAccordion(entity.properties[0]?.metadata.category ?? '')
  }
}

function decoratePreviewEntities(): void {
  previewStage.value?.querySelectorAll<HTMLElement>('[data-entity-id], [data-certificate-id]').forEach((element) => {
    const entityId = element.dataset.entityId ?? element.dataset.certificateId
    if (entityId) element.dataset.editorEntityId = entityId
  })
}

function isEnabled(property: RuntimeAdminProperty): boolean {
  const entity = selectedEntity.value
  if (!entity) return true
  const context: PropertyVisibilityContext = {
    entity: { entityId: entity.id, section: entity.section, label: entity.label, kind: entity.kind, capabilities: entity.properties.map((candidate) => candidate.metadata.capability), propertyValues: selectedPropertyValues.value },
    snapshot: editor.draftSnapshot,
    values: selectedPropertyValues.value
  }
  return isPropertyEnabled(property.metadata, context)
}

function toggleAccordion(category: string): void {
  editor.setAccordion(editor.activeAccordion === category ? '' : category)
}
</script>

<template>
  <div class="edit-page">
    <aside class="control-panel" aria-label="Canonical entity property editor">
      <div class="panel-heading">
        <h1>Edit</h1>
        <span class="panel-hint">Property panel</span>
      </div>

      <label class="field-label" for="section-select">Section</label>
      <select id="section-select" v-model="selectedSection" class="input-field">
        <option v-for="section in sections" :key="section" :value="section">{{ section }}</option>
      </select>

      <label class="field-label" for="entity-select">Entity / element</label>
      <select id="entity-select" v-model="selectedEntityId" class="input-field" data-admin-entity-select>
        <option v-for="entity in sectionEntities" :key="entity.id" :value="entity.id">{{ entity.label }} — {{ entity.id }}</option>
      </select>

      <section v-if="selectedEntity" class="property-editor" :data-selected-entity-id="selectedEntity.id">
        <div v-for="group in selectedPropertyGroups" :key="group" class="property-group" :data-property-category="group">
          <button type="button" class="accordion-toggle" :aria-expanded="editor.activeAccordion === group || !editor.activeAccordion" @click="toggleAccordion(group)">
            <span>{{ group }}</span>
            <span aria-hidden="true">{{ editor.activeAccordion === group || !editor.activeAccordion ? '−' : '+' }}</span>
          </button>
          <div v-show="editor.activeAccordion === group || !editor.activeAccordion" class="accordion-content">
          <label v-for="property in selectedEntity.properties.filter((candidate) => candidate.metadata.category === group)" :key="property.key" class="property-field" :class="{ 'property-field--disabled': !isEnabled(property) }">
            <span>{{ property.label }}</span>
            <PropertyControl
              :property="property.metadata"
              :value="property.read()"
              :disabled="!isEnabled(property)"
              :data-property-key="property.key"
              @change="writeProperty(property, $event)"
            />
          </label>
          </div>
        </div>
      </section>

      <section class="property-group media-editor">
        <h2>Media</h2>
        <label class="property-field">
          <span>Photo area</span>
          <select v-model="selectedPhotoAreaId" data-photo-area-select>
            <option v-for="area in photoAreas" :key="area.id" :value="area.id">
              {{ area.section }} — {{ area.label }} — {{ area.id }}
            </option>
          </select>
        </label>
        <label class="property-field">
          <span>Image</span>
          <input :key="selectedPhotoAreaId" type="file" accept="image/*" :data-photo-area-id="selectedPhotoAreaId" @change="uploadPhoto" />
        </label>
        <label v-if="selectedPhotoArea" class="property-field">
          <span>Object position</span>
          <input :value="selectedPhotoArea.objectPosition" data-media-object-position @input="updateObjectPosition(($event.target as HTMLInputElement).value)" />
        </label>
        <button type="button" :disabled="!selectedPhotoArea?.source" @click="removePhoto">Remove image</button>
        <small v-if="selectedPhotoArea">Owner: {{ selectedPhotoArea.ownerType }} / {{ selectedPhotoArea.ownerId }} · {{ selectedPhotoArea.persistence }}</small>
      </section>
      <p class="save-status" aria-live="polite">{{ saveStatus }}</p>
    </aside>

    <main class="canvas-container" aria-label="Live Guest preview">
      <div class="canvas-label">LIVE CANONICAL RUNTIME PREVIEW</div>
      <div ref="canvasScroll" class="canvas-scroll">
        <div class="preview-frame" :style="previewFrameStyle">
          <div ref="previewStage" class="preview-stage" :style="previewStageStyle">
            <div class="editor-preview-runtime" data-editor-mode="true" @click.capture="selectPreviewEntity">
              <HomePage />
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.edit-page { display: grid; grid-template-columns: clamp(300px, 24vw, 360px) minmax(0, 1fr); height: 100%; min-height: 0; overflow: hidden; background: #f6f4e8; color: #49362f; }
.control-panel { min-width: 0; min-height: 0; overflow: auto; overscroll-behavior: contain; touch-action: pan-x pan-y; padding: 1.5rem 1.25rem 6rem; border-right: 1px solid rgba(73,54,47,.16); scrollbar-gutter: stable; }
.panel-heading { display: flex; justify-content: space-between; align-items: center; gap: 1rem; padding-bottom: .9rem; border-bottom: 1px solid rgba(73,54,47,.13); }
.panel-heading h1 { margin: 0; font-size: 1.5rem; }
.panel-hint { color: #9a806f; font-size: .7rem; font-weight: 600; letter-spacing: .05em; text-transform: uppercase; }
.property-group button { border: 0; border-radius: 8px; padding: .65rem .8rem; background: #8d363a; color: #fff; cursor: pointer; }
.field-label, .property-field { display: grid; gap: .35rem; margin-top: 1rem; font-size: .78rem; font-weight: 700; }
.input-field, .property-field input:not([type='checkbox']), .property-field textarea, .property-field select { width: 100%; border: 1px solid rgba(73,54,47,.22); border-radius: 7px; padding: .6rem; background: #fffdf4; color: inherit; box-sizing: border-box; }
.property-field textarea { min-height: 84px; resize: vertical; }
.property-group { margin-top: 1.35rem; padding-top: 1rem; border-top: 1px solid rgba(73,54,47,.13); }
.property-group h2 { margin: 0; font-size: .82rem; letter-spacing: .08em; text-transform: uppercase; }
.accordion-toggle { width: 100%; display: flex; justify-content: space-between; align-items: center; border: 0; padding: 0; background: transparent; color: inherit; font: inherit; font-size: .82rem; font-weight: 700; letter-spacing: .08em; text-align: left; text-transform: uppercase; cursor: pointer; }
.accordion-content { display: grid; }
.property-field--disabled { opacity: .52; }
.property-field input[type='color'] { min-height: 40px; padding: .2rem; }
.media-editor small { display: block; margin-top: .75rem; overflow-wrap: anywhere; }
.save-status { min-height: 1.2em; color: #7b5f3b; font-size: .75rem; }
.canvas-container { min-width: 0; min-height: 0; position: relative; overflow: hidden; background: #ddd6c9; }
.canvas-label { position: absolute; z-index: 1000; top: .75rem; right: 1rem; padding: .35rem .55rem; border-radius: 999px; background: rgba(35,28,25,.78); color: #fff; font: 600 .68rem/1 system-ui; letter-spacing: .08em; }
.canvas-scroll { width: 100%; height: 100%; min-width: 0; min-height: 0; overflow: auto; overscroll-behavior: contain; touch-action: pan-x pan-y; background: #fff; scrollbar-gutter: stable; }
.preview-frame { position: relative; margin: 1.5rem auto 7rem; background: #fff; box-shadow: 0 1rem 2rem rgba(73,54,47,.12); }
.preview-stage { transform-origin: top left; }
.editor-preview-runtime [data-editor-entity-id] { cursor: pointer; }
.editor-preview-runtime .editor-preview-selected { outline: 3px solid rgba(184, 91, 105, .86); outline-offset: 4px; }
@media (max-width: 900px) {
  .edit-page { grid-template-columns: minmax(280px, 34vw) minmax(0, 1fr); }
  .control-panel { padding-left: 1rem; padding-right: 1rem; }
}
@media (max-width: 700px) {
  .edit-page { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
  .control-panel { flex: 0 0 52%; max-height: 52%; border-right: 0; border-bottom: 1px solid rgba(73,54,47,.16); }
  .canvas-container { flex: 1 1 48%; min-height: 0; }
  .canvas-label { top: .55rem; right: .6rem; font-size: .58rem; }
}
</style>
