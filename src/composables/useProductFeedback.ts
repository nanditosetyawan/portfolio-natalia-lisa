import { readonly, ref } from 'vue'

export type ProductFeedbackTone = 'success' | 'error' | 'warning' | 'info'

export interface ProductToast {
  id: string
  key?: string
  title: string
  message?: string
  tone: ProductFeedbackTone
  durationMs: number
}

export interface ProductConfirmation {
  id: string
  title: string
  message: string
  confirmLabel: string
  cancelLabel: string
  tone: 'default' | 'danger'
}

const toasts = ref<ProductToast[]>([])
const confirmation = ref<ProductConfirmation | null>(null)
const timers = new Map<string, ReturnType<typeof globalThis.setTimeout>>()
let confirmationResolver: ((accepted: boolean) => void) | null = null

function dismiss(id: string): void {
  const timer = timers.get(id)
  if (timer) globalThis.clearTimeout(timer)
  timers.delete(id)
  toasts.value = toasts.value.filter((toast) => toast.id !== id)
}

function clear(): void {
  for (const toast of [...toasts.value]) dismiss(toast.id)
}

function notify(input: {
  title: string
  message?: string
  tone?: ProductFeedbackTone
  durationMs?: number
  key?: string
}): string {
  if (input.key) {
    const existing = toasts.value.find((toast) => toast.key === input.key)
    if (existing) dismiss(existing.id)
  }
  const tone = input.tone ?? 'info'
  const durationMs = input.durationMs ?? (tone === 'error' ? 6000 : tone === 'warning' ? 5000 : 3600)
  const toast: ProductToast = {
    id: crypto.randomUUID(),
    key: input.key,
    title: input.title,
    message: input.message,
    tone,
    durationMs
  }
  toasts.value = [...toasts.value, toast].slice(-4)
  if (durationMs > 0) timers.set(toast.id, globalThis.setTimeout(() => dismiss(toast.id), durationMs))
  return toast.id
}

function success(title: string, message?: string): string {
  return notify({ title, message, tone: 'success' })
}

function error(title: string, message?: string): string {
  return notify({ title, message, tone: 'error' })
}

function warning(title: string, message?: string, options: { durationMs?: number; key?: string } = {}): string {
  return notify({ title, message, tone: 'warning', ...options })
}

function info(title: string, message?: string): string {
  return notify({ title, message, tone: 'info' })
}

function confirm(input: {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'default' | 'danger'
}): Promise<boolean> {
  confirmationResolver?.(false)
  return new Promise((resolve) => {
    confirmationResolver = resolve
    confirmation.value = {
      id: crypto.randomUUID(),
      title: input.title,
      message: input.message,
      confirmLabel: input.confirmLabel ?? 'Continue',
      cancelLabel: input.cancelLabel ?? 'Cancel',
      tone: input.tone ?? 'default'
    }
  })
}

function resolveConfirmation(accepted: boolean): void {
  const resolve = confirmationResolver
  confirmationResolver = null
  confirmation.value = null
  resolve?.(accepted)
}

export const productToasts = readonly(toasts)
export const productConfirmation = readonly(confirmation)
export const productFeedback = {
  notify,
  success,
  error,
  warning,
  info,
  dismiss,
  clear,
  confirm,
  resolveConfirmation
}
