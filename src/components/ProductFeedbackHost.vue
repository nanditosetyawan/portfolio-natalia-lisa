<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { CheckCircle2, CircleAlert, Info, Trash2, TriangleAlert, X } from 'lucide-vue-next'
import {
  productConfirmation,
  productFeedback,
  productToasts,
  type ProductFeedbackTone
} from '../composables/useProductFeedback'

const dialog = ref<HTMLElement | null>(null)
const cancelButton = ref<HTMLButtonElement | null>(null)
const route = useRoute()
let previouslyFocused: HTMLElement | null = null
let offlineToastId: string | null = null

const iconByTone = {
  success: CheckCircle2,
  error: CircleAlert,
  warning: TriangleAlert,
  info: Info
} satisfies Record<ProductFeedbackTone, typeof Info>

const confirmationDescriptionId = computed(() => productConfirmation.value ? `product-confirmation-description-${productConfirmation.value.id}` : undefined)

function handleOnline(): void {
  if (offlineToastId) productFeedback.dismiss(offlineToastId)
  offlineToastId = null
  productFeedback.success('Connection restored', 'Repository actions can be retried safely.')
}

function handleOffline(): void {
  if (offlineToastId) productFeedback.dismiss(offlineToastId)
  offlineToastId = productFeedback.warning(
    'You are offline',
    'Local work stays in place. Repository actions will remain available to retry when the connection returns.',
    { durationMs: 0, key: 'network-offline' }
  )
}

function handleDialogKeydown(event: KeyboardEvent): void {
  if (!productConfirmation.value) return
  if (event.key === 'Escape') {
    event.preventDefault()
    productFeedback.resolveConfirmation(false)
    return
  }
  if (event.key !== 'Tab' || !dialog.value) return
  const focusable = [...dialog.value.querySelectorAll<HTMLElement>('button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')]
  const first = focusable[0]
  const last = focusable.at(-1)
  if (!first || !last) return
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

watch(productConfirmation, async (next, previous) => {
  if (next) {
    previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    await nextTick()
    cancelButton.value?.focus()
  } else if (previous) {
    await nextTick()
    previouslyFocused?.focus()
    previouslyFocused = null
  }
})

watch(() => route.path.startsWith('/admin'), (isAdminRoute, wasAdminRoute) => {
  if (isAdminRoute === wasAdminRoute) return
  productFeedback.clear()
  productFeedback.resolveConfirmation(false)
  offlineToastId = null
})

onMounted(() => {
  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)
  if (!navigator.onLine) handleOffline()
})

onBeforeUnmount(() => {
  window.removeEventListener('online', handleOnline)
  window.removeEventListener('offline', handleOffline)
  if (offlineToastId) productFeedback.dismiss(offlineToastId)
  productFeedback.resolveConfirmation(false)
})
</script>

<template>
  <Teleport to="body">
    <section class="product-feedback-host" aria-label="Application notifications">
      <TransitionGroup name="product-toast" tag="div" class="product-toast-stack">
        <article
          v-for="toast in productToasts"
          :key="toast.id"
          class="product-toast"
          :class="`product-toast--${toast.tone}`"
          :role="toast.tone === 'error' ? 'alert' : 'status'"
          :aria-live="toast.tone === 'error' ? 'assertive' : 'polite'"
          aria-atomic="true"
        >
          <component :is="iconByTone[toast.tone]" :size="19" aria-hidden="true" />
          <div><strong>{{ toast.title }}</strong><p v-if="toast.message">{{ toast.message }}</p></div>
          <button type="button" :aria-label="`Dismiss ${toast.title}`" @click="productFeedback.dismiss(toast.id)"><X :size="16" /></button>
        </article>
      </TransitionGroup>
    </section>

    <Transition name="product-dialog">
      <div v-if="productConfirmation" class="product-confirmation-backdrop" @click.self="productFeedback.resolveConfirmation(false)">
        <section
          ref="dialog"
          class="product-confirmation"
          role="dialog"
          aria-modal="true"
          aria-labelledby="product-confirmation-title"
          :aria-describedby="confirmationDescriptionId"
          @keydown="handleDialogKeydown"
        >
          <span class="product-confirmation__icon" :class="{ 'is-danger': productConfirmation.tone === 'danger' }" aria-hidden="true">
            <Trash2 v-if="productConfirmation.tone === 'danger'" :size="22" />
            <CircleAlert v-else :size="22" />
          </span>
          <h2 id="product-confirmation-title">{{ productConfirmation.title }}</h2>
          <p :id="confirmationDescriptionId">{{ productConfirmation.message }}</p>
          <div>
            <button ref="cancelButton" type="button" class="product-confirmation__cancel confirm-cancel" @click="productFeedback.resolveConfirmation(false)">{{ productConfirmation.cancelLabel }}</button>
            <button type="button" class="product-confirmation__confirm" :class="{ 'is-danger': productConfirmation.tone === 'danger' }" @click="productFeedback.resolveConfirmation(true)">{{ productConfirmation.confirmLabel }}</button>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.product-feedback-host{position:fixed;z-index:15000;inset:0;pointer-events:none}.product-toast-stack{position:absolute;right:max(1rem,env(safe-area-inset-right));bottom:max(1rem,env(safe-area-inset-bottom));display:grid;justify-items:end;gap:.65rem;width:min(25rem,calc(100vw - 2rem))}.product-toast{pointer-events:auto;width:100%;display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:start;gap:.7rem;padding:.85rem .9rem;border:1px solid #ddcfc5;border-radius:16px;color:#5a3e35;background:rgba(255,253,248,.98);box-shadow:0 1rem 2.8rem rgba(68,45,38,.2);backdrop-filter:blur(12px)}.product-toast>svg{margin-top:.08rem;color:#806b62}.product-toast--success{border-color:#bed5c5}.product-toast--success>svg{color:#3f6d50}.product-toast--error{border-color:#e2b6b6}.product-toast--error>svg{color:#963f47}.product-toast--warning{border-color:#e8ca9a}.product-toast--warning>svg{color:#9a650e}.product-toast strong{display:block;font-size:.8rem}.product-toast p{margin:.2rem 0 0;color:#806b62;font-size:.7rem;line-height:1.45}.product-toast button{display:grid;place-items:center;width:2rem;height:2rem;margin:-.35rem -.35rem 0 0;border:0;border-radius:50%;color:#806b62;background:transparent;cursor:pointer}.product-toast button:hover{background:#f4ece4}.product-toast button:focus-visible{outline:3px solid rgba(184,91,105,.35);outline-offset:2px}.product-toast-enter-active,.product-toast-leave-active{transition:opacity .18s ease,transform .18s ease}.product-toast-enter-from,.product-toast-leave-to{opacity:0;transform:translateY(.65rem) scale(.98)}.product-confirmation-backdrop{position:fixed;z-index:16000;inset:0;display:grid;place-items:center;padding:1rem;background:rgba(54,38,33,.38);backdrop-filter:blur(5px)}.product-confirmation{width:min(28rem,100%);padding:1.55rem;border:1px solid #ead8ce;border-radius:24px;color:#5a3e35;background:#fffaf4;box-shadow:0 2rem 5rem rgba(55,38,32,.26);text-align:center}.product-confirmation__icon{display:grid;place-items:center;width:3.25rem;height:3.25rem;margin:0 auto .8rem;border-radius:18px;color:#8a5a13;background:#fff0cf}.product-confirmation__icon.is-danger{color:#963f47;background:#ffe9e4}.product-confirmation h2{margin:0;font:700 1.35rem/1.2 Georgia,serif}.product-confirmation p{margin:.55rem auto 1.25rem;max-width:23rem;color:#806b62;font-size:.8rem;line-height:1.55}.product-confirmation>div{display:flex;justify-content:center;gap:.6rem}.product-confirmation button{min-height:2.65rem;padding:.65rem 1rem;border-radius:999px;font:800 .76rem/1 system-ui;cursor:pointer}.product-confirmation__cancel{border:1px solid #ddcfc5;color:#684e45;background:#fff}.product-confirmation__confirm{border:1px solid #b85b69;color:#fff;background:#b85b69}.product-confirmation__confirm.is-danger{border-color:#963f47;background:#963f47}.product-confirmation button:focus-visible{outline:3px solid rgba(184,91,105,.35);outline-offset:3px}.product-dialog-enter-active,.product-dialog-leave-active{transition:opacity .18s ease}.product-dialog-enter-active .product-confirmation,.product-dialog-leave-active .product-confirmation{transition:transform .18s ease}.product-dialog-enter-from,.product-dialog-leave-to{opacity:0}.product-dialog-enter-from .product-confirmation,.product-dialog-leave-to .product-confirmation{transform:translateY(.6rem) scale(.98)}
@media(max-width:640px){.product-toast-stack{right:1rem;bottom:max(1rem,env(safe-area-inset-bottom));justify-items:stretch}.product-confirmation{padding:1.3rem}.product-confirmation>div{flex-direction:column-reverse}.product-confirmation button{width:100%;min-height:2.9rem}}
@media(prefers-reduced-motion:reduce){.product-toast-enter-active,.product-toast-leave-active,.product-dialog-enter-active,.product-dialog-leave-active,.product-dialog-enter-active .product-confirmation,.product-dialog-leave-active .product-confirmation{transition:none}}
</style>
