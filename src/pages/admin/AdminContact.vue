<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { CircleAlert, FileText, Linkedin, LoaderCircle, MessageCircle, Save } from 'lucide-vue-next'
import ProductEmptyState from '../../components/ProductEmptyState.vue'
import ProductSkeleton from '../../components/ProductSkeleton.vue'
import { productFeedback } from '../../composables/useProductFeedback'
import {
  contactLinksRepository,
  validateContactLinkInput,
  type ContactSocialLinks
} from '../../repositories/contactLinksRepository'

type LinkKey = keyof ContactSocialLinks

const form = reactive<ContactSocialLinks>({
  whatsapp: '',
  linkedin: '',
  cv: ''
})

const fieldErrors = reactive<ContactSocialLinks>({
  whatsapp: '',
  linkedin: '',
  cv: ''
})

const isLoading = ref(true)
const isSaving = ref(false)
const loadError = ref('')
const saveError = ref('')

const fields = [
  {
    key: 'whatsapp' as const,
    id: 'contact-whatsapp-link',
    label: 'WhatsApp',
    placeholder: 'https://wa.me/6281234567890',
    icon: MessageCircle
  },
  {
    key: 'linkedin' as const,
    id: 'contact-linkedin-link',
    label: 'LinkedIn',
    placeholder: 'https://www.linkedin.com/in/username',
    icon: Linkedin
  },
  {
    key: 'cv' as const,
    id: 'contact-cv-link',
    label: 'CV',
    placeholder: 'https://example.com/cv.pdf',
    icon: FileText
  }
]

function clearFieldError(key: LinkKey): void {
  fieldErrors[key] = ''
  saveError.value = ''
}

async function loadLinks(): Promise<void> {
  isLoading.value = true
  loadError.value = ''
  try {
    const saved = await contactLinksRepository.load()
    form.whatsapp = saved.whatsapp
    form.linkedin = saved.linkedin
    form.cv = saved.cv
    fieldErrors.whatsapp = ''
    fieldErrors.linkedin = ''
    fieldErrors.cv = ''
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : 'Contact links could not be loaded.'
    productFeedback.error('Contact unavailable', loadError.value)
  } finally {
    isLoading.value = false
  }
}

async function handleSave(): Promise<void> {
  if (isLoading.value || isSaving.value) return
  saveError.value = ''

  let hasValidationError = false
  const validated: ContactSocialLinks = { whatsapp: '', linkedin: '', cv: '' }

  for (const field of fields) {
    const result = validateContactLinkInput(form[field.key], field.label)
    fieldErrors[field.key] = result.error ?? ''
    validated[field.key] = result.value
    if (result.error) hasValidationError = true
  }

  if (hasValidationError) return

  isSaving.value = true
  try {
    const persisted = await contactLinksRepository.save(validated)
    form.whatsapp = persisted.whatsapp
    form.linkedin = persisted.linkedin
    form.cv = persisted.cv
    productFeedback.success('Contact links saved', 'WhatsApp, LinkedIn, and CV links are now updated.')
  } catch (error) {
    saveError.value = error instanceof Error ? error.message : 'Contact links could not be saved.'
    productFeedback.error('Save failed', saveError.value)
  } finally {
    isSaving.value = false
  }
}

onMounted(() => {
  void loadLinks()
})
</script>

<template>
  <section class="contact-admin-page">
    <div class="contact-admin-shell">
      <header class="contact-admin-header">
        <p class="contact-eyebrow">Contact Settings</p>
        <h1>Contact</h1>
        <p class="contact-subtitle">
          Atur link WhatsApp, LinkedIn, dan CV untuk tombol di halaman detail kontak.
        </p>
      </header>

      <div v-if="isLoading" class="contact-card contact-card--padded">
        <ProductSkeleton variant="list" :count="3" label="Loading contact links" />
      </div>

      <ProductEmptyState
        v-else-if="loadError"
        tone="error"
        eyebrow="Connection issue"
        title="Contact links could not be loaded"
        :description="loadError"
        :icon="CircleAlert"
      >
        <button type="button" @click="void loadLinks()">Retry</button>
      </ProductEmptyState>

      <form v-else class="contact-card" novalidate @submit.prevent="handleSave">
        <div class="contact-card-accent" aria-hidden="true"></div>
        <div class="contact-card-body">
          <div v-for="field in fields" :key="field.key" class="contact-field">
            <label :for="field.id" class="contact-field-label">
              <span class="contact-field-badge" aria-hidden="true">
                <component :is="field.icon" :size="16" stroke-width="2" />
              </span>
              <span>{{ field.label }}</span>
            </label>
            <input
              :id="field.id"
              v-model="form[field.key]"
              type="text"
              inputmode="url"
              autocomplete="url"
              autocapitalize="off"
              spellcheck="false"
              class="contact-field-input"
              :class="{ 'contact-field-input--invalid': Boolean(fieldErrors[field.key]) }"
              :placeholder="field.placeholder"
              :disabled="isSaving"
              :aria-invalid="Boolean(fieldErrors[field.key])"
              :aria-describedby="fieldErrors[field.key] ? `${field.id}-error` : undefined"
              @input="clearFieldError(field.key)"
            />
            <p v-if="fieldErrors[field.key]" :id="`${field.id}-error`" class="contact-field-error" role="alert">
              {{ fieldErrors[field.key] }}
            </p>
          </div>

          <p v-if="saveError" class="contact-save-error" role="alert">{{ saveError }}</p>

          <div class="contact-actions">
            <button type="submit" class="contact-save-btn" :disabled="isSaving" :aria-busy="isSaving">
              <LoaderCircle v-if="isSaving" :size="16" class="spin" aria-hidden="true" />
              <Save v-else :size="16" aria-hidden="true" />
              <span>{{ isSaving ? 'Saving…' : 'Save' }}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  </section>
</template>

<style scoped>
.contact-admin-page {
  min-height: 100%;
  background: #F6F4E8;
  color: #5A3E35;
  font-family: 'Inter', system-ui, sans-serif;
}

.contact-admin-shell {
  width: 100%;
  max-width: 720px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.contact-admin-header {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.contact-eyebrow {
  margin: 0;
  color: #B85B69;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.contact-admin-header h1 {
  margin: 0;
  font-family: Georgia, serif;
  font-size: clamp(1.75rem, 4vw, 2.25rem);
  font-weight: 600;
  color: #5A3E35;
  line-height: 1.15;
}

.contact-subtitle {
  margin: 0;
  color: #7B5F3B;
  font-size: 0.9rem;
  line-height: 1.5;
}

.contact-card {
  background: #FAF9F5;
  border: 1px solid rgba(123, 35, 41, 0.16);
  border-radius: 16px;
  box-shadow: 0 14px 36px -14px rgba(123, 35, 41, 0.14), 0 0 0 1px rgba(90, 62, 53, 0.04);
  overflow: hidden;
}

.contact-card--padded {
  padding: 1.75rem;
}

.contact-card-accent {
  height: 6px;
  width: 100%;
  background: linear-gradient(90deg, #7B2329 0%, #B85B69 100%);
}

.contact-card-body {
  padding: clamp(1.35rem, 3vw, 2rem);
  display: flex;
  flex-direction: column;
  gap: 1.35rem;
}

.contact-field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.contact-field-label {
  display: inline-flex;
  align-items: center;
  gap: 0.65rem;
  font-size: 0.9rem;
  font-weight: 700;
  color: #5A3E35;
  cursor: pointer;
}

.contact-field-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: #FDF0F0;
  border: 1px solid rgba(123, 35, 41, 0.16);
  color: #7B2329;
  flex-shrink: 0;
}

.contact-field-input {
  width: 100%;
  box-sizing: border-box;
  padding: 0.82rem 1rem;
  border: 1.5px solid #E5D7CE;
  border-radius: 14px;
  background: #FFFDF9;
  color: #5A3E35;
  font: inherit;
  font-size: 0.9rem;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease;
}

.contact-field-input::placeholder {
  color: #B49F96;
}

.contact-field-input:focus {
  outline: none;
  border-color: #7B2329;
  background: #FFFFFF;
  box-shadow: 0 0 0 3px rgba(123, 35, 41, 0.12);
}

.contact-field-input:disabled {
  opacity: 0.65;
  cursor: wait;
}

.contact-field-input--invalid,
.contact-field-input--invalid:focus {
  border-color: #C93D4D;
  background: #FFF5F5;
  box-shadow: 0 0 0 3px rgba(201, 61, 77, 0.12);
}

.contact-field-error {
  margin: 0;
  color: #A33D32;
  font-size: 0.78rem;
  font-weight: 600;
}

.contact-save-error {
  margin: 0;
  padding: 0.78rem 1rem;
  border: 1px solid rgba(201, 61, 77, 0.28);
  border-radius: 12px;
  background: #FFF0EF;
  color: #8D363A;
  font-size: 0.82rem;
  font-weight: 600;
}

.contact-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 1.15rem;
  border-top: 1px solid #EDE2DA;
}

.contact-save-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-width: 132px;
  padding: 0.82rem 1.75rem;
  border: 1px solid #681B20;
  border-radius: 999px;
  background: linear-gradient(135deg, #7B2329 0%, #98323B 100%);
  color: #FFFFFF;
  font: inherit;
  font-size: 0.9rem;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 10px 22px -10px rgba(123, 35, 41, 0.55);
  transition: transform 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease;
}

.contact-save-btn:hover:not(:disabled) {
  filter: brightness(0.95);
  transform: translateY(-1px);
  box-shadow: 0 14px 26px -10px rgba(123, 35, 41, 0.65);
}

.contact-save-btn:focus-visible {
  outline: 3px solid rgba(184, 91, 105, 0.45);
  outline-offset: 3px;
}

.contact-save-btn:disabled {
  opacity: 0.68;
  cursor: wait;
  transform: none;
}

.spin {
  animation: contact-admin-spin 0.8s linear infinite;
}

@keyframes contact-admin-spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 600px) {
  .contact-actions {
    justify-content: stretch;
  }

  .contact-save-btn {
    width: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .contact-field-input,
  .contact-save-btn {
    transition: none;
  }

  .spin {
    animation: none;
  }
}
</style>

