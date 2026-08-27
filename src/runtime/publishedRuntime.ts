import { ref } from 'vue'
import type { EditorSnapshot } from '../types/editorSnapshot'
import { editorSnapshotToCertificateCards, editorSnapshotToSiteSnapshot } from '../editor/editorSnapshot'
import { guestPublishedRepository } from '../repositories/editorRevisionRepository'
import { useCertificatesStore } from '../stores/certificates'
import { useSiteStore } from '../stores/site'

export const activePublishedEditorSnapshot = ref<EditorSnapshot | null>(null)

export async function initializePublishedRuntime(): Promise<void> {
  const site = useSiteStore()
  const certificates = useCertificatesStore()
  try {
    const active = await guestPublishedRepository.loadPublishedSnapshot()
    if (!active) {
      activePublishedEditorSnapshot.value = null
      site.markPublishedRuntimeUnavailable()
      return
    }
    const resolved = await guestPublishedRepository.resolvePublishedMedia(active.snapshot)
    activePublishedEditorSnapshot.value = structuredClone(resolved)
    site.hydratePublishedRuntime(editorSnapshotToSiteSnapshot(resolved), {
      revisionNumber: active.revision.revision_number,
      publishedAt: active.revision.published_at
    })
    certificates.hydrateEditorCards(editorSnapshotToCertificateCards(resolved))
  } catch (error) {
    activePublishedEditorSnapshot.value = null
    site.markPublishedRuntimeError(error instanceof Error ? error.message : 'Published Runtime could not be loaded.')
  }
}

export function invalidatePublishedRuntimeCache(revisionNumber: number): void {
  if (typeof window === 'undefined') return
  const value = JSON.stringify({ revisionNumber, invalidatedAt: Date.now() })
  window.localStorage.setItem('portfolio-published-runtime', value)
  if ('BroadcastChannel' in window) {
    const channel = new BroadcastChannel('portfolio-published-runtime')
    channel.postMessage({ revisionNumber })
    channel.close()
  }
}
