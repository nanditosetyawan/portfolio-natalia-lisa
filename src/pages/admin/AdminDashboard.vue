<template>
  <div class="dashboard">
    <div class="dashboard-main">
      <div class="dashboard-row1">
        <div class="card card-draft">
          <div class="card-image">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" class="illustration">
              <g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M16 12H8C7.44772 12 7 12.4477 7 13V39C7 39.5523 7.44772 40 8 40H16C16.5523 40 17 39.5523 17 39V13C17 12.4477 16.5523 12 16 12Z"/>
                <path d="M24 16H8"/>
                <path d="M20 24H8"/>
                <path d="M16 32H8"/>
                <path d="M16 12V20"/>
              </g>
            </svg>
          </div>
          <div class="card-content">
            <div class="card-header">
              <span class="card-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M14 19H20C21.1046 19 22 18.1046 22 17V7C22 5.89543 21.1046 5 20 5H13.41C13.149 5 12.9011 5.10557 12.7071 5.29359L11 7H8C6.89543 7 6 7.89543 6 9V17C6 18.1046 6.89543 19 8 19H10M14 19L14 15C14 14.4477 14.4477 14 15 14H17C17.5523 14 18 14.4477 18 15V19M14 19H14.01M12 8V11C12 11.5523 12 12 12.5 12.5C13 13 13.55 13 14.06 12.95C14.55 12.9 14.89 12.44 14.89 11.89C14.89 11.42 14.55 11 14 10.5C13.49 10 12.99 9.97 12.5 9.97" stroke="currentColor" stroke-width="1.5" fill="none"/>
                </svg>
              </span>
              <h2 class="card-draft-title">Draf</h2>
            </div>
            <p class="card-draft-desc">3 item draft</p>
            <div class="card-bottom">
              <span class="card-pill">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20 6L9 17l5 5"></path>
                </svg>
                <span>3</span>
              </span>
            </div>
          </div>
        </div>

        <div class="card card-published">
          <div class="card-image">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" class="illustration">
              <g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="12" y="12" width="24" height="24" rx="2"/>
                <path d="M16 20H32"/>
                <path d="M16 16H32"/>
                <path d="M16 24H32"/>
                <path d="M20 32V28H28V32"/>
              </g>
            </svg>
          </div>
          <div class="card-content">
            <div class="card-header">
              <span class="card-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 3H21C21.5523 3 22 3.44772 22 4V20C22 20.5523 21.5523 21 21 21H3C2.44772 21 2 20.5523 2 20V4C2 3.44772 2.44772 3 3 3Z"/>
                  <path d="M9 8L15 12L9 16V8Z"/>
                </svg>
              </span>
              <h2 class="card-published-title">Published</h2>
            </div>
            <p class="card-published-desc">1 publication</p>
            <div class="card-bottom">
              <span class="card-pill">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 22L12 6L9 9L12 12L15 9L12 6"/>
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
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" class="illustration">
              <g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="24" cy="24" r="22"/>
                <polyline points="24 12 24 28 18 34 42 34"/>
                <polyline points="12 24 18 28 18 42 24 42"/>
                <polyline points="24 36 24 48 30 46 42 46"/>
                <polyline points="42 24 46 28 46 42 42 42"/>
                <text x="24" y="31" font-family="system-ui, sans-serif" font-size="8" font-weight="bold" fill="currentColor">01</text>
                <text x="24" y="39" font-family="system-ui, sans-serif" font-size="8" fill="currentColor">23</text>
                <text x="38" y="36" font-family="system-ui, sans-serif" font-size="6" fill="currentColor">:</text>
                <text x="24" y="44" font-family="system-ui, sans-serif" font-size="8" fill="currentColor">45</text>
                <text x="34" y="37" font-family="system-ui, sans-serif" font-size="6" fill="currentColor">JAM</text>
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
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" class="illustration">
              <g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M40 18L36 26L24 22L20 34L32 38L36 46L44 38L48 34L40 18Z"/>
                <path d="M24 30L16 38L16 46L24 50L24 38Z"/>
                <path d="M24 38L32 46L40 38L32 30L24 38Z"/>
              </g>
            </svg>
          </div>
          <div class="card-content">
            <div class="card-header">
              <span class="card-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z"/>
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
  border-radius: 20px;
  padding: 1.5rem;
  position: relative;
  box-shadow: 0 8px 25px -12px rgba(90, 62, 53, 0.1), 0 0 0 1px rgba(90, 62, 53, 0.05);
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
  opacity: 0.7;
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
  font-size: 0.625rem;
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
  border-radius: 10px;
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
  font-size: 0.875rem;
}

.card-favorite-desc {
  margin: 0;
  font-size: 0.6rem;
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