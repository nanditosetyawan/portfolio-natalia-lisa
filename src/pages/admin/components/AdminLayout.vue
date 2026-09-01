<template>
  <div class="admin-layout">
    <AdminSidebar
      :items="sidebarItems"
      :active-path="route.path"
      :is-drawer="true"
      :is-open="sidebarOpen"
      @close="sidebarOpen = false"
      @logout="handleLogout"
    />
    
    <div
      class="dashboard-content"
      :class="{ dimmed: sidebarOpen }"
    >
      <AdminHeader
        :title="pageTitle"
        show-hamburger
        :menu-open="sidebarOpen"
        @toggle-sidebar="sidebarOpen = !sidebarOpen"
      >
        <template v-if="isEditPage">
          <button class="tbar-btn tbar-undo" title="Undo (Ctrl+Z)" aria-label="Undo (Ctrl+Z)" :disabled="!editor.canUndo" @click="handleUndo">
            <Undo />
          </button>
          <button class="tbar-btn tbar-redo" title="Redo (Ctrl+Shift+Z)" aria-label="Redo (Ctrl+Shift+Z)" :disabled="!editor.canRedo" @click="handleRedo">
            <Redo />
          </button>
          <span v-if="editorSaveStatus" class="editor-save-status" :class="{ 'editor-save-status--dirty': editorHasChanges }">
            {{ editorSaveStatus }}
          </span>
          <span v-if="editorPublishStatus" class="editor-publish-status" :class="{ 'editor-publish-status--failed': editorPublishStatus === 'Failed' }">{{ editorPublishStatus }}</span>
          <button class="tbar-btn tbar-save" title="Save Draft (Ctrl+S)" :disabled="isSaving || editor.isPublishing" @click="handleEditorSave">
            <Save />
            <span>{{ isSaving ? 'Saving…' : 'Save Draft' }}</span>
          </button>
          <button class="tbar-btn tbar-publish" :disabled="publishDisabled" :title="publishDisabledReason" @click="openPublishDialog">
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6l-6-6z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="8" y1="13" x2="16" y2="13"></line>
              <line x1="8" y1="17" x2="16" y2="17"></line>
              <line x1="8" y1="9" x2="8.5" y2="9"></line>
            </svg>
            <span>{{ editor.isPublishing ? 'Publishing…' : 'Publish' }}</span>
          </button>
        </template>
      </AdminHeader>
      <main class="admin-content" :class="{ 'admin-content--editor': isEditPage }">
        <router-view />
      </main>
    </div>

    <div v-if="showPublishDialog" class="publish-modal-backdrop" role="presentation" @click.self="closePublishDialog">
      <section class="publish-modal" role="dialog" aria-modal="true" aria-labelledby="publish-dialog-title">
        <p class="publish-modal-kicker">Published Runtime</p>
        <h2 id="publish-dialog-title">Publish this saved Draft?</h2>
        <p>Draft #{{ editor.draftRevisionNumber ?? '-' }} remains in the Draft Library. Favorites and Editor history will not be removed.</p>
        <label for="publish-note">Publish note <span>(optional)</span></label>
        <textarea id="publish-note" v-model="publishNote" maxlength="500" rows="3" placeholder="What changed in this revision?"></textarea>
        <ul v-if="editorPublishErrors.length" class="publish-errors" aria-live="assertive">
          <li v-for="error in editorPublishErrors" :key="error">{{ error }}</li>
        </ul>
        <div class="publish-modal-actions">
          <button type="button" class="publish-cancel" :disabled="editor.isPublishing" @click="closePublishDialog">Cancel</button>
          <button type="button" class="publish-confirm" :disabled="editor.isPublishing" @click="confirmPublish">
            {{ editor.isPublishing ? 'Publishing…' : 'Publish atomically' }}
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Undo, Redo, Save } from 'lucide-vue-next'
import { useAuthStore } from '../../../stores/auth'
import AdminSidebar from './AdminSidebar.vue'
import AdminHeader from './AdminHeader.vue'
import { editorHasChanges, editorSaveStatus, markEditorChanged, saveEditor } from '../../../composables/useEditorSession'
import { editorPublishErrors, editorPublishStatus, publishEditor, resetEditorPublishFeedback } from '../../../composables/useEditorPublish'
import { useEditorStore } from '../../../stores/editor'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const sidebarOpen = ref(false)
const isSaving = ref(false)
const showPublishDialog = ref(false)
const publishNote = ref('')
const editor = useEditorStore()

const sidebarItems = [
  { path: '/admin', label: 'Dashboard', icon: 'layout-dashboard' },
  { path: '/admin/edit', label: 'Edit', icon: 'edit' },
  { path: '/admin/drafts', label: 'Drafts', icon: 'file-text' },
  { path: '/admin/favorites', label: 'Favorites', icon: 'heart' },
  { path: '/admin/published', label: 'Publish History', icon: 'clock' },
  { path: '/admin/media', label: 'Manage Media', icon: 'image' },
  { path: '/admin/maintenance', label: 'Maintenance', icon: 'wrench' },
  { path: '/admin/messages', label: 'Messages', icon: 'mail' },
]

const handleLogout = async () => {
  await auth.logout()
  await router.replace('/')
}

const handleEditorSave = async () => {
  isSaving.value = true
  try { await saveEditor() } catch { /* save action owns the visible recoverable error */ } finally {
    isSaving.value = false
  }
}

const handleUndo = () => {
  if (!editor.canUndo) return
  editor.undo()
  markEditorChanged()
}
const handleRedo = () => {
  if (!editor.canRedo) return
  editor.redo()
  markEditorChanged()
}

const publishDisabled = computed(() => !editor.draftRevisionId || editorHasChanges.value || editor.hasUnsavedChanges || editor.registeredPropertyErrors.length > 0 || isSaving.value || editor.isSavingDraft || editor.isPublishing)
const publishDisabledReason = computed(() => {
  if (editor.registeredPropertyErrors.length) return `Resolve ${editor.registeredPropertyErrors.length} invalid editor properties before publishing.`
  if (!editor.draftRevisionId) return 'Save this workspace as a Draft before publishing.'
  if (editorHasChanges.value || editor.hasUnsavedChanges) return 'Save Draft before publishing.'
  return editor.isPublishing ? 'Publish is in progress.' : 'Publish the saved Draft.'
})

function openPublishDialog(): void {
  if (publishDisabled.value) return
  resetEditorPublishFeedback()
  publishNote.value = ''
  showPublishDialog.value = true
}

function isTypingTarget(target: EventTarget | null): boolean {
  const element = target instanceof HTMLElement ? target : null
  return Boolean(element?.closest('input, textarea, select, [contenteditable="true"]'))
}

function handleEditorShortcut(event: KeyboardEvent): void {
  if (!isEditPage.value || !event.ctrlKey || event.altKey || isTypingTarget(event.target)) return
  const key = event.key.toLowerCase()
  if (key === 's') {
    event.preventDefault()
    void handleEditorSave()
  } else if (key === 'p') {
    event.preventDefault()
    openPublishDialog()
  } else if (key === 'z' && event.shiftKey) {
    event.preventDefault()
    handleRedo()
  } else if (key === 'z') {
    event.preventDefault()
    handleUndo()
  }
}

onMounted(() => window.addEventListener('keydown', handleEditorShortcut))
onBeforeUnmount(() => window.removeEventListener('keydown', handleEditorShortcut))

function closePublishDialog(): void {
  if (editor.isPublishing) return
  showPublishDialog.value = false
}

async function confirmPublish(): Promise<void> {
  try {
    await publishEditor(publishNote.value)
    showPublishDialog.value = false
  } catch {
    // AdminEdit normalizes repository failures and keeps them visible here.
  }
}

const pageTitle = computed(() => {
  const titles: Record<string, string> = {
    '/admin': 'Dashboard',
    '/admin/edit': 'Edit',
    '/admin/drafts': 'Draft Library',
    '/admin/favorites': 'Favorite Drafts',
    '/admin/published': 'Publish History',
    '/admin/media': 'Manage Media',
    '/admin/media/library': 'Asset Library',
    '/admin/media/images': 'Image Gallery',
    '/admin/media/videos': 'Video Gallery',
    '/admin/media/documents': 'Document Gallery',
    '/admin/maintenance': 'Maintenance',
    '/admin/messages': 'Messages',
  }
  return titles[route.path] || 'Admin'
})

const isEditPage = computed(() => route.path === '/admin/edit')
</script>

<style scoped>
.admin-layout {
  position: relative;
  --admin-header-height: 72px;
  height: 100dvh;
  min-height: 0;
  background-color: #F6F4E8;
  overflow: hidden;
}

.dashboard-content {
  height: 100dvh;
  min-height: 0;
  display: flex;
  flex-direction: column;
  transition: filter 0.3s ease;
}

.dashboard-content.dimmed {
  filter: brightness(0.92);
}

.admin-content {
  flex: 1;
  padding: 2rem;
  overflow: auto;
  min-height: 0;
}

.admin-content--editor {
  flex: 0 0 auto;
  height: calc(100dvh - var(--admin-header-height));
  min-height: 0;
  padding: 0;
  overflow: hidden;
}

.tbar-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.4rem 0.5rem;
  border: none;
  border-radius: 9999px;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  opacity: 1;
  transition: all 0.2s ease;
}

.tbar-btn:disabled {
  cursor: wait;
  opacity: .62;
}

.editor-save-status {
  color: #7B5F3B;
  font-size: .75rem;
  font-weight: 700;
  white-space: nowrap;
}

.editor-save-status--dirty {
  color: #B45F04;
}

.editor-publish-status { color: #8d363a; font-size: .75rem; font-weight: 800; white-space: nowrap; }
.editor-publish-status--failed { color: #a53f32; }

.tbar-undo,
.tbar-redo {
  background: transparent;
  color: #7B5F3B;
  width: 36px;
  height: 36px;
  padding: 0;
  justify-content: center;
}

.tbar-undo:hover:not(:disabled),
.tbar-redo:hover:not(:disabled) {
  background: transparent;
  color: #5A3E35;
}

.tbar-save {
  background: rgba(255, 255, 255, 0.8);
  color: #5A3E35;
  border: 1px solid rgba(138, 124, 110, 0.3);
}

.tbar-save:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.9);
}

.tbar-publish {
  background: #FF9A86;
  color: #FFFFFF;
}

.tbar-publish:hover:not(:disabled) {
  background: #FF8572;
}

.publish-modal-backdrop { position: fixed; inset: 0; z-index: 1200; display: grid; place-items: center; padding: 1rem; background: rgba(64,43,37,.32); backdrop-filter: blur(5px); }
.publish-modal { width: min(520px, 100%); padding: 1.75rem; border: 1px solid rgba(141,54,58,.18); border-radius: 26px; color: #5a3e35; background: #fffaf4; box-shadow: 0 24px 70px rgba(77,48,40,.24); }
.publish-modal-kicker { margin: 0 0 .35rem; color: #b85b69; font-size: .72rem; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; }
.publish-modal h2 { margin: 0; font-size: 1.35rem; }
.publish-modal > p:not(.publish-modal-kicker) { margin: .65rem 0 1.2rem; color: #765f56; line-height: 1.55; }
.publish-modal label { display: block; margin-bottom: .4rem; font-size: .82rem; font-weight: 800; }
.publish-modal label span { font-weight: 500; color: #917d73; }
.publish-modal textarea { width: 100%; resize: vertical; padding: .75rem .85rem; border: 1px solid #ddc9bf; border-radius: 14px; color: #5a3e35; background: #fff; font: inherit; }
.publish-modal textarea:focus { outline: 2px solid rgba(184,91,105,.28); border-color: #b85b69; }
.publish-errors { margin: .85rem 0 0; padding: .75rem 1rem .75rem 2rem; border-radius: 14px; color: #8d363a; background: #fff0eb; font-size: .82rem; }
.publish-modal-actions { display: flex; justify-content: flex-end; gap: .65rem; margin-top: 1.2rem; }
.publish-modal-actions button { padding: .7rem 1rem; border-radius: 999px; font-weight: 800; cursor: pointer; }
.publish-cancel { border: 1px solid #ddc9bf; color: #5a3e35; background: transparent; }
.publish-confirm { border: 1px solid #ff9a86; color: #fff; background: #ff8d79; }
.publish-modal-actions button:disabled { cursor: wait; opacity: .65; }
</style>
