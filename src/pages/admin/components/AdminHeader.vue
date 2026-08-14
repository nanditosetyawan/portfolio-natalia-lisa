<template>
  <header class="admin-header">
    <div class="header-left">
      <h1 class="page-title">{{ title }}</h1>
      <p class="page-description">Admin control center for managing website content</p>
    </div>
    <div class="header-right">
      <div class="admin-badge">
        <div class="badge-indicator"></div>
        <span>Admin</span>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
interface Props {
  title: string
}

defineProps<Props>()
</script>

<style scoped>
.admin-header {
  height: 72px;
  background: white;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 2rem;
}

.header-left {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.page-title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  color: #0f172a;
}

.page-description {
  margin: 0;
  font-size: 0.875rem;
  color: #64748b;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.admin-badge {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background-color: #f8fafc;
  border-radius: 9999px;
  border: 1px solid #e2e8f0;
}

.badge-indicator {
  width: 8px;
  height: 8px;
  background-color: #22c55e;
  border-radius: 50%;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.admin-badge span {
  font-size: 0.875rem;
  font-weight: 600;
  color: #475569;
}
</style>