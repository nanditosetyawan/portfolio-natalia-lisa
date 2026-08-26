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
        @toggle-sidebar="sidebarOpen = !sidebarOpen"
      >
        <template v-if="isEditPage">
          <button class="tbar-btn tbar-undo" title="Undo" :disabled="!editor.canUndo" @click="handleUndo">
            <Undo />
          </button>
          <button class="tbar-btn tbar-redo" title="Redo" :disabled="!editor.canRedo" @click="handleRedo">
            <Redo />
          </button>
          <span v-if="editorSaveStatus" class="editor-save-status" :class="{ 'editor-save-status--dirty': editorHasChanges }">
            {{ editorSaveStatus }}
          </span>
          <button class="tbar-btn tbar-save" :disabled="isSaving" @click="handleEditorSave">
            <Save />
            <span>{{ isSaving ? 'Saving…' : 'Save Draft' }}</span>
          </button>
          <button class="tbar-btn tbar-publish" disabled>
            <Publish />
            <span>Publish</span>
          </button>
        </template>
      </AdminHeader>
      <main class="admin-content" :class="{ 'admin-content--editor': isEditPage }">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Undo, Redo, Save } from 'lucide-vue-next'
import { useAuthStore } from '../../../stores/auth'
import AdminSidebar from './AdminSidebar.vue'
import AdminHeader from './AdminHeader.vue'
import { editorHasChanges, editorSaveStatus, markEditorChanged, saveEditor } from '../../../composables/useEditorSession'
import { useEditorStore } from '../../../stores/editor'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const sidebarOpen = ref(false)
const isSaving = ref(false)
const editor = useEditorStore()

const sidebarItems = [
  { path: '/admin', label: 'Dashboard', icon: 'layout-dashboard' },
  { path: '/admin/edit', label: 'Edit', icon: 'edit' },
  { path: '/admin/drafts', label: 'Drafts', icon: 'file-text' },
  { path: '/admin/favorites', label: 'Favorites', icon: 'heart' },
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

const pageTitle = computed(() => {
  const titles: Record<string, string> = {
    '/admin': 'Dashboard',
    '/admin/edit': 'Edit',
    '/admin/drafts': 'Draft Library',
    '/admin/favorites': 'Favorite Drafts',
    '/admin/media': 'Manage Media',
    '/admin/maintenance': 'Maintenance',
    '/admin/messages': 'Messages',
  }
  return titles[route.path] || 'Admin'
})

const isEditPage = computed(() => route.path === '/admin/edit')

const Publish = {
  template:
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6l-6-6z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="8" y1="13" x2="16" y2="13"></line><line x1="8" y1="17" x2="16" y2="17"></line><line x1="8" y1="9" x2="8.5" y2="9"></line></svg>',
}
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
</style>
