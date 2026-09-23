import { ref } from 'vue'
import type { EditorSnapshot } from '../types/editorSnapshot'
import { editorSnapshotToCertificateCards, editorSnapshotToSiteSnapshot } from '../editor/editorSnapshot'
import {
  guestPublishedRepository,
  type GuestPublishedRepository,
  type RevisionRecord
} from '../repositories/editorRevisionRepository'
import { useCertificatesStore } from '../stores/certificates'
import { useSiteStore } from '../stores/site'
import { loadDefaultRuntimeTemplate } from './defaultRuntimeSnapshot'

export const activePublishedEditorSnapshot = ref<EditorSnapshot | null>(null)
export const activeGuestEditorSnapshot = ref<EditorSnapshot | null>(null)
export const activeGuestRuntimeSource = ref<'default' | 'published' | null>(null)

export type GuestRuntimeResolution =
  | {
      source: 'default'
      snapshot: EditorSnapshot
      revision: null
      templateVersion: number
    }
  | {
      source: 'published'
      snapshot: EditorSnapshot
      revision: RevisionRecord
      templateVersion: null
    }

export interface PublishedRuntimeInitializationOptions {
  force?: boolean
  repository?: GuestPublishedRepository
}

let runtimeCache: GuestRuntimeResolution | null = null
let initializationPromise: Promise<GuestRuntimeResolution | null> | null = null
let initializationSequence = 0

function cloneResolution(resolution: GuestRuntimeResolution): GuestRuntimeResolution {
  return structuredClone(resolution)
}

export async function resolveGuestRuntimeSnapshot(
  repository: GuestPublishedRepository = guestPublishedRepository
): Promise<GuestRuntimeResolution> {
  const active = await repository.loadPublishedSnapshot()
  if (!active) {
    const template = loadDefaultRuntimeTemplate()
    return {
      source: 'default',
      snapshot: template.snapshot,
      revision: null,
      templateVersion: template.templateVersion
    }
  }

  const snapshot = await repository.resolvePublishedMedia(active.snapshot)
  return {
    source: 'published',
    snapshot,
    revision: active.revision,
    templateVersion: null
  }
}

function hydrateRuntime(resolution: GuestRuntimeResolution): void {
  const site = useSiteStore()
  const certificates = useCertificatesStore()
  const snapshot = structuredClone(resolution.snapshot)

  activeGuestEditorSnapshot.value = snapshot
  activeGuestRuntimeSource.value = resolution.source
  activePublishedEditorSnapshot.value = resolution.source === 'published' ? structuredClone(snapshot) : null

  if (resolution.source === 'published') {
    site.hydratePublishedRuntime(editorSnapshotToSiteSnapshot(snapshot), {
      revisionNumber: resolution.revision.revision_number,
      publishedAt: resolution.revision.published_at
    })
  } else {
    site.hydrateDefaultRuntime(editorSnapshotToSiteSnapshot(snapshot), resolution.templateVersion)
  }
}

export async function initializePublishedRuntime(
  options: PublishedRuntimeInitializationOptions = {}
): Promise<GuestRuntimeResolution | null> {
  const site = useSiteStore()
  const repository = options.repository ?? guestPublishedRepository
  const usesApplicationRepository = repository === guestPublishedRepository

  if (!options.force && usesApplicationRepository && runtimeCache) {
    const cached = cloneResolution(runtimeCache)
    hydrateRuntime(cached)
    return cached
  }
  if (!options.force && usesApplicationRepository && initializationPromise) return initializationPromise

  const sequence = usesApplicationRepository ? ++initializationSequence : null
  const initialize = async (): Promise<GuestRuntimeResolution | null> => {
    try {
      const resolution = await resolveGuestRuntimeSnapshot(repository)
      if (sequence !== null && sequence !== initializationSequence) return null
      if (usesApplicationRepository) runtimeCache = cloneResolution(resolution)
      hydrateRuntime(resolution)
      return cloneResolution(resolution)
    } catch (error) {
      if (sequence !== null && sequence !== initializationSequence) return null
      activePublishedEditorSnapshot.value = null
      activeGuestEditorSnapshot.value = null
      activeGuestRuntimeSource.value = null
      site.markPublishedRuntimeError(error instanceof Error ? error.message : 'Published Runtime could not be loaded.')
      return null
    }
  }

  if (!usesApplicationRepository) return initialize()
  const pendingInitialization = initialize()
  initializationPromise = pendingInitialization
  try { return await pendingInitialization }
  finally {
    if (initializationPromise === pendingInitialization) initializationPromise = null
  }
}

export function invalidatePublishedRuntimeCache(revisionNumber: number): void {
  runtimeCache = null
  if (typeof window === 'undefined') return
  const value = JSON.stringify({ revisionNumber, invalidatedAt: Date.now() })
  window.localStorage.setItem('portfolio-published-runtime', value)
  if ('BroadcastChannel' in window) {
    const channel = new BroadcastChannel('portfolio-published-runtime')
    channel.postMessage({ revisionNumber })
    channel.close()
  }
}

export function subscribePublishedRuntimeInvalidation(): () => void {
  if (typeof window === 'undefined') return () => undefined
  let refreshInFlight = false
  let refreshRequested = false
  const refresh = async () => {
    if (refreshInFlight) {
      refreshRequested = true
      return
    }
    refreshInFlight = true
    try {
      do {
        refreshRequested = false
        runtimeCache = null
        await initializePublishedRuntime({ force: true })
      } while (refreshRequested)
    } finally {
      refreshInFlight = false
    }
  }
  const onStorage = (event: StorageEvent) => {
    if (event.key === 'portfolio-published-runtime' && event.newValue) void refresh()
  }
  window.addEventListener('storage', onStorage)
  const channel = 'BroadcastChannel' in window
    ? new BroadcastChannel('portfolio-published-runtime')
    : null
  if (channel) channel.onmessage = () => void refresh()
  return () => {
    window.removeEventListener('storage', onStorage)
    channel?.close()
  }
}
