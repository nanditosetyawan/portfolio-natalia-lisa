<template>
  <div class="media-page">
    <div class="page-title">Manage Media</div>
    <div class="media-header">
      <button class="upload-btn" disabled>
        + Upload
      </button>
    </div>
    <div class="media-grid">
      <div
        v-for="n in 12"
        :key="n"
        class="media-placeholder"
      >
        <div class="media-thumb">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" stroke="currentColor" stroke-width="2"/>
            <circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" stroke-width="2"/>
            <path d="M21 15L15.5 20L11 15L7 19V21H21V15Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <span class="media-label">media</span>
      </div>
    </div>
    <p class="media-note">
      Media upload and management is a placeholder — implementation pending.
    </p>
  </div>
</template>

<script setup lang="ts">
</script>

<style scoped>
.media-page {
  font-family: 'Inter', system-ui, sans-serif;
}

.page-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #0f172a;
  margin-bottom: 1.5rem;
}

.media-header {
  margin-bottom: 1.5rem;
}

.upload-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1.25rem;
  background-color: #0f172a;
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: not-allowed;
  opacity: 0.5;
}

.media-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 1rem;
}

.media-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  border: 1px dashed #cbd5e0;
  border-radius: 0.5rem;
  background-color: white;
  cursor: not-allowed;
}

.media-thumb {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  color: #94a3b8;
}

.media-label {
  font-size: 0.8rem;
  color: #94a3b8;
  text-align: center;
}

.media-note {
  margin-top: 1.5rem;
  font-size: 0.875rem;
  color: #94a3b8;
  font-style: italic;
}
</style>
