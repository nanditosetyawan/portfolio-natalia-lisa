<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import HomePage from '../guest/HomePage.vue'
import { useAdminEntityRegistry, type RuntimeAdminProperty } from '../../composables/useAdminEntityRegistry'
import { usePhotoAreaRegistry } from '../../composables/usePhotoAreaRegistry'
import { useCertificatesStore } from '../../stores/certificates'
import { useSiteStore } from '../../stores/site'

const site = useSiteStore()
const certificates = useCertificatesStore()
const entities = useAdminEntityRegistry()
const photoRegistry = usePhotoAreaRegistry()
const photoAreas = photoRegistry.areas

const sections = computed(() => [...new Set(entities.value.map((entity) => entity.section))])
const selectedSection = ref('Portfolio')
const sectionEntities = computed(() => entities.value.filter((entity) => entity.section === selectedSection.value))
const selectedEntityId = ref('portfolio-hero')
const selectedEntity = computed(() => sectionEntities.value.find((entity) => entity.id === selectedEntityId.value) ?? sectionEntities.value[0])
const selectedPhotoAreaId = ref('about-frame-back-2')
const selectedPhotoArea = computed(() => photoRegistry.find(selectedPhotoAreaId.value))
const saveStatus = ref('')

watch(selectedSection, () => { selectedEntityId.value = sectionEntities.value[0]?.id ?? '' })
watch(() => photoAreas.value.map((area) => area.id).join('|'), () => {
  if (!photoRegistry.find(selectedPhotoAreaId.value)) selectedPhotoAreaId.value = photoRegistry.areas.value[0]?.id ?? ''
})

onMounted(() => certificates.loadInitial())

function inputValue(event: Event, property: RuntimeAdminProperty) {
  const input = event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
  if (property.control === 'checkbox') return (input as HTMLInputElement).checked
  if (property.control === 'number') return Number(input.value)
  return input.value
}

async function writeProperty(property: RuntimeAdminProperty, event: Event) {
  await property.write(inputValue(event, property))
}

function uploadPhoto(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || !selectedPhotoAreaId.value) return
  const reader = new FileReader()
  reader.addEventListener('load', async () => {
    if (typeof reader.result === 'string') await photoRegistry.updateSource(selectedPhotoAreaId.value, reader.result)
  }, { once: true })
  reader.readAsDataURL(file)
}

async function saveDraft() {
  await site.saveDraft()
  saveStatus.value = 'Draft runtime tersimpan melalui repository adapter.'
}
</script>

<template>
  <div class="edit-page">
    <aside class="control-panel" aria-label="Canonical entity property editor">
      <div class="panel-heading">
        <h1>Edit</h1>
        <button type="button" class="save-button" @click="saveDraft">Save draft</button>
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
        <div v-for="group in [...new Set(selectedEntity.properties.map((property) => property.group))]" :key="group" class="property-group">
          <h2>{{ group }}</h2>
          <label v-for="property in selectedEntity.properties.filter((candidate) => candidate.group === group)" :key="property.key" class="property-field">
            <span>{{ property.label }}</span>
            <textarea
              v-if="property.control === 'textarea'"
              :value="String(property.read())"
              :data-property-key="property.key"
              @input="writeProperty(property, $event)"
            />
            <input
              v-else-if="property.control === 'checkbox'"
              type="checkbox"
              :checked="Boolean(property.read())"
              :data-property-key="property.key"
              @change="writeProperty(property, $event)"
            />
            <input
              v-else
              :type="property.control === 'color' ? 'color' : property.control === 'number' ? 'number' : 'text'"
              :value="String(property.read())"
              :data-property-key="property.key"
              @input="writeProperty(property, $event)"
            />
          </label>
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
          <input :value="selectedPhotoArea.objectPosition" data-media-object-position @input="photoRegistry.updateObjectPosition(selectedPhotoAreaId, ($event.target as HTMLInputElement).value)" />
        </label>
        <button type="button" :disabled="!selectedPhotoArea?.source" @click="photoRegistry.updateSource(selectedPhotoAreaId, '')">Remove image</button>
        <small v-if="selectedPhotoArea">Owner: {{ selectedPhotoArea.ownerType }} / {{ selectedPhotoArea.ownerId }} · {{ selectedPhotoArea.persistence }}</small>
      </section>
      <p class="save-status" aria-live="polite">{{ saveStatus }}</p>
    </aside>

    <main class="canvas-container" aria-label="Live Guest preview">
      <div class="canvas-label">LIVE CANONICAL RUNTIME PREVIEW</div>
      <div class="canvas-scroll"><HomePage /></div>
    </main>
  </div>
</template>

<style scoped>
.edit-page { display: grid; grid-template-columns: minmax(300px, 360px) 1fr; height: calc(100vh - 72px); background: #f6f4e8; color: #49362f; }
.control-panel { overflow-y: auto; padding: 1.25rem; border-right: 1px solid rgba(73,54,47,.16); }
.panel-heading { display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
.panel-heading h1 { margin: 0; font-size: 1.5rem; }
.save-button, .property-group button { border: 0; border-radius: 8px; padding: .65rem .8rem; background: #8d363a; color: #fff; cursor: pointer; }
.field-label, .property-field { display: grid; gap: .35rem; margin-top: .9rem; font-size: .78rem; font-weight: 700; }
.input-field, .property-field input:not([type='checkbox']), .property-field textarea, .property-field select { width: 100%; border: 1px solid rgba(73,54,47,.22); border-radius: 7px; padding: .6rem; background: #fffdf4; color: inherit; box-sizing: border-box; }
.property-field textarea { min-height: 84px; resize: vertical; }
.property-group { margin-top: 1rem; padding-top: .75rem; border-top: 1px solid rgba(73,54,47,.13); }
.property-group h2 { margin: 0; font-size: .82rem; letter-spacing: .08em; text-transform: uppercase; }
.property-field input[type='color'] { min-height: 40px; padding: .2rem; }
.media-editor small { display: block; margin-top: .75rem; overflow-wrap: anywhere; }
.save-status { min-height: 1.2em; font-size: .75rem; }
.canvas-container { min-width: 0; position: relative; overflow: hidden; background: #ddd6c9; }
.canvas-label { position: absolute; z-index: 1000; top: .75rem; right: 1rem; padding: .35rem .55rem; border-radius: 999px; background: rgba(35,28,25,.78); color: #fff; font: 600 .68rem/1 system-ui; letter-spacing: .08em; }
.canvas-scroll { height: 100%; overflow: auto; background: #fff; }
@media (max-width: 900px) { .edit-page { grid-template-columns: 1fr; height: auto; } .control-panel { max-height: none; } .canvas-container { height: 75vh; } }
</style>
