<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { Check, Copy, Palette, Plus, Search, Trash2, X } from 'lucide-vue-next'
import {
  buttonSizeRegistry,
  buttonStyleRegistry,
  designTokenRegistry,
  reusableComponentRegistry,
  reusableSectionRegistry,
  typographyRoleRegistry
} from '../../../editor/designSystemRegistry'
import { useDesignSystemStore } from '../../../stores/designSystem'
import type { EditorObjectType, EditorValue } from '../../../types/editor'
import type { ButtonSizeId, ButtonVariantId, TypographyRoleId } from '../../../types/designSystem'

const props = defineProps<{
  open: boolean
  selectedObjectId: string
  selectedObjectType: EditorObjectType | ''
  selectedSection: string
  selectedCapabilities: string[]
  availableSections: string[]
}>()

const emit = defineEmits<{
  close: []
  tokenChange: [payload: { tokenId: string; value: EditorValue }]
  themePreview: [themeId: string]
  themeActivate: [themeId: string]
  typographyChange: [payload: { roleId: TypographyRoleId; styleKey: string }]
  typographyApply: [roleId: TypographyRoleId]
  buttonApply: [payload: { variantId: ButtonVariantId; sizeId: ButtonSizeId }]
  componentApply: [componentId: string]
  sectionSelect: [section: string]
  sectionTemplateSave: []
  sectionTemplateApply: [templateId: string]
  sectionTemplateDelete: [templateId: string]
  componentPresetSave: []
  componentPresetApply: [presetId: string]
}>()

const designSystem = useDesignSystemStore()
designSystem.initialize()

type PanelTab = 'theme' | 'typography' | 'buttons' | 'components' | 'sections' | 'templates' | 'audit'
const activeTab = ref<PanelTab>('theme')
const dialog = ref<HTMLElement | null>(null)
const themeName = ref('')
const newThemeName = ref('')
const selectedRole = ref<TypographyRoleId>('paragraph')
const selectedVariant = ref<ButtonVariantId>('primary')
const selectedSize = ref<ButtonSizeId>('medium')
const componentSearch = ref('')
const feedback = ref('')

const theme = computed(() => designSystem.previewTheme)
const role = computed(() => theme.value.typography[selectedRole.value])
const filteredComponents = computed(() => {
  const query = componentSearch.value.trim().toLowerCase()
  return reusableComponentRegistry.filter((component) => !query || [component.label, component.id, ...component.keywords].some((value) => value.toLowerCase().includes(query)))
})
const selectedSupportsTypography = computed(() => props.selectedCapabilities.includes('typography'))
const selectedSupportsButton = computed(() => props.selectedObjectType === 'Button' || props.selectedCapabilities.includes('button'))
const buttonPreviewStyle = computed(() => ({
  borderColor: String(theme.value.tokens['color-primary']),
  borderRadius: String(theme.value.tokens['radius-global']),
  background: String(theme.value.tokens['color-primary']),
  color: String(theme.value.tokens['color-surface'])
}))

watch(() => props.open, async (open) => {
  if (!open) return
  themeName.value = theme.value.name
  feedback.value = ''
  await nextTick()
  dialog.value?.focus()
})

watch(() => theme.value.id, () => { themeName.value = theme.value.name })

function updateToken(tokenId: string, event: Event): void {
  const input = event.target as HTMLInputElement
  const token = designTokenRegistry.find((candidate) => candidate.id === tokenId)
  if (!token) return
  const value: EditorValue = token.kind === 'duration' || token.kind === 'typography-scale' ? Number(input.value) : input.value
  const error = designSystem.updateToken(theme.value.id, tokenId, value)
  feedback.value = error ?? `${token.label} updated.`
  if (!error) emit('tokenChange', { tokenId, value })
}

function createTheme(): void {
  const created = designSystem.createTheme(newThemeName.value || 'Untitled Theme')
  newThemeName.value = ''
  themeName.value = created.name
  feedback.value = `Created ${created.name}.`
  emit('themeActivate', created.id)
}

function duplicateTheme(): void {
  const created = designSystem.duplicateTheme(theme.value.id)
  if (!created) return
  themeName.value = created.name
  feedback.value = `Duplicated as ${created.name}.`
  emit('themeActivate', created.id)
}

function renameTheme(): void {
  if (!designSystem.renameTheme(theme.value.id, themeName.value)) return
  feedback.value = 'Theme renamed.'
}

function deleteTheme(): void {
  const deleted = designSystem.deleteTheme(theme.value.id)
  feedback.value = deleted ? 'Theme deleted.' : 'At least one Theme must remain.'
  if (deleted) emit('themeActivate', designSystem.activeTheme.id)
}

function previewTheme(themeId: string): void {
  if (!designSystem.preview(themeId)) return
  feedback.value = `Previewing ${designSystem.previewTheme.name}.`
  emit('themePreview', themeId)
}

function activateTheme(themeId: string): void {
  if (!designSystem.activate(themeId)) return
  feedback.value = `${designSystem.activeTheme.name} is active.`
  emit('themeActivate', themeId)
}

function updateRole(styleKey: string, event: Event): void {
  const input = event.target as HTMLInputElement | HTMLSelectElement
  const value: EditorValue = styleKey === 'fontWeight' ? Number(input.value) : input.value
  if (!designSystem.updateTypography(theme.value.id, selectedRole.value, styleKey, value)) return
  feedback.value = `${typographyRoleRegistry.find((candidate) => candidate.id === selectedRole.value)?.label} updated.`
  emit('typographyChange', { roleId: selectedRole.value, styleKey })
}

function componentCompatible(componentId: string): boolean {
  const component = reusableComponentRegistry.find((candidate) => candidate.id === componentId)
  if (!component || component.insertMode === 'unavailable-fixed-template' || !props.selectedObjectId) return false
  return component.requiredCapabilities.every((capability) => props.selectedCapabilities.includes(capability))
}

function closeOnEscape(event: KeyboardEvent): void {
  if (event.key === 'Escape') emit('close')
}
</script>

<template>
  <div v-if="open" class="design-system-backdrop" role="presentation" @click.self="emit('close')">
    <section ref="dialog" class="design-system-panel" role="dialog" aria-modal="true" aria-labelledby="design-system-title" tabindex="-1" @keydown="closeOnEscape">
      <header>
        <div>
          <span class="eyebrow"><Palette :size="14" /> Design System</span>
          <h2 id="design-system-title">Global styles &amp; libraries</h2>
          <p>Theme values compile into the canonical Draft properties already used by Preview and Publish.</p>
        </div>
        <button type="button" class="icon-action" aria-label="Close Design System" @click="emit('close')"><X :size="19" /></button>
      </header>

      <nav class="design-tabs" aria-label="Design System sections">
        <button v-for="tab in (['theme','typography','buttons','components','sections','templates','audit'] as PanelTab[])" :key="tab" type="button" :aria-current="activeTab === tab ? 'page' : undefined" @click="activeTab = tab">{{ tab }}</button>
      </nav>

      <div class="design-content">
        <section v-if="activeTab === 'theme'" class="panel-section" data-design-tab="theme">
          <div class="section-heading"><div><h3>Theme Manager</h3><p>One Theme is active. Preview and switching update linked objects immediately.</p></div><span>{{ designSystem.workspace.themes.length }} themes</span></div>
          <div class="theme-list" role="list">
            <article v-for="candidate in designSystem.workspace.themes" :key="candidate.id" :class="{ active: candidate.id === designSystem.activeTheme.id, previewing: candidate.id === designSystem.workspace.previewThemeId }">
              <button type="button" class="theme-select" @click="previewTheme(candidate.id)">
                <span class="theme-swatches" aria-hidden="true"><i v-for="tokenId in ['color-primary','color-secondary','color-accent','color-background']" :key="tokenId" :style="{ background: String(candidate.tokens[tokenId]) }" /></span>
                <strong>{{ candidate.name }}</strong><small>{{ candidate.id === designSystem.activeTheme.id ? 'Active' : candidate.id === designSystem.workspace.previewThemeId ? 'Preview' : 'Theme' }}</small>
              </button>
              <button type="button" :disabled="candidate.id === designSystem.activeTheme.id" @click="activateTheme(candidate.id)"><Check :size="14" /> Switch</button>
            </article>
          </div>
          <div class="theme-actions">
            <label><span>Theme name</span><input v-model="themeName" aria-label="Theme name" /></label>
            <button type="button" @click="renameTheme">Rename</button>
            <button type="button" @click="duplicateTheme"><Copy :size="14" /> Duplicate</button>
            <button type="button" class="danger" :disabled="designSystem.workspace.themes.length <= 1" @click="deleteTheme"><Trash2 :size="14" /> Delete</button>
          </div>
          <div class="theme-actions create-theme">
            <label><span>New Theme</span><input v-model="newThemeName" placeholder="Theme name" @keydown.enter.prevent="createTheme" /></label>
            <button type="button" @click="createTheme"><Plus :size="14" /> Create Theme</button>
          </div>
          <div class="token-grid">
            <label v-for="token in designTokenRegistry" :key="token.id" class="token-field" :data-token-id="token.id">
              <span>{{ token.label }}<small>{{ token.kind }}</small></span>
              <div>
                <input v-if="token.kind === 'color'" type="color" :value="String(theme.tokens[token.id])" :aria-label="`${token.label} swatch`" @input="updateToken(token.id, $event)" />
                <input :type="token.kind === 'duration' || token.kind === 'typography-scale' ? 'number' : 'text'" :step="token.kind === 'typography-scale' ? '.05' : '1'" :value="theme.tokens[token.id] as string | number" :aria-label="token.label" @change="updateToken(token.id, $event)" />
              </div>
            </label>
          </div>
        </section>

        <section v-else-if="activeTab === 'typography'" class="panel-section" data-design-tab="typography">
          <div class="section-heading"><div><h3>Global Typography</h3><p>Heading 1-6, Paragraph, Caption, Button, and Label share central role definitions.</p></div></div>
          <div class="role-list" role="tablist" aria-label="Typography roles">
            <button v-for="candidate in typographyRoleRegistry" :key="candidate.id" type="button" role="tab" :aria-selected="selectedRole === candidate.id" @click="selectedRole = candidate.id">{{ candidate.label }}</button>
          </div>
          <div class="typography-editor">
            <p class="type-preview" :style="{ fontFamily: String(theme.tokens[String(role.fontTokenId)]), fontSize: String(role.fontSize), fontWeight: String(role.fontWeight), lineHeight: String(role.lineHeight), letterSpacing: String(role.letterSpacing), color: String(theme.tokens[String(role.colorTokenId)]) }">The quick brown fox</p>
            <div class="field-grid">
              <label><span>Font token</span><select :value="role.fontTokenId" @change="updateRole('fontTokenId', $event)"><option v-for="token in designTokenRegistry.filter(token => token.kind === 'font')" :key="token.id" :value="token.id">{{ token.label }}</option></select></label>
              <label><span>Color token</span><select :value="role.colorTokenId" @change="updateRole('colorTokenId', $event)"><option v-for="token in designTokenRegistry.filter(token => token.kind === 'color')" :key="token.id" :value="token.id">{{ token.label }}</option></select></label>
              <label><span>Size</span><input :value="role.fontSize as string" @change="updateRole('fontSize', $event)" /></label>
              <label><span>Weight</span><input type="number" min="100" max="900" step="100" :value="role.fontWeight as number" @change="updateRole('fontWeight', $event)" /></label>
              <label><span>Line height</span><input :value="role.lineHeight as string" @change="updateRole('lineHeight', $event)" /></label>
              <label><span>Spacing</span><input :value="role.letterSpacing as string" @change="updateRole('letterSpacing', $event)" /></label>
            </div>
            <button type="button" class="primary-action" :disabled="!selectedSupportsTypography" @click="emit('typographyApply', selectedRole)">Apply {{ typographyRoleRegistry.find(item => item.id === selectedRole)?.label }} to selection</button>
            <small v-if="!selectedSupportsTypography">Select a typography-capable object to apply this role.</small>
          </div>
        </section>

        <section v-else-if="activeTab === 'buttons'" class="panel-section" data-design-tab="buttons">
          <div class="section-heading"><div><h3>Global Button System</h3><p>Reusable variants and sizes resolve through the active Theme.</p></div></div>
          <div class="button-recipes">
            <button v-for="variant in buttonStyleRegistry" :key="variant.id" type="button" :aria-pressed="selectedVariant === variant.id" @click="selectedVariant = variant.id">{{ variant.label }}</button>
          </div>
          <div class="button-recipes size-recipes">
            <button v-for="size in buttonSizeRegistry" :key="size.id" type="button" :aria-pressed="selectedSize === size.id" @click="selectedSize = size.id">{{ size.label }}</button>
          </div>
          <div class="button-preview"><button type="button" tabindex="-1" :style="buttonPreviewStyle">{{ buttonStyleRegistry.find(item => item.id === selectedVariant)?.label }} · {{ buttonSizeRegistry.find(item => item.id === selectedSize)?.label }}</button></div>
          <button type="button" class="primary-action" :disabled="!selectedSupportsButton" @click="emit('buttonApply', { variantId: selectedVariant, sizeId: selectedSize })">Apply button style</button>
          <small v-if="!selectedSupportsButton">Select a Button object to apply this style.</small>
        </section>

        <section v-else-if="activeTab === 'components'" class="panel-section" data-design-tab="components">
          <div class="section-heading"><div><h3>Component Library</h3><p>Metadata recipes target compatible canonical Editor Objects.</p></div><button type="button" :disabled="!selectedObjectId" @click="emit('componentPresetSave')">Save selected style</button></div>
          <label class="library-search"><Search :size="15" /><input v-model="componentSearch" type="search" placeholder="Button, card, avatar, timeline…" aria-label="Search components" /></label>
          <div class="library-grid">
            <article v-for="component in filteredComponents" :key="component.id">
              <span>{{ component.objectType }}</span><h4>{{ component.label }}</h4><p>{{ component.description }}</p>
              <button type="button" :disabled="!componentCompatible(component.id)" @click="emit('componentApply', component.id)">{{ component.insertMode === 'unavailable-fixed-template' ? 'Instance model unavailable' : 'Apply to selection' }}</button>
              <small v-if="component.insertMode === 'unavailable-fixed-template'">Requires a canonical repeatable instance; no DOM-only clone is created.</small>
              <small v-else-if="!componentCompatible(component.id)">Select a compatible {{ component.objectType }} object.</small>
            </article>
          </div>
        </section>

        <section v-else-if="activeTab === 'sections'" class="panel-section" data-design-tab="sections">
          <div class="section-heading"><div><h3>Section Library</h3><p>Existing canonical sections can be opened and saved as reusable style templates.</p></div><button type="button" :disabled="!selectedSection" @click="emit('sectionTemplateSave')">Save current Section</button></div>
          <div class="library-grid section-grid">
            <article v-for="section in reusableSectionRegistry" :key="section.id">
              <span>Section</span><h4>{{ section.label }}</h4><p>{{ section.description }}</p>
              <button v-if="section.existingSection && availableSections.includes(section.existingSection)" type="button" @click="emit('sectionSelect', section.existingSection)">Open Section</button>
              <button v-else type="button" disabled>Insert unavailable</button>
              <small v-if="section.insertMode === 'unavailable-fixed-template'">Not represented by the protected Snapshot/Guest fixed template.</small>
            </article>
          </div>
          <p class="architecture-note">Duplicate, delete, reorder, and insertion of whole fixed sections require a canonical section-instance model. Those controls are intentionally not simulated in Editor memory.</p>
        </section>

        <section v-else-if="activeTab === 'templates'" class="panel-section" data-design-tab="templates">
          <div class="section-heading"><div><h3>Template Library</h3><p>Reusable style templates retain stable object IDs and never duplicate Snapshot content.</p></div></div>
          <h4>Section templates</h4>
          <div v-if="designSystem.workspace.sectionTemplates.length" class="template-list">
            <article v-for="template in designSystem.workspace.sectionTemplates" :key="template.id"><div><strong>{{ template.name }}</strong><small>{{ template.sourceSection }} · {{ new Date(template.createdAt).toLocaleDateString() }}</small></div><button type="button" @click="emit('sectionTemplateApply', template.id)">Apply</button><button type="button" class="danger" :aria-label="`Delete ${template.name}`" @click="emit('sectionTemplateDelete', template.id)"><Trash2 :size="14" /></button></article>
          </div>
          <p v-else class="empty-library">No saved Section templates.</p>
          <h4>Component presets</h4>
          <div v-if="designSystem.workspace.componentPresets.length" class="template-list">
            <article v-for="preset in designSystem.workspace.componentPresets" :key="preset.id"><div><strong>{{ preset.name }}</strong><small>{{ preset.sourceType }} · {{ new Date(preset.createdAt).toLocaleDateString() }}</small></div><button type="button" @click="emit('componentPresetApply', preset.id)">Apply</button></article>
          </div>
          <p v-else class="empty-library">No saved Component presets.</p>
        </section>

        <section v-else class="panel-section" data-design-tab="audit">
          <div class="section-heading"><div><h3>Theme Accessibility</h3><p>Token validation, text/background contrast, and touch-target warnings.</p></div><span>{{ designSystem.accessibilityIssues.length }} issues</span></div>
          <div v-if="designSystem.accessibilityIssues.length" class="audit-list" role="status">
            <article v-for="issue in designSystem.accessibilityIssues" :key="issue.id" :class="issue.severity"><strong>{{ issue.severity }}</strong><p>{{ issue.message }}</p></article>
          </div>
          <div v-else class="audit-pass"><Check :size="20" /> Theme token checks pass.</div>
          <p class="architecture-note">Automated warnings complement, but do not replace, manual screen-reader and visual contrast review.</p>
        </section>
      </div>

      <footer><span aria-live="polite">{{ feedback || designSystem.persistenceError }}</span><button type="button" @click="emit('close')">Done</button></footer>
    </section>
  </div>
</template>

<style scoped>
.design-system-backdrop{position:fixed;z-index:4200;inset:0;display:grid;justify-items:end;background:rgba(47,36,31,.32);backdrop-filter:blur(3px)}.design-system-panel{display:grid;grid-template-rows:auto auto minmax(0,1fr) auto;width:min(780px,96vw);height:100%;overflow:hidden;border-left:1px solid rgba(91,67,57,.15);background:#fbf7ef;color:#4e3932;box-shadow:-1.5rem 0 4rem rgba(49,37,32,.18);outline:0}.design-system-panel>header{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;padding:1.25rem 1.35rem 1rem;border-bottom:1px solid rgba(91,67,57,.1)}h2,h3,h4,p{margin:0}.eyebrow{display:flex;align-items:center;gap:.35rem;color:#a44955;font-size:.65rem;font-weight:900;letter-spacing:.1em;text-transform:uppercase}h2{margin-top:.25rem;font:700 1.45rem/1.2 Georgia,serif}.design-system-panel>header p,.section-heading p{margin-top:.25rem;color:#8b756a;font-size:.65rem;line-height:1.45}.icon-action{display:grid;place-items:center;width:2.35rem;height:2.35rem;border:1px solid #e4d7ce;border-radius:50%;background:#fffdf8;color:inherit;cursor:pointer}.design-tabs{display:flex;gap:.25rem;padding:.6rem 1rem;overflow-x:auto;border-bottom:1px solid rgba(91,67,57,.1);scrollbar-width:thin}.design-tabs button{border:0;border-radius:999px;padding:.48rem .68rem;background:transparent;color:#80685e;font:800 .62rem system-ui;text-transform:capitalize;cursor:pointer}.design-tabs button[aria-current=page]{background:#f2ded9;color:#8d363a}.design-content{min-height:0;overflow:auto;padding:1.15rem 1.35rem 4rem}.panel-section{display:grid;gap:1rem}.section-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem}.section-heading h3{font:700 1.05rem Georgia,serif}.section-heading>span{border-radius:999px;padding:.3rem .5rem;background:#eee5dc;color:#80685e;font-size:.58rem;font-weight:800}.section-heading button,.theme-actions button,.primary-action,.panel-section>button{display:inline-flex;align-items:center;justify-content:center;gap:.3rem;border:1px solid #decfc5;border-radius:9px;padding:.55rem .72rem;background:#fffaf4;color:#684e45;font:800 .62rem system-ui;cursor:pointer}.theme-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:.55rem}.theme-list article{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;border:1px solid #e4d7cd;border-radius:14px;padding:.45rem;background:#fffdf8}.theme-list article.active{border-color:#b85b69;box-shadow:0 0 0 2px rgba(184,91,105,.12)}.theme-list article.previewing{background:#fff1ea}.theme-select{display:grid;grid-template-columns:auto minmax(0,1fr);gap:.15rem .5rem;border:0;background:transparent;color:inherit;text-align:left;cursor:pointer}.theme-select strong{align-self:end;font-size:.68rem}.theme-select small{color:#947d72;font-size:.54rem}.theme-swatches{grid-row:1/3;display:grid;grid-template-columns:1fr 1fr;width:2.2rem;height:2.2rem;overflow:hidden;border:1px solid rgba(73,54,47,.12);border-radius:50%}.theme-list article>button:last-child{display:inline-flex;gap:.25rem;border:0;background:transparent;color:#9b4f5b;font-size:.55rem;font-weight:800;cursor:pointer}.theme-actions{display:grid;grid-template-columns:minmax(180px,1fr) auto auto auto;gap:.45rem;align-items:end}.theme-actions label,.field-grid label{display:grid;gap:.25rem;color:#765e54;font-size:.58rem;font-weight:800}.theme-actions input,.field-grid input,.field-grid select{min-width:0;border:1px solid #ded0c7;border-radius:8px;padding:.55rem;background:#fff;color:inherit}.theme-actions .danger,.danger{color:#963f47}.create-theme{grid-template-columns:minmax(180px,1fr) auto}.token-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.55rem}.token-field{display:grid;gap:.35rem;border:1px solid rgba(91,67,57,.11);border-radius:12px;padding:.65rem;background:#fffdf8;color:#664e45;font-size:.62rem;font-weight:800}.token-field>span{display:flex;justify-content:space-between;gap:.5rem}.token-field small{color:#a08b81;font-size:.5rem;text-transform:uppercase}.token-field>div{display:grid;grid-template-columns:auto minmax(0,1fr);gap:.35rem}.token-field input{min-width:0;width:100%;box-sizing:border-box;border:1px solid #e0d3ca;border-radius:7px;padding:.45rem;background:#fff;color:inherit;font-size:.62rem}.token-field input[type=color]{width:2rem;padding:.15rem}.role-list,.button-recipes{display:flex;gap:.35rem;overflow-x:auto;scrollbar-width:thin}.role-list button,.button-recipes button{flex:0 0 auto;border:1px solid #dfd2c9;border-radius:999px;padding:.45rem .62rem;background:#fff;color:#735b51;font-size:.57rem;font-weight:800;cursor:pointer}.role-list button[aria-selected=true],.button-recipes button[aria-pressed=true]{border-color:#b85b69;background:#f7e4df;color:#8d363a}.typography-editor{display:grid;gap:.85rem}.type-preview{min-height:90px;display:grid;place-items:center;border:1px solid #e4d7cd;border-radius:16px;padding:1rem;background:#fffdf8;text-align:center}.field-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.55rem}.primary-action{justify-self:start!important;border-color:#a9515d!important;background:#a9515d!important;color:#fff!important}.primary-action:disabled,.design-system-panel button:disabled{cursor:not-allowed;opacity:.42}.button-preview{display:grid;place-items:center;min-height:120px;border:1px dashed #d9c8bc;border-radius:16px;background:#fffaf4}.button-preview button{border:1px solid v-bind("String(theme.tokens['color-primary'])");border-radius:v-bind("String(theme.tokens['radius-global'])");padding:.75rem 1rem;background:v-bind("String(theme.tokens['color-primary'])");color:v-bind("String(theme.tokens['color-surface'])");font-weight:800;pointer-events:none}.library-search{display:flex;align-items:center;gap:.45rem;border:1px solid #dfd2c8;border-radius:10px;padding:.55rem .65rem;background:#fff}.library-search input{min-width:0;flex:1;border:0;outline:0;background:transparent;color:inherit}.library-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.55rem}.library-grid article{display:grid;align-content:start;gap:.4rem;min-height:150px;border:1px solid rgba(91,67,57,.12);border-radius:14px;padding:.75rem;background:#fffdf8}.library-grid article>span{color:#a44955;font-size:.5rem;font-weight:900;letter-spacing:.08em;text-transform:uppercase}.library-grid h4{font:700 .82rem Georgia,serif}.library-grid p{color:#887269;font-size:.57rem;line-height:1.45}.library-grid button{align-self:end;border:1px solid #dfd1c7;border-radius:8px;padding:.48rem;background:#fff7f0;color:#765249;font-size:.55rem;font-weight:800;cursor:pointer}.library-grid small{color:#9a8278;font-size:.5rem;line-height:1.4}.architecture-note,.empty-library{border-radius:10px;padding:.7rem;background:#f0e9e0;color:#806d63;font-size:.58rem;line-height:1.5}.template-list{display:grid;gap:.45rem}.template-list article{display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:.4rem;border:1px solid #e2d5cb;border-radius:11px;padding:.6rem;background:#fff}.template-list article>div{display:grid}.template-list strong{font-size:.65rem}.template-list small{color:#947e73;font-size:.53rem}.template-list button{border:1px solid #dfd1c7;border-radius:7px;padding:.4rem .55rem;background:#fffaf4;color:#71564d;font-size:.55rem;font-weight:800;cursor:pointer}.audit-list{display:grid;gap:.45rem}.audit-list article{display:grid;grid-template-columns:auto 1fr;gap:.55rem;border-radius:11px;padding:.65rem;background:#fff0e8}.audit-list article.error{background:#ffe9e9}.audit-list strong{color:#a44955;font-size:.52rem;text-transform:uppercase}.audit-list p{color:#70564c;font-size:.6rem;line-height:1.45}.audit-pass{display:flex;align-items:center;gap:.45rem;border-radius:12px;padding:.8rem;background:#eaf4ed;color:#3f6d50;font-size:.66rem;font-weight:800}.design-system-panel>footer{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:.75rem 1.15rem;border-top:1px solid rgba(91,67,57,.11);background:#fffaf4}.design-system-panel>footer span{min-height:1em;color:#8d6760;font-size:.58rem}.design-system-panel>footer button{border:0;border-radius:9px;padding:.55rem .9rem;background:#9f4b57;color:#fff;font-weight:800;cursor:pointer}.design-system-panel button:focus-visible,.design-system-panel input:focus-visible,.design-system-panel select:focus-visible{outline:2px solid #b85b69;outline-offset:2px}@media(max-width:700px){.design-system-panel{width:100vw}.token-grid,.field-grid,.library-grid{grid-template-columns:1fr}.theme-actions{grid-template-columns:1fr 1fr}.theme-actions label{grid-column:1/-1}.design-content{padding-inline:.85rem}.section-heading{align-items:flex-start;flex-direction:column}}
</style>
