<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { ChevronRight, Eye, EyeOff, GripVertical, Lock, Search, Unlock } from 'lucide-vue-next'
import type { EditorObject, EditorObjectSessionState } from '../../../types/editor'

const props = defineProps<{
  objects: EditorObject[]
  selectedObjectId: string
  selectedObjectIds: string[]
  search: string
  expandedLayers: string[]
  objectStates: Record<string, EditorObjectSessionState>
}>()

const emit = defineEmits<{
  select: [objectId: string, focusPreview: boolean, additive: boolean, range: boolean]
  search: [value: string]
  expand: [layerId: string, expanded: boolean]
  lock: [objectId: string, locked: boolean]
  hide: [objectId: string, hidden: boolean]
  reorder: [objectId: string, targetObjectId: string]
  rename: [objectId: string, name: string]
}>()

const root = ref<HTMLElement | null>(null)
const expanded = computed(() => new Set(props.expandedLayers))
const normalizedSearch = computed(() => props.search.trim().toLocaleLowerCase())
const selectedIds = computed(() => new Set(props.selectedObjectIds))
const editingObjectId = ref('')
const renameValue = ref('')
const dragObjectId = ref('')
const dragTargetId = ref('')
const filteredObjects = computed(() => normalizedSearch.value
  ? props.objects.filter((object) => [object.name, object.id, object.type].some((value) => value.toLocaleLowerCase().includes(normalizedSearch.value)))
  : props.objects)
const layers = computed(() => {
  const grouped = new Map<string, EditorObject[]>()
  for (const object of filteredObjects.value) grouped.set(object.section, [...(grouped.get(object.section) ?? []), object])
  return [...grouped.entries()].map(([section, objects]) => ({ id: `section:${section}`, section, objects }))
})

function stateFor(objectId: string): EditorObjectSessionState {
  return props.objectStates[objectId] ?? { locked: false, hidden: false }
}

function layerOpen(layerId: string): boolean {
  return Boolean(normalizedSearch.value) || expanded.value.has(layerId)
}

function updateSearch(event: Event): void {
  emit('search', (event.target as HTMLInputElement).value)
}

function selectObject(event: MouseEvent, objectId: string): void {
  emit('select', objectId, true, event.ctrlKey || event.metaKey, event.shiftKey)
}

function startRename(object: EditorObject): void {
  editingObjectId.value = object.id
  renameValue.value = object.name
  void nextTick(() => root.value?.querySelector<HTMLInputElement>(`[data-layer-rename-id="${CSS.escape(object.id)}"]`)?.select())
}

function commitRename(objectId: string): void {
  const value = renameValue.value.trim()
  if (value) emit('rename', objectId, value)
  editingObjectId.value = ''
}

function beginDrag(event: DragEvent, objectId: string): void {
  dragObjectId.value = objectId
  event.dataTransfer?.setData('text/editor-object-id', objectId)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

function hoverDropTarget(event: DragEvent, targetObjectId: string): void {
  if (!dragObjectId.value || dragObjectId.value === targetObjectId) return
  event.preventDefault()
  dragTargetId.value = targetObjectId
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
}

function dropObject(event: DragEvent, targetObjectId: string): void {
  event.preventDefault()
  const sourceId = dragObjectId.value || event.dataTransfer?.getData('text/editor-object-id') || ''
  if (sourceId && sourceId !== targetObjectId) emit('reorder', sourceId, targetObjectId)
  endDrag()
}

function endDrag(): void {
  dragObjectId.value = ''
  dragTargetId.value = ''
}

function keyboardReorder(object: EditorObject, direction: -1 | 1): void {
  const siblings = props.objects.filter((candidate) => candidate.section === object.section)
  const index = siblings.findIndex((candidate) => candidate.id === object.id)
  const target = siblings[index + direction]
  if (target) emit('reorder', object.id, target.id)
}

watch(() => props.selectedObjectId, async (objectId) => {
  const object = props.objects.find((candidate) => candidate.id === objectId)
  if (!object) return
  if (!expanded.value.has(object.parentLayerId)) emit('expand', object.parentLayerId, true)
  await nextTick()
  root.value?.querySelector<HTMLElement>(`[data-layer-object-id="${CSS.escape(objectId)}"]`)?.scrollIntoView({ block: 'nearest' })
}, { immediate: true })
</script>

<template>
  <aside ref="root" class="object-navigator" aria-label="Layers and object navigator">
    <header class="navigator-heading">
      <div>
        <span>Navigator</span>
        <h2>Layers</h2>
      </div>
      <span class="object-count">{{ objects.length }}</span>
    </header>

    <label class="object-search">
      <Search :size="15" aria-hidden="true" />
      <span class="sr-only">Search objects</span>
      <input :value="search" type="search" placeholder="Name, ID, or type" data-object-search @input="updateSearch" />
    </label>

    <div class="layer-tree" role="tree" aria-label="Editor object layers">
      <section v-for="layer in layers" :key="layer.id" class="layer-section">
        <button
          type="button"
          class="layer-heading"
          :aria-expanded="layerOpen(layer.id)"
          @click="emit('expand', layer.id, !layerOpen(layer.id))"
        >
          <ChevronRight :size="15" :class="{ rotated: layerOpen(layer.id) }" aria-hidden="true" />
          <span>{{ layer.section }}</span>
          <small>{{ layer.objects.length }}</small>
        </button>

        <div v-show="layerOpen(layer.id)" class="layer-objects" role="group">
          <article
            v-for="object in layer.objects"
            :key="object.id"
            class="layer-object"
            :class="{
              selected: selectedIds.has(object.id),
              primary: object.id === selectedObjectId,
              locked: stateFor(object.id).locked,
              hidden: stateFor(object.id).hidden,
              'drop-target': dragTargetId === object.id
            }"
            :data-layer-object-id="object.id"
            role="treeitem"
            :aria-selected="selectedIds.has(object.id)"
            @dragover="hoverDropTarget($event, object.id)"
            @drop="dropObject($event, object.id)"
          >
            <button
              class="layer-drag-handle"
              type="button"
              draggable="true"
              :aria-label="`Reorder ${object.name}. Use Alt plus arrow keys for keyboard reordering.`"
              @dragstart="beginDrag($event, object.id)"
              @dragend="endDrag"
              @keydown.alt.up.prevent="keyboardReorder(object, -1)"
              @keydown.alt.down.prevent="keyboardReorder(object, 1)"
            ><GripVertical :size="13" /></button>
            <button v-if="editingObjectId !== object.id" class="object-select" type="button" @click="selectObject($event, object.id)" @dblclick.stop="startRename(object)">
              <span class="object-type-mark" aria-hidden="true">{{ object.type.slice(0, 1) }}</span>
              <span class="object-copy">
                <strong>{{ object.name }}</strong>
                <small>{{ object.type }} · {{ object.id }}</small>
              </span>
            </button>
            <input
              v-else
              v-model="renameValue"
              class="layer-rename-input"
              :data-layer-rename-id="object.id"
              :aria-label="`Rename ${object.name}`"
              @keydown.enter.prevent="commitRename(object.id)"
              @keydown.esc.prevent="editingObjectId = ''"
              @blur="commitRename(object.id)"
            />
            <button
              type="button"
              class="object-state-button"
              :aria-label="stateFor(object.id).locked ? `Unlock ${object.name}` : `Lock ${object.name}`"
              :aria-pressed="stateFor(object.id).locked"
              @click="emit('lock', object.id, !stateFor(object.id).locked)"
            >
              <Lock v-if="stateFor(object.id).locked" :size="14" />
              <Unlock v-else :size="14" />
            </button>
            <button
              type="button"
              class="object-state-button"
              :aria-label="stateFor(object.id).hidden ? `Show ${object.name} in Editor` : `Hide ${object.name} in Editor`"
              :aria-pressed="stateFor(object.id).hidden"
              @click="emit('hide', object.id, !stateFor(object.id).hidden)"
            >
              <EyeOff v-if="stateFor(object.id).hidden" :size="14" />
              <Eye v-else :size="14" />
            </button>
          </article>
        </div>
      </section>
      <p v-if="!layers.length" class="empty-layers">No objects match “{{ search }}”.</p>
    </div>
  </aside>
</template>

<style scoped>
.object-navigator { min-width: 0; min-height: 0; display: flex; flex-direction: column; overflow: hidden; border-right: 1px solid rgba(73,54,47,.14); background: #f1ede1; color: #49362f; }
.navigator-heading { display: flex; align-items: center; justify-content: space-between; gap: .75rem; padding: 1.25rem 1rem .85rem; }
.navigator-heading span:first-child { color: #9a806f; font-size: .62rem; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
.navigator-heading h2 { margin: .12rem 0 0; font-size: 1.05rem; }
.object-count { min-width: 1.8rem; padding: .22rem .45rem; border-radius: 999px; background: #fff8ef; color: #8d5d51; font-size: .7rem; font-weight: 800; text-align: center; }
.object-search { display: flex; align-items: center; gap: .45rem; margin: 0 .75rem .8rem; padding: .55rem .65rem; border: 1px solid rgba(73,54,47,.16); border-radius: 10px; background: rgba(255,253,244,.9); }
.object-search:focus-within { border-color: #b85b69; box-shadow: 0 0 0 2px rgba(184,91,105,.12); }
.object-search input { min-width: 0; width: 100%; border: 0; outline: 0; background: transparent; color: inherit; font: 500 .73rem/1.3 system-ui; }
.layer-tree { min-height: 0; overflow: auto; padding: 0 .55rem 5rem; scrollbar-gutter: stable; }
.layer-section + .layer-section { margin-top: .2rem; }
.layer-heading { width: 100%; display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: .35rem; border: 0; padding: .55rem .45rem; background: transparent; color: #6c5148; text-align: left; cursor: pointer; font-size: .73rem; font-weight: 800; }
.layer-heading svg { transition: transform .18s ease; }.layer-heading svg.rotated { transform: rotate(90deg); }.layer-heading small { color: #a28c80; font-size: .65rem; }
.layer-objects { display: grid; gap: .18rem; margin-left: .3rem; padding-left: .45rem; border-left: 1px solid rgba(73,54,47,.12); }
.layer-object { display: grid; grid-template-columns: 22px minmax(0,1fr) 28px 28px; align-items: center; border: 1px solid transparent; border-radius: 9px; overflow: hidden; transition: background .16s ease,border-color .16s ease,transform .16s ease; }
.layer-object:hover { background: rgba(255,250,244,.75); }.layer-object.selected { border-color: rgba(184,91,105,.25); background: #fff9f2; }.layer-object.primary { border-color: rgba(184,91,105,.42); box-shadow: inset 3px 0 #b85b69; }.layer-object.drop-target { transform: translateY(2px); box-shadow: 0 -2px #b85b69; }.layer-object.hidden { opacity: .56; }.layer-object.locked .object-type-mark { border-style: dashed; }
.layer-drag-handle { width: 22px; height: 30px; display: grid; place-items: center; border: 0; background: transparent; color: #a58d82; cursor: grab; }.layer-drag-handle:active { cursor: grabbing; }
.object-select { min-width: 0; display: flex; align-items: center; gap: .5rem; border: 0; padding: .48rem .42rem; background: transparent; color: inherit; text-align: left; cursor: pointer; }
.layer-rename-input { min-width: 0; width: calc(100% - .4rem); margin: 0 .2rem; border: 1px solid #b85b69; border-radius: 6px; padding: .38rem .4rem; background: #fff; color: inherit; font: 700 .68rem/1.2 system-ui; }
.object-select:focus-visible,.object-state-button:focus-visible,.layer-heading:focus-visible,.layer-drag-handle:focus-visible,.layer-rename-input:focus-visible { outline: 2px solid rgba(184,91,105,.55); outline-offset: -2px; }
.object-type-mark { flex: 0 0 1.45rem; width: 1.45rem; height: 1.45rem; display: grid; place-items: center; border: 1px solid #e0cfc5; border-radius: 6px; background: #fffaf4; color: #9b5860; font-size: .62rem; font-weight: 900; }
.object-copy { min-width: 0; display: grid; gap: .08rem; }.object-copy strong,.object-copy small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.object-copy strong { font-size: .68rem; }.object-copy small { color: #9a806f; font-size: .56rem; }
.object-state-button { width: 26px; height: 26px; display: grid; place-items: center; border: 0; border-radius: 7px; background: transparent; color: #8c7568; cursor: pointer; }.object-state-button:hover { color: #8d363a; background: #fff3ea; }
.empty-layers { padding: 1rem .5rem; color: #8c7568; font-size: .72rem; line-height: 1.5; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
</style>
