<template>
  <div class="maintenance-page">
    <div class="maintenance-container">
      <button
        type="button"
        class="maintenance-card maintenance-card--import"
        aria-label="Import media"
        @click="handleCardClick('import')"
      >
        <span class="maintenance-illustration">
          <Upload class="illustration-icon" />
        </span>
        <span class="maintenance-content">
          <span class="maintenance-title">Import</span>
          <span class="maintenance-description">
            Import configuration and media data from an external package.
          </span>
        </span>
        <span class="maintenance-chevron">
          <ChevronRight class="chevron-icon" />
        </span>
      </button>

      <button
        type="button"
        class="maintenance-card maintenance-card--export"
        aria-label="Export media"
        @click="handleCardClick('export')"
      >
        <span class="maintenance-illustration">
          <Download class="illustration-icon" />
        </span>
        <span class="maintenance-content">
          <span class="maintenance-title">Export</span>
          <span class="maintenance-description">
            Export current configuration and project data to a package file.
          </span>
        </span>
        <span class="maintenance-chevron">
          <ChevronRight class="chevron-icon" />
        </span>
      </button>

      <button
        type="button"
        class="maintenance-card maintenance-card--reset"
        aria-label="Reset system"
        @click="handleResetCardClick"
      >
        <span class="maintenance-illustration">
          <RefreshCw class="illustration-icon" />
        </span>
        <span class="maintenance-content">
          <span class="maintenance-title">Reset System</span>
          <span class="maintenance-description">
            Reset all configuration to the default system state.
          </span>
        </span>
        <span class="maintenance-chevron">
          <ChevronRight class="chevron-icon" />
        </span>
      </button>

      <div class="maintenance-info-banner">
        <Info class="info-icon" />
        <span class="info-text">
          Reset System will restore the current configuration to the default system state.
        </span>
      </div>
    </div>

    <transition name="modal-fade">
      <div
        v-if="showResetModal"
        class="modal-overlay"
        @click.self="showResetModal = false"
      >
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div class="modal-header">
            <h3 id="modal-title" class="modal-title">Reset System</h3>
            <p class="modal-text">
              This will reset the current configuration to the default system
              state. This operation cannot be undone.
            </p>
          </div>
          <div class="modal-actions">
            <button
              type="button"
              class="modal-btn modal-btn--cancel"
              @click="showResetModal = false"
            >
              Cancel
            </button>
            <button
              type="button"
              class="modal-btn modal-btn--confirm"
              @click="showResetModal = false"
            >
              Reset System
            </button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Upload, Download, RefreshCw, ChevronRight, Info } from 'lucide-vue-next'

const showResetModal = ref(false)

const handleCardClick = (_action: string) => {
  // UI shell only - placeholder action
}

const handleResetCardClick = () => {
  showResetModal.value = true
}
</script>

<style scoped>
.maintenance-page {
  background: #F6F4E8;
  min-height: 100vh;
  display: flex;
  justify-content: center;
  padding: 0 2rem 2rem;
  font-family: 'Inter', system-ui, sans-serif;
}

.maintenance-container {
  width: 100%;
  max-width: 880px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  margin-top: 24px;
}

.maintenance-card {
  background: #FAF9F5;
  border-radius: 24px;
  padding: 20px;
  box-shadow: 0 8px 25px -12px rgba(90, 62, 53, 0.1), 0 0 0 1px rgba(90, 62, 53, 0.05);
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 20px;
  width: 100%;
  text-align: left;
  cursor: pointer;
  border: none;
  transition: all 0.2s ease;
  color: inherit;
}

.maintenance-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 30px -8px rgba(90, 62, 53, 0.12), 0 0 0 1px rgba(90, 62, 53, 0.06);
}

.maintenance-card:focus-visible {
  outline: 2px solid #E8DED0;
  outline-offset: 2px;
}

.maintenance-illustration {
  flex: 0 0 38%;
  max-width: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 96px;
  border-radius: 16px;
  background: linear-gradient(150deg, #FFF5EB 0%, #FFE4B5 100%);
  box-shadow: inset 0 2px 6px rgba(90, 62, 53, 0.06);
}

.illustration-icon {
  width: 40px;
  height: 40px;
  color: #7B5F3B;
  opacity: 0.85;
}

.maintenance-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.maintenance-title {
  margin: 0 0 4px 0;
  font-size: 1rem;
  font-weight: 600;
  color: #5A3E35;
}

.maintenance-description {
  margin: 0;
  font-size: 0.8rem;
  color: #7B5F3B;
  line-height: 1.35;
}

.maintenance-chevron {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #5A3E35;
  opacity: 0.6;
}

.chevron-icon {
  width: 16px;
  height: 16px;
}

.maintenance-card--reset:hover .maintenance-illustration {
  background: linear-gradient(150deg, #FFEEEC 0%, #FFEFEE 100%);
}

.maintenance-card--reset:hover {
  box-shadow: 0 12px 30px -8px rgba(180, 78, 42, 0.18), 0 0 0 1px rgba(180, 78, 42, 0.1);
}

.maintenance-info-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  background: #EBE9E0;
  border: 1px solid #DEDAD0;
  border-radius: 18px;
  font-size: 0.8rem;
  color: #7B5F3B;
  line-height: 1.4;
}

.info-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  color: #B45F04;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(90, 62, 53, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1.5rem;
}

.modal {
  background: #FAF9F5;
  border-radius: 24px;
  padding: 24px;
  max-width: 420px;
  width: 100%;
  box-shadow: 0 25px 50px -12px rgba(90, 62, 53, 0.25);
}

.modal-header {
  margin-bottom: 1rem;
}

.modal-title {
  margin: 0 0 0.5rem 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: #5A3E35;
}

.modal-text {
  margin: 0;
  font-size: 0.9rem;
  color: #7B5F3B;
  line-height: 1.5;
}

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 1.25rem;
}

.modal-btn {
  padding: 0.5rem 1.25rem;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid #E8DED0;
  transition: all 0.2s ease;
}

.modal-btn--cancel {
  background: #FFF5EB;
  color: #7B5F3B;
}

.modal-btn--cancel:hover {
  background: #FFE4B5;
}

.modal-btn--confirm {
  background: #FFEEEC;
  color: #B44E2A;
  border-color: #FCD3BE;
}

.modal-btn--confirm:hover {
  background: #FFE1DA;
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

@media (max-width: 768px) {
  .maintenance-card {
    flex-direction: column;
    text-align: center;
  }

  .maintenance-content {
    text-align: center;
    align-items: center;
  }

  .maintenance-illustration {
    flex: 0 0 auto;
    max-width: 140px;
    margin: 0 auto;
  }

  .maintenance-chevron {
    position: absolute;
    top: 20px;
    right: 20px;
  }
}
</style>
