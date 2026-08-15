<template>
  <div class="edit-page">
    <div class="edit-canvas">
      <aside class="control-panel">
        <h2 class="control-panel-title">Control Panel<span class="control-panel-underline"></span></h2>
        <nav class="control-nav">
          <!-- FONT FOLD -->
          <div class="fold">
            <button class="fold-header" @click="expanded.font = !expanded.font" type="button">
              <span class="fold-title">FONT</span>
              <ChevronDown class="chevron" :class="{ rotated: expanded.font }" />
            </button>
            <div v-show="expanded.font" class="fold-content">
              <!-- Font Family Dropdown -->
              <div class="field-row">
                <label class="field-label">Font Family</label>
                <select class="input-field">
                  <option>Inter</option>
                  <option>Poppins</option>
                  <option>Plus Jakarta Sans</option>
                </select>
              </div>

              <!-- Size + Spacing Grid -->
              <div class="field-row grid-two-col">
                <div>
                  <label class="field-label">Size</label>
                  <input type="number" class="input-field" step="1" placeholder="16" />
                </div>
                <div>
                  <label class="field-label">Spacing</label>
                  <input type="number" class="input-field" step="0.5" placeholder="0" />
                </div>
              </div>

              <!-- Color -->
              <div class="field-row">
                <label class="field-label">Color</label>
                <input type="color" class="input-color" />
              </div>

              <!-- Shadow Section -->
              <div class="field-row">
                <label class="field-label">Shadow</label>
                <div class="shadow-enable">
                  <input type="checkbox" id="shadow-normal" v-model="shadowNormalEnabled" />
                  <label for="shadow-normal">On</label>
                </div>
              </div>

              <div v-show="shadowNormalEnabled" class="field-row">
                <label class="field-label">Shadow Color</label>
                <input type="color" class="input-color" />
              </div>

              <div v-show="shadowNormalEnabled" class="field-row grid-two-col">
                <div>
                  <label class="field-label">Offset X</label>
                  <input type="number" class="input-field" step="1" placeholder="0" />
                </div>
                <div>
                  <label class="field-label">Offset Y</label>
                  <input type="number" class="input-field" step="1" placeholder="0" />
                </div>
              </div>

              <div v-show="shadowNormalEnabled" class="field-row grid-two-col">
                <div>
                  <label class="field-label">Blur</label>
                  <input type="number" class="input-field" step="1" placeholder="0" />
                </div>
                <div>
                  <label class="field-label">Spread</label>
                  <input type="number" class="input-field" step="1" placeholder="0" />
                </div>
              </div>

              <!-- Hover Color -->
              <div class="field-row">
                <label class="field-label">Hover Color</label>
                <input type="color" class="input-color" />
              </div>

              <!-- Hover Shadow -->
              <div class="field-row">
                <label class="field-label">Hover Shadow</label>
                <div class="shadow-enable">
                  <input type="checkbox" id="shadow-hover" v-model="shadowHoverEnabled" />
                  <label for="shadow-hover">On</label>
                </div>
              </div>

              <div v-show="shadowHoverEnabled" class="field-row">
                <label class="field-label">Shadow Color</label>
                <input type="color" class="input-color" />
              </div>

              <div v-show="shadowHoverEnabled" class="field-row grid-two-col">
                <div>
                  <label class="field-label">Offset X</label>
                  <input type="number" class="input-field" step="1" placeholder="0" />
                </div>
                <div>
                  <label class="field-label">Offset Y</label>
                  <input type="number" class="input-field" step="1" placeholder="0" />
                </div>
              </div>

              <div v-show="shadowHoverEnabled" class="field-row grid-two-col">
                <div>
                  <label class="field-label">Blur</label>
                  <input type="number" class="input-field" step="1" placeholder="0" />
                </div>
                <div>
                  <label class="field-label">Spread</label>
                  <input type="number" class="input-field" step="1" placeholder="0" />
                </div>
              </div>

              <!-- Position -->
              <div class="field-row">
                <label class="field-label">Position</label>
              </div>

              <div class="field-row grid-two-col">
                <div>
                  <label class="field-label">X</label>
                  <input type="number" class="input-field" step="0.5" placeholder="0" />
                </div>
                <div>
                  <label class="field-label">Y</label>
                  <input type="number" class="input-field" step="0.5" placeholder="0" />
                </div>
              </div>

              <!-- Rotate -->
              <div class="field-row">
                <label class="field-label">Rotate</label>
                <input type="number" class="input-field" step="1" placeholder="0" />
              </div>

              <!-- Z-index -->
              <div class="field-row">
                <label class="field-label">Z-index</label>
                <input type="number" class="input-field" step="1" placeholder="1" />
              </div>
            </div>
          </div>

          <!-- IMAGE FOLD -->
          <div class="fold">
            <button class="fold-header" @click="expanded.image = !expanded.image" type="button">
              <span class="fold-title">IMAGE</span>
              <ChevronDown class="chevron" :class="{ rotated: expanded.image }" />
            </button>
            <div v-show="expanded.image" class="fold-content">
              <div class="field-row upload-row">
                <label class="field-label">Upload</label>
                <input type="file" class="input-file" accept="image/*" />
              </div>
              <div class="field-row">
                <label class="field-label">Hover</label>
                <input type="color" class="input-color" />
              </div>
              <div class="field-row">
                <label class="field-label">X</label>
                <input type="number" class="input-field" step="0.5" placeholder="0" />
              </div>
              <div class="field-row">
                <label class="field-label">Y</label>
                <input type="number" class="input-field" step="0.5" placeholder="0" />
              </div>
              <div class="field-row">
                <label class="field-label">Outline</label>
                <input type="color" class="input-color" />
              </div>
              <div class="field-row">
                <label class="field-label">Change</label>
                <input type="file" class="input-file" accept="image/*" />
              </div>
              <div class="field-row">
                <label class="field-label">Rotate</label>
                <input type="number" class="input-field" step="1" placeholder="0" />
              </div>
            </div>
          </div>
        </nav>
      </aside>

      <main class="canvas-container">
        <div class="canvas-border">
          <div class="canvas-scroll">
            <div class="canvas-placeholder">
              <div class="placeholder-3d">
                <Editor3D />
              </div>
              <h2 class="placeholder-title">Mulai mengedit halaman</h2>
              <div class="placeholder-chips">
                <span class="chip">Drag</span>
                <span class="chip">Resize</span>
                <span class="chip">Position</span>
                <span class="chip">Rotate</span>
                <span class="chip">Layer</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ChevronDown } from 'lucide-vue-next'

const expanded = ref({
  font: true,
  image: false,
})

const shadowNormalEnabled = ref(false)
const shadowHoverEnabled = ref(false)

const Editor3D = {
  template:
    '<svg width="64" height="64" viewBox="0 0 48 48" fill="none"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="8" width="32" height="32" rx="4"/><path d="M8 20h32M8 28h32M16 8v8M32 8v8"></g></svg>',
}
</script>

<style scoped>
.edit-page {
  min-height: calc(100vh - 72px);
  background-color: #F6F4E8;
  font-family: 'Inter', system-ui, sans-serif;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* ===== HEADER ===== */
.edit-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 2rem;
}

.edit-title {
  margin: 0;
  font-size: 2rem;
  font-weight: 800;
  color: #5A3E35;
  letter-spacing: -0.02em;
  position: relative;
  display: inline-block;
}

.edit-underline {
  display: inline-block;
  width: 60px;
  height: 4px;
  background-color: #5A3E35;
  border-radius: 2px;
  margin-left: 8px;
  vertical-align: bottom;
}

/* ===== TOOLBAR ===== */
.edit-toolbar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.tbar-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.4rem 0.5rem;
  border: none;
  border-radius: 9999px;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: not-allowed;
  opacity: 0.5;
  transition: all 0.2s ease;
}

.tbar-btn:disabled {
  cursor: not-allowed;
}

.tbar-undo,
.tbar-redo {
  background: transparent;
  color: #7B5F3B;
  width: 36px;
  height: 36px;
  padding: 0;
  justify-content: center;
}

.tbar-undo:hover:not(:disabled),
.tbar-redo:hover:not(:disabled) {
  background: transparent;
  color: #5A3E35;
}

.tbar-save {
  background: rgba(255, 255, 255, 0.8);
  color: #5A3E35;
  border: 1px solid rgba(138, 124, 110, 0.3);
}

.tbar-save:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.9);
}

.tbar-publish {
  background: #FF9A86;
  color: #FFFFFF;
}

.tbar-publish:hover:not(:disabled) {
  background: #FF8572;
}

/* ===== MAIN CANVAS AREA ===== */
.edit-canvas {
  display: flex;
  gap: 24px;
  padding: 0 2rem;
  height: calc(100vh - 160px);
  flex: 1;
}

/* ===== CONTROL PANEL ===== */
.control-panel {
  width: 320px;
  flex-shrink: 0;
  background-color: #F6F4E8;
  border-radius: 18px;
  padding: 20px;
  box-shadow: 0 4px 12px -4px rgba(90, 62, 53, 0.05);
  overflow-y: auto;
}

.control-panel-title {
  margin: 0 0 14px;
  font-size: 1.25rem;
  font-weight: 800;
  color: #5A3E35;
  position: relative;
  display: inline-block;
}

.control-panel-underline {
  display: inline-block;
  width: 64px;
  height: 4px;
  background-color: #5A3E35;
  border-radius: 2px;
  margin-left: 6px;
  vertical-align: bottom;
}

.control-nav {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* ===== FOLDS ===== */
.fold-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0.6rem 0.75rem;
  border: none;
  background: transparent;
  font-size: 0.7rem;
  font-weight: 700;
  color: #7B5F3B;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.fold-header:hover {
  background-color: rgba(90, 62, 53, 0.03);
  color: #5A3E35;
}

.fold-title {
  letter-spacing: 0.1em;
}

.chevron {
  width: 14px;
  height: 14px;
  transition: transform 0.2s ease;
  color: #7B5F3B;
}

.chevron.rotated {
  transform: rotate(180deg);
}

.fold-header:hover .chevron {
  color: #5A3E35;
}

.fold-content {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 8px;
  padding-left: 4px;
}

/* ===== FIELD ROWS ===== */
.field-row {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.upload-row {
  gap: 0.5rem;
}

.grid-two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

.field-label {
  font-size: 0.7rem;
  font-weight: 600;
  color: #7B5F3B;
  letter-spacing: 0.05em;
}

.shadow-enable {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  margin-top: 0.15rem;
}

.shadow-enable input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.shadow-enable label {
  font-size: 0.75rem;
  font-weight: 500;
  color: #7B5F3B;
  cursor: pointer;
}

/* ===== INPUT FIELDS ===== */
.input-field {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid rgba(90, 62, 53, 0.2);
  border-radius: 8px;
  background: #FFFFFF;
  color: #5A3E35;
  font-size: 0.85rem;
  font-family: inherit;
  box-sizing: border-box;
  transition: all 0.2s ease;
}

.input-field:focus {
  outline: none;
  border-color: #5A3E35;
  box-shadow: 0 0 0 3px rgba(90, 62, 53, 0.1);
}

.input-field::placeholder {
  color: #A8968A;
}

.input-color {
  width: 100%;
  height: 40px;
  padding: 2px;
  border: 1px solid rgba(90, 62, 53, 0.2);
  border-radius: 8px;
  background: #FFFFFF;
  cursor: pointer;
  box-sizing: border-box;
  transition: all 0.2s ease;
}

.input-color:focus {
  outline: none;
  border-color: #5A3E35;
  box-shadow: 0 0 0 3px rgba(90, 62, 53, 0.1);
}

.input-file {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px dashed rgba(90, 62, 53, 0.3);
  border-radius: 8px;
  background: rgba(255, 245, 235, 0.5);
  color: #5A3E35;
  font-size: 0.8rem;
  font-family: inherit;
  cursor: pointer;
  box-sizing: border-box;
  transition: all 0.2s ease;
}

.input-file:hover {
  border-color: #5A3E35;
  background: rgba(255, 245, 235, 0.8);
}

.input-file:focus {
  outline: none;
  border-color: #5A3E35;
  box-shadow: 0 0 0 3px rgba(90, 62, 53, 0.1);
}

/* ===== PREVIEW CANVAS ===== */
.canvas-container {
  flex: 1;
  display: flex;
  justify-content: flex-start;
}

.canvas-border {
  width: 100%;
  max-width: 900px;
  border: 2px dashed rgba(0, 0, 0, 0.1);
  border-radius: 24px;
  background: white;
  overflow: hidden;
}

.canvas-scroll {
  max-height: calc(100vh - 200px);
  overflow-y: auto;
  overflow-x: hidden;
  padding: 20px;
}

.canvas-placeholder {
  min-height: 720px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  text-align: center;
  padding: 2rem;
  color: #7B5F3B;
}

/* ===== PLACEHOLDER ===== */
.placeholder-3d {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 80px;
  border-radius: 12px;
  background-color: #FFF5EB;
  color: #7B5F3B;
  opacity: 0.8;
}

.placeholder-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: #5A3E35;
  letter-spacing: -0.01em;
}

.placeholder-chips {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.chip {
  display: inline-flex;
  align-items: center;
  padding: 0.3rem 0.7rem;
  border-radius: 9999px;
  font-size: 0.7rem;
  font-weight: 500;
  color: #7B5F3B;
  background-color: rgba(90, 62, 53, 0.05);
  border: 1px solid rgba(90, 62, 53, 0.1);
  cursor: not-allowed;
  opacity: 0.7;
}
</style>