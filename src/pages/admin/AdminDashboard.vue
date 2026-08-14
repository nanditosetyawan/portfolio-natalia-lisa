<template>
  <div class="dashboard">
    <div class="dashboard-header">
      <div class="header-actions">
        <button class="hamburger-btn" aria-label="Open sidebar" @click="toggleSidebar">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>
        <h1 class="page-title">Dashboard</h1>
      </div>
    </div>

    <div class="dashboard-main">
      <div class="dashboard-grid">
        <div class="card card-draft">
          <div class="card-image">
            <svg width="80" height="80" viewBox="0 0 80 80" fill="none" class="illustration">
              <path d="M20 10 L30 10 L30 30 L50 30 L50 50 L30 50 L30 70 L10 70 L10 50 L20 50 Z" stroke="currentColor" stroke-width="3" fill="none"/>
              <circle cx="30" cy="30" r="8" fill="currentColor"/>
              <circle cx="50" cy="50" r="8" fill="currentColor"/>
              <line x1="30" y1="5" x2="30" y2="10"></line>
              <line x1="50" y1="5" x2="50" y2="10"></line>
              <line x1="5" y1="30" x2="10" y2="30"></line>
              <line x1="5" y1="50" x2="10" y2="50"></line>
              <line x1="30" y1="75" x2="30" y2="80"></line>
              <line x1="50" y1="75" x2="50" y2="80"></line>
              <line x1="5" y1="72" x2="8" y2="77"></line>
              <line x1="5" y1="77" x2="8" y2="72"></line>
              <ellipse cx="30" cy="60" rx="12" ry="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
              <ellipse cx="50" cy="60" rx="12" ry="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
              <circle cx="30" cy="30" r="2" fill="none" stroke="currentColor" stroke-width="1.5"/>
              <circle cx="50" cy="50" r="2" fill="none" stroke="currentColor" stroke-width="1.5"/>
            </svg>
          </div>
          <div class="card-content">
            <div class="card-header">
              <span class="card-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M14.7 6.3a1.9 1.9 0 0 0 .3 2.57 1.9 1.9 0 0 0 .865 1.83 2 2 0 0 1 .66 1.27c.24.55.1 1.28-.2 1.63a2 2 0 0 0-.43.88 1.9 1.9 0 0 0-.94.57h-.8l-.18-.15a7 7 0 0 0-1.18-1.48L6.5 9.5a1.9 1.9 0 0 0-.28 1.48c.1.55.54 1.06.86 1.23a1.9 1.9 0 0 1 1.58.27l.18.15a7 7 0 0 0 1.18 1.48l.18.15c.53.37.76.6 1.2.55.61-.1 1.06-.55.87-1.23a1.9 1.9 0 0 0 .33-2.58l.18-.15a1.9 1.9 0 0 1 1.83-.86 1.9 1.9 0 0 0 1.83-.33 1.9 1.9 0 0 1 .57-.94 1.9 1.9 0 0 1 .86-.66c.55-.24 1.06-.1 1.63.2a2 2 0 0 1 1.27.43l.15.18 1.5 1.2c.55.45.5.96.1 1.63a1.9 1.9 0 0 1-1.23.86l-.15.18-1.2 1.5c-.45.55-.96.5-1.63.1a1.9 1.9 0 0 1-1.83-.33 1.9 1.9 0 0 1-.33-1.83l-.15-.18Z" stroke="currentColor" stroke-width="1.5" fill="none"/>
                </svg>
              </span>
              <h2 class="card-draft-title">Draf</h2>
            </div>
            <p class="card-draft-desc">3 item draft</p>
            <div class="card-bottom">
              <span class="card-pill">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20 6L9 17l5 5"></path>
                </svg>
                <span>3</span>
              </span>
            </div>
          </div>
        </div>

        <div class="card card-published">
          <div class="card-image">
            <svg width="80" height="80" viewBox="0 0 80 80" fill="none" class="illustration">
              <circle cx="40" cy="40" r="38" stroke="currentColor" stroke-width="3" fill="none"/>
              <path d="M23 40c0-12 7-20 14-20s14 8 14 20" stroke="currentColor" stroke-width="3" fill="none"/>
              <path d="M40 23L40 38L58 40l-6 10L51 53l5 5L40 40Z" stroke="currentColor" stroke-width="3" fill="none"/>
              <circle cx="40" cy="35" r="3" fill="currentColor"/>
              <circle cx="40" cy="45" r="3" fill="currentColor"/>
              <circle cx="35" cy="40" r="3" fill="currentColor"/>
              <circle cx="45" cy="40" r="3" fill="currentColor"/>
            </svg>
          </div>
          <div class="card-content">
            <div class="card-header">
              <span class="card-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <path d="M12 7v10M8 12h8"></rect>
                </svg>
              </span>
              <h2 class="card-published-title">Published</h2>
            </div>
            <p class="card-published-desc">1 publication</p>
            <div class="card-bottom">
              <span class="card-pill">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 22v-6l-3-3l5-5"></path>
                  <circle cx="12" cy="10" r="3" fill="currentColor"/>
                </svg>
                <span>1</span>
              </span>
            </div>
          </div>
        </div>

        <div class="card card-clock">
          <div class="card-image">
            <svg width="80" height="80" viewBox="0 0 80 80" fill="none" class="illustration">
              <circle cx="40" cy="40" r="36" stroke="currentColor" stroke-width="3" fill="none"/>
              <polyline points="40 20 40 44 24 36 56 36" stroke="currentColor" stroke-width="3" fill="none"/>
              <polyline points="20 40 36 44 36 56 44 56" stroke="currentColor" stroke-width="3" fill="none"/>
              <polyline points="40 56 40 76 56 70 56 70" stroke="currentColor" stroke-width="3" fill="none"/>
              <polyline points="56 40 70 44 70 56 70 56" stroke="currentColor" stroke-width="3" fill="none"/>
              <text x="40" y="50" font-family="system-ui, sans-serif" font-size="14" font-weight="bold" fill="currentColor">01</text>
              <text x="40" y="65" font-family="system-ui, sans-serif" font-size="14" fill="currentColor">23</text>
              <text x="74" y="55" font-family="system-ui, sans-serif" font-size="12" fill="currentColor">:</text>
              <text x="40" y="70" font-family="system-ui, sans-serif" font-size="14" fill="currentColor">45</text>
              <text x="54" y="60" font-family="system-ui, sans-serif" font-size="10" fill="currentColor">JAM</text>
            </svg>
          </div>
          <div class="card-content">
            <div class="card-header">
              <h3 class="card-clock-heading">Waktu Edit</h3>
            </div>
            <p class="card-clock-desc">01 : 23 : 45</p>
            <div class="card-clock-labels">
              <span>JAM</span>
              <span>MENIT</span>
              <span>DETIK</span>
            </div>
          </div>
        </div>

        <div class="card card-favorite">
          <div class="card-image">
            <svg width="80" height="80" viewBox="0 0 80 80" fill="none" class="illustration">
              <path d="M60 18L51.92 35.46L36 30L28 42L18 33L20.08 18L60 18Z" stroke="currentColor" stroke-width="3" fill="none"/>
              <path d="M36 28L24 36L24 52L36 60L36 28Z" stroke="currentColor" stroke-width="3" fill="none"/>
              <path d="M36 48L52 56L52 24L36 16L36 48Z" stroke="currentColor" stroke-width="3" fill="none"/>
            </svg>
          </div>
          <div class="card-content">
            <div class="card-header">
              <span class="card-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                  <path d="M2 17l10 5 10-5"></path>
                </svg>
              </span>
              <h3 class="card-favorite-title">Favorite</h3>
            </div>
            <p class="card-favorite-desc">Description placeholder</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const sidebarOpen = ref(false)

const toggleSidebar = () => {
  sidebarOpen.value = !sidebarOpen.value
}
</script>

<style scoped>
.dashboard {
  min-height: 100vh;
  background-color: #FAF3E0;
  font-family: 'Inter', system-ui, sans-serif;
  overflow: hidden;
}

.dashboard-header {
  padding: 2rem;
  border-bottom: 1px solid #E8DED0;
  background-color: #FAF3E0;
}

.header-actions {
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
  font-size: 2.25rem;
  font-weight: 800;
  color: #5A3E35;
  letter-spacing: -0.02em;
}

.dashboard-main {
  padding: 2rem;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 2rem;
  max-width: 1400px;
  width: 100%;
}

.card {
  background-color: #FFFFFF;
  border-radius: 24px;
  padding: 2rem;
  position: relative;
  box-shadow: 0 25px 50px -12px rgba(90, 62, 53, 0.15), 0 0 0 1px rgba(90, 62, 53, 0.08);
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.card-image {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 16px;
  overflow: hidden;
  margin-bottom: 1rem;
  background-color: #FFF5EB;
}

.card-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.card-icon {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
}

.card-draft-title,
.card-published-title,
.card-clock-heading,
.card-favorite-title {
  margin: 0;
  font-weight: 700;
  color: #5A3E35;
  font-size: 1.25rem;
}

.card-draft-desc,
.card-published-desc,
.card-clock-desc,
.card-favorite-desc {
  margin: 0;
  font-size: 0.95rem;
  color: #7B5F3B;
}

.card-bottom {
  margin-top: auto;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid #F0E7DC;
}

.card-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  background-color: #FFE4B5;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 600;
  color: #B45F04;
}

.card-pill svg {
  width: 14px;
  height: 14px;
}

.card-clock {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.card-clock-heading {
  margin: 0;
  font-weight: 600;
  color: #5A3E35;
  font-size: 1rem;
}

.card-clock-desc {
  display: flex;
  font-size: 2rem;
  font-weight: 800;
  color: #5A3E35;
}

.card-clock-labels {
  display: flex;
  gap: 1rem;
  font-size: 0.75rem;
  color: #7B5F3B;
  margin-top: 0.5rem;
}

.card-clock-labels span {
  opacity: 0.6;
}

.card-favorite {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.card-favorite-title {
  margin: 0;
  font-weight: 600;
  color: #5A3E35;
  font-size: 1rem;
  text-align: center;
}

.card-favorite-desc {
  margin: 0;
  font-size: 0.875rem;
  color: #7B5F3B;
  text-align: center;
}

/* Responsive */
@media (max-width: 1024px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
  }
  
  .card {
    aspect-ratio: 1;
  }
  
  .card-clock {
    flex-direction: column;
  }
  
  .card-clock-desc {
    font-size: 1.5rem;
  }
}
</style>