import { reportRuntimeDiagnostic } from './monitoring'

export async function registerProductionServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!import.meta.env.PROD || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null
  try {
    const registration = await navigator.serviceWorker.register(`/sw.js?build=${encodeURIComponent(__APP_BUILD_ID__)}`, { scope: '/' })
    if (registration.waiting) registration.waiting.postMessage({ type: 'SKIP_WAITING' })
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          reportRuntimeDiagnostic('info', 'runtime', 'A production update is ready.', { serviceWorkerUpdate: true })
        }
      })
    })
    return registration
  } catch (error) {
    reportRuntimeDiagnostic('warning', 'runtime', error, { serviceWorkerRegistration: false })
    return null
  }
}
