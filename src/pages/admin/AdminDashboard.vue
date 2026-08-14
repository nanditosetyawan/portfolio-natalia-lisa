<template>
  <div class="dashboard">
    <div class="dashboard-main">
      <div class="dashboard-row1">
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
                  <path d="M14 19H20C21.1046 19 22 18.1046 22 17V7C22 5.89543 21.1046 5 20 5H13.41C13.149 5 12.9011 5.10557 12.7071 5.29359L11 7H8C6.89543 7 6 7.89543 6 9V17C6 18.1046 6.89543 19 8 19H10M14 19L14 15C14 14.4477 14.4477 14 15 14H17C17.5523 14 18 14.4477 18 15V19M14 19H14.01M12 8V11C12 11.5523 12 12 12.5 12.5C13 13 13.55 13 14.06 12.95C14.55 12.9 14.89 12.44 14.89 11.89C14.89 11.42 14.55 11 14 10.5C13.49 10 12.99 9.97 12.5 9.97" stroke="currentColor" stroke-width="1.5" fill="none"/>
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
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M12 7v10M8 12h8" />
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
      </div>

      <div class="dashboard-row2">
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
  margin-bottom: 2rem;
  max-width: 1400px;
}

.dashboard-row2 {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 2rem;
  max-width: 1400px;
}

.card {
  background-color: #FFFFFF;
  border-radius: 18px;
  padding: 1.75rem;
  position: relative;
  box-shadow: 0 8px 25px -12px rgba(90, 62, 53, 0.12), 0 0 0 1px rgba(90, 62, 53, 0.06);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.card-image {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 0.75rem;
  background-color: #FFF5EB;
  display: flex;
  align-items: center;
  justify-content: center;
}

.card-image .illustration {
  opacity: 0.6;
}

.card-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.card-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.card-draft-title,
.card-published-title,
.card-clock-heading,
.card-favorite-title {
  margin: 0;
  font-weight: 700;
  color: #5A3E35;
  font-size: 1.125rem;
}

.card-draft-desc,
.card-published-desc,
.card-clock-desc,
.card-favorite-desc {
  margin: 0;
  font-size: 0.875rem;
  color: #7B5F3B;
}

.card-bottom {
  margin-top: auto;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding-top: 0.5rem;
  border-top: 1px solid #F0E7DC;
}

.card-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.2rem 0.4rem;
  background-color: #FFE4B5;
  border-radius: 16px;
  font-size: 0.625rem;
  font-weight: 600;
  color: #B45F04;
}

.card-pill svg {
  width: 12px;
  height: 12px;
}

.card-clock {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.card-clock-heading {
  margin: 0;
  font-weight: 600;
  color: #5A3E35;
  font-size: 0.875rem;
}

.card-clock-desc {
  display: flex;
  font-size: 1.5rem;
  font-weight: 800;
  color: #5A3E35;
  line-height: 1.2;
  letter-spacing: -0.02em;
  background-color: #FFF5EB;
  padding: 0.75rem 1rem;
  border-radius: 12px;
  align-self: flex-start;
}

.card-clock-labels {
  display: flex;
  gap: 1rem;
  font-size: 0.65rem;
  color: #7B5F3B;
  margin-top: 0.25rem;
}

.card-clock-labels span {
  opacity: 0.6;
}

.card-favorite {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  align-items: center;
  text-align: center;
}

.card-favorite-title {
  margin: 0;
  font-weight: 600;
  color: #5A3E35;
  font-size: 0.875rem;
}

.card-favorite-desc {
  margin: 0;
  font-size: 0.75rem;
  color: #7B5F3B;
}

/* Responsive */
@media (max-width: 1024px) {
  .dashboard-main {
    padding: 1.5rem;
  }
  
  .dashboard-row1,
  .dashboard-row2 {
    grid-template-columns: 1fr;
    margin-bottom: 1rem;
  }
  
  .dashboard-row2 {
    grid-template-columns: 1fr;
  }
}
</style>