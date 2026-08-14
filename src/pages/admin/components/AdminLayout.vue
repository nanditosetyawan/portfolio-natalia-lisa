<template>
  <div class="admin-layout">
    <AdminSidebar
      :items="sidebarItems"
      :active-path="route.path"
      :is-drawer="isDrawerMode"
      :is-open="sidebarOpen"
      @close="sidebarOpen = false"
      @logout="handleLogout"
    />
    
    <div
      class="dashboard-content"
      :class="{ dimmed: isDrawerMode && sidebarOpen }"
    >
      <AdminHeader
        :title="pageTitle"
        :show-hamburger="isDashboard"
        @toggle-sidebar="sidebarOpen = !sidebarOpen"
      />
      <main class="admin-content">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AdminSidebar from './AdminSidebar.vue'
import AdminHeader from './AdminHeader.vue'

const route = useRoute()
const router = useRouter()
const sidebarOpen = ref(false)

const isDashboard = computed(() => route.path === '/admin')
const isDrawerMode = computed(() => isDashboard.value)

const sidebarItems = [
  { path: '/admin', label: 'Dashboard', icon: 'layout-dashboard' },
  { path: '/admin/edit', label: 'Edit', icon: 'edit' },
  { path: '/admin/media', label: 'Manage Media', icon: 'image' },
  { path: '/admin/maintenance', label: 'Maintenance', icon: 'wrench' },
  { path: '/admin/messages', label: 'Messages', icon: 'mail' },
]

const handleLogout = () => {
  router.push('/')
}

const pageTitle = computed(() => {
  const titles: Record<string, string> = {
    '/admin': 'Dashboard',
    '/admin/edit': 'Edit',
    '/admin/media': 'Manage Media',
    '/admin/maintenance': 'Maintenance',
    '/admin/messages': 'Messages',
  }
  return titles[route.path] || 'Admin'
})
</script>

<style scoped>
.admin-layout {
  position: relative;
  min-height: 100vh;
  background-color: #F6F4E8;
  overflow: hidden;
}

.dashboard-content {
  min-height: 100vh;
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
}
</style>