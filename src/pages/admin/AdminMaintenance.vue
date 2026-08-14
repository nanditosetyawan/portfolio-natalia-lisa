<template>
  <div class="maintenance-page">
    <div class="page-title">Maintenance</div>
    <p class="page-description">
      System maintenance tools. These actions affect the entire project.
    </p>

    <div class="maintenance-actions">
      <button class="maint-btn" disabled>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M21 15V7C21 5.89543 20.1046 5 19 5H5C3.89543 5 3 5.89543 3 7V17C3 18.1046 3.89543 19 5 19H19C20.1046 19 21 18.1046 21 17V15Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M9 11L12 14L15 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M12 14L12 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span>Export</span>
      </button>

      <button class="maint-btn" disabled>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M21 15V7C21 5.89543 20.1046 5 19 5H5C3.89543 5 3 5.89543 3 7V17C3 18.1046 3.89543 19 5 19H19C20.1046 19 21 18.1046 21 17V15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M15 11L11 15L9 13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M12 15V3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span>Import</span>
      </button>

      <button class="maint-btn reset-btn" @click="showResetModal = true">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M3 12C3 7.58172 6.58172 4 11 4C15.4183 4 19 7.58172 19 12C19 16.4183 15.4183 20 11 20C6.58172 20 3 16.4183 3 12Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M3 3L21 21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span>Reset System</span>
      </button>
    </div>

    <p class="maint-note">
      Export, Import, and Reset System are UI placeholders — no persistence or data operations are implemented.
    </p>

    <div v-if="showResetModal" class="modal-overlay">
      <div class="modal">
        <div class="modal-header">
          <h3 class="modal-title">Confirm Reset System</h3>
          <p class="modal-text">
            This action will reset all configuration to system defaults.
            This operation cannot be undone.
          </p>
        </div>
        <div class="modal-actions">
          <button class="modal-btn cancel" @click="showResetModal = false">
            Cancel
          </button>
          <button class="modal-btn confirm" :disabled="isResetting" @click="handleConfirmReset">
            {{ isResetting ? 'Resetting...' : 'Reset All' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const showResetModal = ref(false)
const isResetting = ref(false)

const handleConfirmReset = () => {
  isResetting.value = true
  setTimeout(() => {
    isResetting.value = false
    showResetModal.value = false
  }, 1000)
}
</script>

<style scoped>
.maintenance-page {
  font-family: 'Inter', system-ui, sans-serif;
}

.page-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #0f172a;
  margin-bottom: 0.5rem;
}

.page-description {
  margin: 0 0 2rem 0;
  font-size: 0.95rem;
  color: #64748b;
}

.maintenance-actions {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  max-width: 400px;
}

.maint-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1.25rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  background-color: white;
  font-size: 0.95rem;
  font-weight: 500;
  color: #475569;
  cursor: not-allowed;
  opacity: 0.5;
  transition: all 0.2s ease;
}

.maint-btn:not(.reset-btn):hover {
  background-color: #f8fafc;
}

.reset-btn {
  border-color: #fecaca;
  color: #dc2626;
  opacity: 1;
  cursor: pointer;
}

.reset-btn:hover {
  background-color: #fef2f2;
}

.reset-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.maint-note {
  margin-top: 2rem;
  font-size: 0.875rem;
  color: #94a3b8;
  font-style: italic;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(15, 23, 42, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: white;
  border-radius: 0.75rem;
  padding: 2rem;
  max-width: 400px;
  width: 90%;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
}

.modal-header {
  margin-bottom: 1.5rem;
}

.modal-title {
  margin: 0 0 0.75rem 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: #0f172a;
}

.modal-text {
  margin: 0;
  font-size: 0.95rem;
  color: #64748b;
  line-height: 1.5;
}

.modal-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
}

.modal-btn {
  padding: 0.625rem 1.5rem;
  border-radius: 0.5rem;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: all 0.2s ease;
}

.cancel {
  background-color: #f8fafc;
  color: #475569;
  border: 1px solid #e2e8f0;
}

.cancel:hover {
  background-color: #f1f5f9;
}

.confirm {
  background-color: #0f172a;
  color: white;
}

.confirm:hover:not(:disabled) {
  background-color: #1e293b;
}

.modal-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
