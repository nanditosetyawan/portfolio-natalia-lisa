<template>
  <div class="messages-page">
    <div class="page-title">Messages</div>
    <div class="messages-placeholder">
      <div class="messages-icon">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
          <path d="M4 4H20C21.1046 4 22 4.89543 22 6V18C22 19.1046 21.1046 20 20 20H6C4.89543 20 4 19.1046 4 18V6C4 4.89543 4.89543 4 6 4H8M8 8L12 12M12 12L16 8M12 12V4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <h3 class="messages-title">Messages</h3>
      <p class="messages-text">
        Message management functionality is not yet implemented.
      </p>
      <p class="messages-subtext">
        This is a placeholder page.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
</script>

<style scoped>
.messages-page {
  font-family: 'Inter', system-ui, sans-serif;
}

.page-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #0f172a;
  margin-bottom: 1.5rem;
}

.messages-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 4rem 2rem;
  text-align: center;
}

.messages-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #cbd5e0;
}

.messages-title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
  color: #0f172a;
}

.messages-text {
  margin: 0;
  font-size: 1rem;
  color: #64748b;
}

.messages-subtext {
  margin: 0;
  font-size: 0.875rem;
  color: #94a3b8;
  font-style: italic;
}
</style>