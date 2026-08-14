<template>
  <div class="edit-page">
    <div class="edit-toolbar">
      <div class="toolbar-left">
        <h1 class="page-title">Edit</h1>
        <button class="tbar-btn undo-btn" disabled>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M9 21L4 16L9 11" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span>Undo</span>
        </button>
        <button class="tbar-btn redo-btn" disabled>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M15 21L20 16L15 11" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span>Redo</span>
        </button>
      </div>
      <div class="toolbar-right">
        <button class="tbar-btn save-btn" disabled>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M19 13.5V7C19 5.89543 18.1046 5 17 5H7C5.89543 5 5 5.89543 5 7V17C5 18.1046 5.89543 19 7 19H16C17.1046 19 18 18.1046 18 17V13.5Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M9 16L14 10L9 3V9H16V15H9V16Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span>Save</span>
        </button>
        <button class="tbar-btn preview-btn" disabled>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M1 12S5 5 12 5s11 7 11 7-4 7-11 7-11-7z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span>Preview</span>
        </button>
        <button class="tbar-btn publish-btn" disabled>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M14.5 7.5L19 12L14.5 16.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M4 5V6C4 6.53043 4.21071 7.03914 4.58579 7.41421C4.96086 7.78929 5.46957 8 6 8H13C13.5304 8 14 8.46957 14 9V14C14 14.5304 13.5304 15 13 15H6C5.46957 15 4.96086 15.2107 4.58579 15.5858C4.21071 15.9609 4 16.4696 4 17V18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span>Publish</span>
        </button>
      </div>
    </div>

    <div class="edit-canvas">
      <div class="control-panel">
        <h2 class="panel-title">Control Panel</h2>
        <p class="panel-hint">No element selected — select an element on the canvas to enable controls.</p>

        <div class="control-groups">
          <div class="control-group">
            <h3 class="group-title">Font</h3>
            <div class="control-row">
              <label>Font Family</label>
              <select class="ctrl-input ctrl-select" disabled><option>Inter</option></select>
            </div>
            <div class="control-row">
              <label>Font Size</label>
              <input type="range" class="ctrl-input ctrl-range" disabled>
            </div>
            <div class="control-row">
              <label>Font Weight</label>
              <select class="ctrl-input ctrl-select" disabled><option>Regular</option></select>
            </div>
          </div>

          <div class="control-group">
            <h3 class="group-title">Size / Spacing</h3>
            <div class="control-row">
              <label>Line Height</label>
              <input type="range" class="ctrl-input ctrl-range" disabled>
            </div>
            <div class="control-row">
              <label>Letter Spacing</label>
              <input type="range" class="ctrl-input ctrl-range" disabled>
            </div>
          </div>

          <div class="control-group">
            <h3 class="group-title">Color</h3>
            <div class="control-row">
              <label>Text Color</label>
              <div class="color-row">
                <input type="color" class="ctrl-input ctrl-color" disabled>
                <input type="text" class="ctrl-input ctrl-hex" placeholder="#000000" disabled>
              </div>
            </div>
          </div>

          <div class="control-group">
            <h3 class="group-title">Shadow</h3>
            <div class="control-row">
              <label>Box Shadow</label>
              <input type="checkbox" class="ctrl-input ctrl-checkbox" disabled>
            </div>
          </div>

          <div class="control-group">
            <h3 class="group-title">Hover</h3>
            <div class="control-row">
              <label>Hover State</label>
              <select class="ctrl-input ctrl-select" disabled><option>Default</option></select>
            </div>
          </div>

          <div class="control-group">
            <h3 class="group-title">X</h3>
            <div class="control-row">
              <input type="number" class="ctrl-input ctrl-number" placeholder="0" disabled>
            </div>
          </div>

          <div class="control-group">
            <h3 class="group-title">Y</h3>
            <div class="control-row">
              <input type="number" class="ctrl-input ctrl-number" placeholder="0" disabled>
            </div>
          </div>

          <div class="control-group">
            <h3 class="group-title">Width</h3>
            <div class="control-row">
              <input type="number" class="ctrl-input ctrl-number" placeholder="auto" disabled>
            </div>
          </div>

          <div class="control-group">
            <h3 class="group-title">Height</h3>
            <div class="control-row">
              <input type="number" class="ctrl-input ctrl-number" placeholder="auto" disabled>
            </div>
          </div>

          <div class="control-group">
            <h3 class="group-title">Rotate</h3>
            <div class="control-row">
              <input type="number" class="ctrl-input ctrl-number" placeholder="0" disabled>
            </div>
          </div>

          <div class="control-group">
            <h3 class="group-title">Layer / Z-index</h3>
            <div class="control-row">
              <input type="number" class="ctrl-input ctrl-number" placeholder="0" disabled>
            </div>
          </div>

          <div class="control-group">
            <h3 class="group-title">Lock</h3>
            <div class="control-row">
              <input type="checkbox" class="ctrl-input ctrl-checkbox" disabled>
            </div>
          </div>

          <div class="control-group">
            <h3 class="group-title">Hide</h3>
            <div class="control-row">
              <input type="checkbox" class="ctrl-input ctrl-checkbox" disabled>
            </div>
          </div>

          <div class="control-group">
            <h3 class="group-title">Duplicate</h3>
            <div class="control-row">
              <button class="ctrl-btn" disabled>Duplicate</button>
            </div>
          </div>

          <div class="control-group">
            <h3 class="group-title">Alignment</h3>
            <div class="control-row">
              <div class="alignment-grid">
                <button class="ctrl-btn align-btn" disabled>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" stroke-width="2"/>
                    <rect x="6" y="7" width="12" height="10" fill="currentColor"/>
                  </svg>
                </button>
                <button class="ctrl-btn align-btn" disabled>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <line x1="12" y1="4" x2="12" y2="20" stroke="currentColor" stroke-width="2"/>
                    <rect x="9" y="6" width="6" height="12" fill="currentColor"/>
                  </svg>
                </button>
                <button class="ctrl-btn align-btn" disabled>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" stroke-width="2"/>
                    <rect x="8" y="9" width="8" height="6" fill="currentColor"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div class="control-group">
            <h3 class="group-title">Snap</h3>
            <div class="control-row">
              <input type="checkbox" class="ctrl-input ctrl-checkbox" disabled>
            </div>
          </div>

          <div class="control-group">
            <h3 class="group-title">Grid</h3>
            <div class="control-row">
              <input type="checkbox" class="ctrl-input ctrl-checkbox" disabled>
            </div>
          </div>
        </div>
      </div>

      <div class="canvas-wrapper">
        <div class="canvas-header">
          <h2 class="canvas-title">Preview Canvas</h2>
          <span class="canvas-hint">Current website state preview (placeholder)</span>
        </div>
        <div class="canvas-border">
          <div class="canvas-scroll">
            <div class="website-mockup">
              <header class="mock-header">
                <div class="mock-logo">Tali-Temali</div>
                <nav class="mock-nav">
                  <a href="#" class="mock-nav-link">Home</a>
                  <a href="#" class="mock-nav-link">About</a>
                  <a href="#" class="mock-nav-link">Experience</a>
                  <a href="#" class="mock-nav-link">Contact</a>
                </nav>
              </header>

              <main class="mock-main">
                <div class="mock-section">
                  <h2 class="mock-section-title">Welcome</h2>
                  <p class="mock-section-text">
                    Portfolio website placeholder preview.
                  </p>
                </div>
              </main>

              <footer class="mock-footer">
                <p>© 2026 Tali-Temali</p>
              </footer>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
</script>

<style scoped>
.edit-page {
  min-height: calc(100vh - 72px);
  background-color: #f8fafc;
  padding: 2rem;
  font-family: 'Inter', system-ui, sans-serif;
}

.edit-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e2e8f0;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.page-title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  color: #0f172a;
}

.tbar-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s ease;
  border: none;
  cursor: pointer;
}

.tbar-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.undo-btn { background-color: #1e293b; color: #ffffff; }
.undo-btn:hover:not(:disabled) { background-color: #0f172a; }

.redo-btn { background-color: #94a3b8; color: #0f172a; }

.save-btn, .preview-btn, .publish-btn { background-color: #0f172a; color: #ffffff; }
.save-btn:hover:not(:disabled),
.preview-btn:hover:not(:disabled),
.publish-btn:hover:not(:disabled) { background-color: #1e293b; }

.edit-canvas {
  display: flex;
  gap: 2rem;
  height: calc(100vh - 144px);
  overflow: hidden;
}

.control-panel {
  width: 320px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  padding: 1.5rem;
  overflow-y: auto;
  flex-shrink: 0;
}

.panel-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: #0f172a;
  margin: 0 0 0.75rem 0;
}

.panel-hint {
  font-size: 0.875rem;
  color: #94a3b8;
  margin: 0 0 1rem 0;
  font-style: italic;
}

.control-groups {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.group-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: #475569;
  margin: 0;
}

.control-row {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.control-row label {
  font-size: 0.8rem;
  color: #64748b;
}

.ctrl-input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #cbd5e0;
  border-radius: 0.375rem;
  background-color: #f8fafc;
  font-size: 0.875rem;
  color: #1e293b;
}

.ctrl-input:disabled {
  background-color: #f8fafc;
  cursor: not-allowed;
}

.ctrl-select {
  padding: 0.5rem;
  border-radius: 0.375rem;
  border: 1px solid #cbd5e0;
  background-color: #f8fafc;
  font-size: 0.875rem;
  color: #475569;
  cursor: not-allowed;
}

.ctrl-range {
  width: 100%;
  height: 0.5rem;
  -webkit-appearance: none;
  background: #e2e8f0;
  border-radius: 9999px;
  outline: none;
  margin: 0.25rem 0;
}

.ctrl-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 1rem;
  height: 1rem;
  border-radius: 50%;
  background-color: #94a3b8;
  cursor: not-allowed;
}

.ctrl-checkbox {
  width: 1rem;
  height: 1rem;
  cursor: not-allowed;
}

.color-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.ctrl-color {
  width: 32px;
  height: 24px;
  padding: 0;
  border: none;
  cursor: not-allowed;
}

.ctrl-hex {
  flex: 1;
  width: auto;
  padding: 0.375rem 0.5rem;
}

.ctrl-btn {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid #cbd5e0;
  border-radius: 0.375rem;
  background-color: #f8fafc;
  font-size: 0.875rem;
  color: #64748b;
  cursor: not-allowed;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.ctrl-btn:disabled {
  cursor: not-allowed;
}

.alignment-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.align-btn {
  width: 100%;
  aspect-ratio: 1;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: not-allowed;
}

.canvas-wrapper {
  flex: 1;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  padding: 1.5rem;
  overflow-y: auto;
}

.canvas-header {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-bottom: 1rem;
}

.canvas-title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: #0f172a;
}

.canvas-hint {
  font-size: 0.8rem;
  color: #94a3b8;
}

.canvas-border {
  border: 2px dashed #cbd5e0;
  border-radius: 0.5rem;
  overflow: hidden;
  background: white;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.canvas-scroll {
  max-height: calc(100vh - 220px);
  overflow-y: auto;
}

.website-mockup {
  min-width: 320px;
  display: flex;
  flex-direction: column;
  background-color: #ffffff;
}

.mock-header {
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid #e2e8f0;
  background-color: #f8fafc;
}

.mock-logo {
  font-size: 1.25rem;
  font-weight: 700;
  color: #0f172a;
}

.mock-nav {
  display: flex;
  gap: 1.5rem;
  margin-top: 0.75rem;
}

.mock-nav-link {
  color: #475569;
  text-decoration: none;
  font-size: 0.95rem;
  font-weight: 500;
}

.mock-nav-link:hover {
  color: #0f172a;
  text-decoration: underline;
}

.mock-main {
  padding: 1.5rem;
}

.mock-section {
  padding: 1.5rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  background-color: #f8fafc;
}

.mock-section-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: #0f172a;
  margin-bottom: 0.75rem;
}

.mock-section-text {
  font-size: 1rem;
  color: #475569;
  line-height: 1.6;
}

.mock-footer {
  padding: 1.25rem 1.5rem;
  border-top: 1px solid #e2e8f0;
  background-color: #f8fafc;
}

.mock-footer p {
  margin: 0;
  font-size: 0.875rem;
  color: #64748b;
}
</style>