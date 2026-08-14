<template>
  <div class="dashboard">
    <div class="dashboard-main">
      <div class="dashboard-row1">
        <div class="card card-draft">
          <div class="card-image">
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none" class="illustration">
              <g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <line x1="10" y1="20" x2="54" y2="20"/>
                <line x1="10" y1="32" x2="54" y2="32"/>
                <line x1="10" y1="44" x2="54" y2="44"/>
              </g>
            </svg>
          </div>
          <div class="card-content">
            <div class="card-header">
              <span class="card-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M14 19H20C21.1046 19 22 18.1046 22 17V7C22 5.89543 21.1046 5 20 5H13.41C13.149 5 12.9011 5.10557 12.7071 5.29359L11 7H8C6.89543 7 6 7.89543 6 9V17C6 18.1046 6.89543 19 8 19H10M14 19L14 15C14 14.4477 14.4477 14 15 14H17C17.5523 14 18 14.4477 18 15V19M14 19H14.01M12 8V11C12 11.5523 12 12 12.5 12.5C13 13 13.55 13 14.06 12.95C14.55 12.9 14.89 12.44 14.89 11.89C14.89 11.42 14.55 11 14 10.5C13.49 10 12.99 9.97 12.5 9.97" stroke="currentColor" stroke-width="1.5" fill="none"/>
                </svg>
              </span>
              <h2 class="card-draft-title">Draf</h2>
            </div>
            <p class="card-draft-desc">3 item draft</p>
            <div class="card-bottom">
              <span class="card-pill">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20 6L9 17l5 5"></path>
                </svg>
                <span>3</span>
              </span>
            </div>
          </div>
        </div>

        <div class="card card-published">
          <div class="card-image">
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none" class="illustration">
              <g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <path d="M23 40c0-12 7-20 14-20s14 8 14 20" />
                <path d="M40 23L40 38L58 40l-6 10L51 53l5 5L40 40Z" />
                <circle cx="40" cy="35" r="2" fill="currentColor"/>
                <circle cx="40" cy="45" r="2" fill="currentColor"/>
                <circle cx="35" cy="40" r="2" fill="currentColor"/>
                <circle cx="45" cy="40" r="2" fill="currentColor"/>
              </g>
            </svg>
          </div>
          <div class="card-content">
            <div class="card-header">
              <span class="card-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M12 7v10M8 12h8" />
                </svg>
              </span>
              <h2 class="card-published-title">Published</h2>
            </div>
            <p class="card-published-desc">1 publication</p>
            <div class="card-bottom">
              <span class="card-pill">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 22v-6l-3-3l5-5"></path>
                  <circle cx="12" cy="10" r="2" fill="currentColor"/>
                </svg>
                <span>1</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      <div class="dashboard-row2">
        <div class="card card-clock">
          <div class="card-image">
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none" class="illustration">
              <g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <circle cx="32" cy="32" r="28" />
                <polyline points="32 16 32 40 24 36 56 36" />
                <polyline points="16 32 32 44 36 56 44 56" />
                <polyline points="32 56 32 72 56 70 56 70" />
                <polyline points="56 32 70 44 70 56 70 56" />
                <text x="32" y="45" font-family="system-ui, sans-serif" font-size="12" font-weight="bold" fill="currentColor">01</text>
                <text x="32" y="60" font-family="system-ui, sans-serif" font-size="12" fill="currentColor">23</text>
                <text x="56" y="52" font-family="system-ui, sans-serif" font-size="8" fill="currentColor">:</text>
                <text x="32" y="65" font-family="system-ui, sans-serif" font-size="12" fill="currentColor">45</text>
                <text x="44" y="56" font-family="system-ui, sans-serif" font-size="8" fill="currentColor">JAM</text>
              </g>
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
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none" class="illustration">
              <g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <path d="M60 18L51.92 35.46L36 30L28 42L18 33L20.08 18L60 18Z" />
                <path d="M36 28L24 36L24 52L36 60L36 28Z" />
                <path d="M36 48L52 56L52 24L36 16L36 48Z" />
              </g>
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
</script>

<style scoped>
.dashboard {
  min-height: 100vh;
  background-color: #FAF3E0;
  font-family: 'Inter', system-ui, sans-serif;
}

.dashboard-main {
  padding: 2rem;
}

.dashboard-row1 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  margin-bottom: 1.5rem;
  max-width: 1400px;
}

.dashboard-row2 {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 1.5rem;
  max-width: 1400px;
}

.card {
  background-color: #FFFFFF;
  border-radius: 16px;
  padding: 1.5rem;
  position: relative;
  box-shadow: 0 6px 20px -8px rgba(90, 62, 53, 0.1), 0 0 0 1px rgba(90, 62, 53, 0.05);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.card-image {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 0.5rem;
  background-color: #FFF5EB;
  display: flex;
  align-items: center;
  justify-content: center;
}

.card-image .illustration {
  opacity: 0.5;
}

.card-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.card-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.card-draft-title,
.card-published-title,
.card-clock-heading,
.card-favorite-title {
  margin: 0;
  font-weight: 700;
  color: #5A3E35;
  font-size: 1rem;
}

.card-draft-desc,
.card-published-desc,
.card-clock-desc,
.card-favorite-desc {
  margin: 0;
  font-size: 0.75rem;
  color: #7B5F3B;
}

.card-bottom {
  margin-top: auto;
  display: flex;
  align-items: center;
  gap: 0.15rem;
  padding-top: 0.25rem;
  border-top: 1px solid #F0E7DC;
}

.card-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.1rem;
  padding: 0.15rem 0.3rem;
  background-color: #FFE4B5;
  border-radius: 12px;
  font-size: 0.5rem;
  font-weight: 600;
  color: #B45F04;
}

.card-pill svg {
  width: 10px;
  height: 10px;
}

.card-clock {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.card-clock-heading {
  margin: 0;
  font-weight: 600;
  color: #5A3E35;
  font-size: 0.75rem;
}

.card-clock-desc {
  display: flex;
  font-size: 1.25rem;
  font-weight: 800;
  color: #5A3E35;
  line-height: 1.2;
  letter-spacing: -0.02em;
  background-color: #FFF5EB;
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  align-self: flex-start;
}

.card-clock-labels {
  display: flex;
  gap: 0.5rem;
  font-size: 0.45rem;
  color: #7B5F3B;
  margin-top: 0.1rem;
}

.card-clock-labels span {
  opacity: 0.6;
}

.card-favorite {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  align-items: center;
  text-align: center;
}

.card-favorite-title {
  margin: 0;
  font-weight: 600;
  color: #5A3E35;
  font-size: 0.75rem;
}

.card-favorite-desc {
  margin: 0;
  font-size: 0.6rem;
  color: #7B5F3B;
}

/* Responsive */
@media (max-width: 1024px) {
  .dashboard-main {
    padding: 1rem;
  }
  
  .dashboard-row1,
  .dashboard-row2 {
    grid-template-columns: 1fr;
    margin-bottom: 0.75rem;
  }
  
  .dashboard-row2 {
    grid-template-columns: 1fr;
  }
}
</style>