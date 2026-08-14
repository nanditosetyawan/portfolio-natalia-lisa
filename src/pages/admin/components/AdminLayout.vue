<template>
  <div class="admin-layout">
    <div class="dashboard-content">
      <AdminHeader :title="pageTitle" />
      <main class="admin-content">
        <slot />
      </main>
    </div>
    
    <AdminSidebar
      v-if="isDashboardRoute"
      :items="sidebarItems"
      :active-path="route.path"
      :is-drawer="true"
      ref="sidebarRef"
      @logout="handleLogout"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AdminSidebar from './AdminSidebar.vue'
import AdminHeader from './AdminHeader.vue'

const route = useRoute()
const router = useRouter()
const sidebarRef = ref(null)

const isDashboardRoute = computed(() => route.path === '/admin')

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

// Methods to control sidebar from Dashboard
defineExpose({
  openSidebar: () => {
    if (sidebarRef.value) {
      sidebarRef.value.openSidebar()
    }
  },
  closeSidebar: () => {
    if (sidebarRef.value) {
      sidebarRef.value.closeSidebar()
    }
  },
  toggleSidebar: () => {
    if (sidebarRef.value) {
      sidebarRef.value.toggleSidebar()
    }
  }
})
</script>

<style scoped>
.admin-layout {
  position: relative;
  min-height: 100vh;
  background-color: #FAF3E0;
  overflow: hidden;
}

/* Content area that gets dimmed when sidebar is open */
.dashboard-content {
  min-height: 100vh;
  transition: filter 0.3s ease;
}

.dashboard-content.dimmed {
  filter: brightness(0.95);
}

/* Make sure content doesn't get pushed by fixed sidebar */
.admin-content {
  flex: 1;
  padding: 2rem;
  max-width: calc(100vw - 260px);
  margin-left: 0;
  transition: margin-left 0.3s ease, max-width 0.3s ease;
}

/* When sidebar is open as drawer, don't shift content */
.dashboard-content.dimmed ~ .admin-sidebar.drawer.open + .admin-content {
  margin-left: 0;
  max-width: 100vw;
}

/* For non-drawer mode (other pages) */
.admin-layout:not(.dashboard-page) .admin-content {
  margin-left: 260px;
}
</style>