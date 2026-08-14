<template>
  <div class="sidebar-container">
    <div
      v-if="isOpen"
      class="sidebar-overlay"
      @click="closeSidebar"
      aria-hidden="true"
    ></div>
    
    <aside
      :class="['admin-sidebar', { open: isOpen, drawer: isDrawer }]"
      :style="sidebarStyles"
    >
      <div class="sidebar-header">
        <div class="brand">
          <div class="brand-icon">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="4" fill="#5A3E35"/>
              <rect x="8" y="8" width="16" height="16" rx="2" fill="#7B5F3B"/>
              <rect x="12" y="12" width="8" height="8" rx="1" fill="#FAF3E0"/>
            </svg>
          </div>
          <span class="brand-text">Tali-Temali</span>
        </div>
        
        <button
          class="hamburger-btn"
          @click="closeSidebar"
          aria-label="Close sidebar"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>
      </div>
      
      <nav class="sidebar-nav">
        <ul class="nav-list">
          <li v-for="item in items" :key="item.path">
            <router-link
              :to="item.path"
              class="nav-item"
              :class="{ active: item.path === activePath }"
              @click="handleNavClick"
            >
              <component :is="getIconComponent(item.icon)" class="nav-icon" />
              <span class="nav-label">{{ item.label }}</span>
            </router-link>
          </li>
        </ul>
      </nav>
      
      <div class="sidebar-footer">
        <button class="logout-btn" @click="handleLogout">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M16 17L21 12L16 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M21 12H9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span>Logout</span>
        </button>
      </div>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Edit, Image, LayoutDashboard, Wrench, Mail } from 'lucide-vue-next'

interface SidebarItem {
  path: string
  label: string
  icon: string
}

const props = withDefaults(defineProps<{
  items: SidebarItem[]
  activePath: string
  isDrawer?: boolean
}>(), {
  items: () => [],
  activePath: '',
  isDrawer: false
})

const emit = defineEmits(['logout'])

const isOpen = ref(false)
const isDrawer = ref(props.isDrawer)

const route = useRoute()
const router = useRouter()

const iconMap = {
  'layout-dashboard': LayoutDashboard,
  'edit': Edit,
  'image': Image,
  'wrench': Wrench,
  'mail': Mail
}

const getIconComponent = (iconName: string) => {
  return iconMap[iconName as keyof typeof iconMap] || null
}

const handleNavClick = () => {
  if (isDrawer.value && isOpen.value) {
    closeSidebar()
  }
}

const handleLogout = () => {
  emit('logout')
}

const closeSidebar = () => {
  isOpen.value = false
}

const toggleSidebar = () => {
  isOpen.value = !isOpen.value
}

// Expose methods for parent to call
defineExpose({
  openSidebar: () => { isOpen.value = true },
  closeSidebar,
  toggleSidebar
})

watch(() => route.path, () => {
  if (isDrawer.value && isOpen.value) {
    closeSidebar()
  }
})

onMounted(() => {
  // Close sidebar on escape key
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && isOpen.value) {
    closeSidebar()
  }
}

const sidebarStyles = computed(() => {
  if (isDrawer.value) {
    return {
      transform: isOpen.value ? 'translateX(0)' : 'translateX(-100%)',
      transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
    }
  }
  return {}
})
</script>

<style scoped>
.sidebar-container {
  position: relative;
}

.sidebar-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(90, 62, 53, 0.5);
  z-index: 99;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s ease;
}

.sidebar-overlay:not([style*="display: none"]) {
  opacity: 1;
  pointer-events: auto;
}

.admin-sidebar {
  width: 260px;
  height: 100vh;
  background-color: #FAF3E0;
  border-right: 1px solid #E8DED0;
  display: flex;
  flex-direction: column;
  position: fixed;
  top: 0;
  left: 0;
  z-index: 100;
  overflow-y: auto;
}

.admin-sidebar.drawer {
  box-shadow: 25px 0 50px -12px rgba(90, 62, 53, 0.2);
}

.admin-sidebar.drawer.open {
  transform: translateX(0);
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem;
  border-bottom: 1px solid #E8DED0;
}

.brand {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1;
}

.brand-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.brand-text {
  font-size: 1.25rem;
  font-weight: 700;
  color: #5A3E35;
  letter-spacing: -0.025em;
}

.hamburger-btn {
  display: none;
  align-items: center;
  justify-content: center;
  padding: 0.5rem;
  background: none;
  border: none;
  color: #7B5F3B;
  cursor: pointer;
  border-radius: 0.5rem;
  transition: background-color 0.2s ease;
}

.admin-sidebar.drawer .hamburger-btn {
  display: flex;
}

.hamburger-btn:hover {
  background-color: #FFF5EB;
}

.sidebar-nav {
  flex: 1;
  padding: 1rem;
}

.nav-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  text-decoration: none;
  color: #7B5F3B;
  border-radius: 12px;
  font-weight: 500;
  font-size: 0.95rem;
  transition: all 0.2s ease;
  position: relative;
}

.nav-item:hover {
  background-color: #FFF5EB;
  color: #5A3E35;
}

.nav-item.active {
  background-color: #FFE4B5;
  color: #5A3E35;
  font-weight: 600;
}

.nav-item.active::before {
  content: none;
}

.nav-icon {
  width: 1.25rem;
  height: 1.25rem;
  flex-shrink: 0;
}

.nav-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar-footer {
  padding: 1.5rem;
  border-top: 1px solid #E8DED0;
}

.logout-btn {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: none;
  border: 1px solid #E8DED0;
  border-radius: 12px;
  color: #7B5F3B;
  cursor: pointer;
  font-size: 0.95rem;
  font-weight: 500;
  width: 100%;
  transition: all 0.2s ease;
}

.logout-btn:hover {
  background-color: #FFF5EB;
  border-color: #FFE4B5;
  color: #B45F04;
}

.logout-btn svg {
  flex-shrink: 0;
}

/* Mobile responsive - hide sidebar on mobile by default, show as drawer */
@media (max-width: 1024px) {
  .admin-sidebar:not(.drawer) {
    display: none;
  }
  
  .admin-sidebar.drawer {
    display: flex;
  }
}
</style>