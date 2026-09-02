import type { App } from 'vue'

export type DiagnosticSeverity = 'info' | 'warning' | 'error'

export interface RuntimeDiagnostic {
  id: string
  timestamp: string
  severity: DiagnosticSeverity
  category: 'runtime' | 'network' | 'performance' | 'vue'
  message: string
  context: Record<string, string | number | boolean | null>
}

export interface RuntimeMetrics {
  cls: number
  lcpMs: number | null
  inpMs: number | null
  longTasks: number
  navigationMs: number | null
}

export type ErrorLoggingAdapter = (diagnostic: RuntimeDiagnostic) => void | Promise<void>

const diagnostics: RuntimeDiagnostic[] = []
const metrics: RuntimeMetrics = { cls: 0, lcpMs: null, inpMs: null, longTasks: 0, navigationMs: null }
const observers: PerformanceObserver[] = []
const MAX_DIAGNOSTICS = 100
let adapter: ErrorLoggingAdapter | null = null
let installed = false

function cleanMessage(value: unknown): string {
  const raw = value instanceof Error ? value.message : typeof value === 'string' ? value : 'Unknown runtime error.'
  return raw.replace(/(?:access_token|refresh_token|apikey|authorization)=?[^\s&]*/gi, '[redacted]').slice(0, 1000)
}

function safeLocation(): string {
  if (typeof window === 'undefined') return ''
  return `${window.location.origin}${window.location.pathname}`
}

function safeContextValue(value: RuntimeDiagnostic['context'][string]): RuntimeDiagnostic['context'][string] {
  if (typeof value !== 'string') return value
  const cleaned = cleanMessage(value)
  if (!/^(?:https?:|blob:)/i.test(cleaned)) return cleaned.slice(0, 500)
  try {
    const url = new URL(cleaned)
    return `${url.origin}${url.pathname}`.slice(0, 500)
  } catch {
    return cleaned.split(/[?#]/, 1)[0]!.slice(0, 500)
  }
}

export function setErrorLoggingAdapter(next: ErrorLoggingAdapter | null): void {
  adapter = next
}

export function reportRuntimeDiagnostic(
  severity: DiagnosticSeverity,
  category: RuntimeDiagnostic['category'],
  message: unknown,
  context: RuntimeDiagnostic['context'] = {}
): RuntimeDiagnostic {
  const diagnostic: RuntimeDiagnostic = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    severity,
    category,
    message: cleanMessage(message),
    context: Object.fromEntries(Object.entries({ location: safeLocation(), ...context }).map(([key, value]) => [key, safeContextValue(value)]))
  }
  diagnostics.push(diagnostic)
  if (diagnostics.length > MAX_DIAGNOSTICS) diagnostics.splice(0, diagnostics.length - MAX_DIAGNOSTICS)
  if (adapter) void Promise.resolve(adapter(diagnostic)).catch(() => undefined)
  return diagnostic
}

export function getRuntimeDiagnostics(): { diagnostics: RuntimeDiagnostic[]; metrics: RuntimeMetrics; buildId: string; appVersion: string } {
  return {
    diagnostics: structuredClone(diagnostics),
    metrics: { ...metrics },
    buildId: __APP_BUILD_ID__,
    appVersion: __APP_VERSION__
  }
}

function observe(type: string, callback: (entries: PerformanceEntry[]) => void): void {
  if (typeof PerformanceObserver === 'undefined' || !PerformanceObserver.supportedEntryTypes.includes(type)) return
  try {
    const observer = new PerformanceObserver((list) => callback(list.getEntries()))
    observer.observe({ type, buffered: true })
    observers.push(observer)
  } catch {
    // Older engines may expose an entry type without supporting buffered observation.
  }
}

function installPerformanceObservers(): void {
  observe('largest-contentful-paint', (entries) => {
    const latest = entries.at(-1)
    if (latest) metrics.lcpMs = Math.round(latest.startTime * 100) / 100
  })
  observe('layout-shift', (entries) => {
    for (const entry of entries) {
      const shift = entry as PerformanceEntry & { value?: number; hadRecentInput?: boolean }
      if (!shift.hadRecentInput) metrics.cls += shift.value ?? 0
    }
    metrics.cls = Math.round(metrics.cls * 10000) / 10000
  })
  observe('event', (entries) => {
    for (const entry of entries) metrics.inpMs = Math.max(metrics.inpMs ?? 0, entry.duration)
  })
  observe('longtask', (entries) => { metrics.longTasks += entries.length })
  observe('navigation', (entries) => {
    const navigation = entries[0] as PerformanceNavigationTiming | undefined
    if (navigation) metrics.navigationMs = Math.round(navigation.duration * 100) / 100
  })
}

export function installRuntimeMonitoring(app: App): void {
  if (installed || typeof window === 'undefined') return
  installed = true
  app.config.errorHandler = (error, _instance, info) => {
    reportRuntimeDiagnostic('error', 'vue', error, { info })
  }
  window.addEventListener('error', (event) => {
    if (event.target && event.target !== window) {
      const target = event.target as HTMLElement
      reportRuntimeDiagnostic('warning', 'network', `Resource failed to load: ${target.tagName.toLowerCase()}`, { resource: target.getAttribute('src') ?? target.getAttribute('href') ?? '' })
      return
    }
    reportRuntimeDiagnostic('error', 'runtime', event.error ?? event.message, { filename: event.filename || '', line: event.lineno || 0 })
  }, true)
  window.addEventListener('unhandledrejection', (event) => {
    reportRuntimeDiagnostic('error', 'runtime', event.reason, { unhandledRejection: true })
  })
  installPerformanceObservers()
}

export function disconnectRuntimeMonitoring(): void {
  for (const observer of observers.splice(0)) observer.disconnect()
}
