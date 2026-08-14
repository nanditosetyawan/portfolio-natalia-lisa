<template>
  <header class="admin-header">
    <div class="header-left">
      <button
        v-if="showHamburger"
        class="hamburger-btn"
        aria-label="Open sidebar"
        @click="$emit('toggle-sidebar')"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <line x1="3" y1="6" x2="21" y2="6"></line>
          <line x1="3" y1="12" x2="21" y2="12"></line>
          <line x1="3" y1="18" x2="21" y2="18"></line>
        </svg>
      </button>
      <h1 class="page-title">{{ title }}</h1>
    </div>
  </header>
</template>

<script setup lang="ts">
interface Props {
  title: string
  showHamburger?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showHamburger: false
})

defineEmits(['toggle-sidebar'])
</script>

<style scoped>
.admin-header {
  height: 72px;
  background: #F6F4E8;
  border-bottom: 1px solid #E8DED0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 2rem;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.hamburger-btn {
  display: flex;
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

.hamburger-btn:hover {
  background-color: #FFF5EB;
}

.page-title {
  margin: 0;
  font-size: 2rem;
  font-weight: 800;
  color: #5A3E35;
  letter-spacing: -0.02em;
}
</style>
