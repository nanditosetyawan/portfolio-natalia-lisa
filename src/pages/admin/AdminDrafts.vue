<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { FileText, LoaderCircle, RefreshCw } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import ProductEmptyState from '../../components/ProductEmptyState.vue'
import ProductSkeleton from '../../components/ProductSkeleton.vue'
import { productFeedback } from '../../composables/useProductFeedback'
import {
  editorDraftRepository,
  favoriteRepository,
  FavoriteLimitError,
  type SaveDraftResult
} from '../../repositories/editorRevisionRepository'
import DraftLibraryCard from './components/DraftLibraryCard.vue'

const router = useRouter()
const drafts = ref<SaveDraftResult[]>([])
const favorites = ref(new Set<string>())
const loading = ref(true)
const errorMessage = ref('')
const pendingId = ref<string | null>(null)

function normalizeError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

async function load(showSkeleton = true): Promise<void> {
  if (showSkeleton) loading.value = true
  errorMessage.value = ''
  try {
    const [nextDrafts, nextFavorites] = await Promise.all([
      editorDraftRepository.listDrafts(),
      favoriteRepository.listFavorites()
    ])
    drafts.value = nextDrafts
    favorites.value = new Set(nextFavorites.map((item) => item.revision.id))
  } catch (error) {
    errorMessage.value = normalizeError(error, 'Drafts could not be loaded.')
    productFeedback.error('Draft Library unavailable', errorMessage.value)
  } finally {
    loading.value = false
  }
}

function openDraft(id: string): void {
  void router.push({ name: 'admin-edit', query: { draft: id } })
}

function openNew(): void {
  void router.push({ name: 'admin-edit', query: { draft: 'new' } })
}

function isFavorite(id: string): boolean {
  return favorites.value.has(id)
}

async function toggleFavorite(item: SaveDraftResult): Promise<void> {
  pendingId.value = item.revision.id
  errorMessage.value = ''
  try {
    const removing = isFavorite(item.revision.id)
    if (removing) {
      await favoriteRepository.removeFavorite(item.revision.id)
      favorites.value.delete(item.revision.id)
    } else {
      await favoriteRepository.addFavorite(item.revision.id)
      favorites.value.add(item.revision.id)
    }
    favorites.value = new Set(favorites.value)
    productFeedback.success(removing ? 'Removed from Favorites' : 'Added to Favorites', 'The Draft itself remains unchanged.')
  } catch (error) {
    errorMessage.value = error instanceof FavoriteLimitError ? error.message : normalizeError(error, 'Favorite update failed.')
    productFeedback.error('Favorite update failed', errorMessage.value)
  } finally {
    pendingId.value = null
  }
}

async function deleteDraft(item: SaveDraftResult): Promise<void> {
  const accepted = await productFeedback.confirm({
    title: 'Delete this Draft?',
    message: 'The Draft and its Favorite reference will be removed. Published and Guest Runtime remain unchanged.',
    confirmLabel: 'Delete Draft',
    tone: 'danger'
  })
  if (!accepted) return
  pendingId.value = item.revision.id
  errorMessage.value = ''
  try {
    await editorDraftRepository.discardDraft(item.revision.id)
    await load(false)
    productFeedback.success('Draft deleted', 'Published and Guest Runtime were not modified.')
  } catch (error) {
    errorMessage.value = normalizeError(error, 'Draft could not be deleted.')
    productFeedback.error('Draft deletion failed', errorMessage.value)
  } finally {
    pendingId.value = null
  }
}

onMounted(() => void load())
</script>

<template>
  <section class="library-page">
    <header class="library-heading">
      <div><p class="eyebrow">Workspace</p><h1>Draft Library</h1><p>Saved editor workspaces, ready to continue.</p></div>
      <button class="new-draft" type="button" @click="openNew">New draft</button>
    </header>
    <p v-if="errorMessage && drafts.length" class="notice notice-error" role="alert">{{ errorMessage }} <button type="button" @click="void load(false)">Retry</button></p>
    <div class="library-meta"><span>{{ drafts.length }} / 10 drafts</span><button type="button" :disabled="loading" @click="void load()"><LoaderCircle v-if="loading" class="spin" :size="15" /><RefreshCw v-else :size="15" />Refresh</button></div>

    <ProductSkeleton v-if="loading" variant="cards" :count="3" label="Loading saved Drafts" />
    <ProductEmptyState v-else-if="errorMessage && !drafts.length" title="Drafts could not be loaded" :description="errorMessage" eyebrow="Connection issue" :icon="RefreshCw" tone="error">
      <button type="button" @click="void load()">Retry</button>
      <button type="button" @click="openNew">Open a new workspace</button>
    </ProductEmptyState>
    <ProductEmptyState v-else-if="!drafts.length" title="No saved Drafts yet" description="Start from the current Published portfolio, then Save Draft when your workspace is ready." :icon="FileText">
      <button type="button" @click="openNew">Create a Draft</button>
      <button type="button" @click="void load()">Refresh</button>
    </ProductEmptyState>
    <div v-else class="draft-grid">
      <DraftLibraryCard
        v-for="item in drafts"
        :key="item.revision.id"
        :revision="item.revision"
        :favorite="isFavorite(item.revision.id)"
        :busy="pendingId === item.revision.id"
        @open="openDraft(item.revision.id)"
        @favorite="void toggleFavorite(item)"
        @delete="void deleteDraft(item)"
      />
    </div>
  </section>
</template>

<style scoped>
.library-page{max-width:1180px;margin:0 auto;color:#49362f}.library-heading{display:flex;justify-content:space-between;align-items:end;gap:1rem;margin-bottom:1.5rem}.eyebrow{margin:0;color:#b45f69;font-size:.72rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase}.library-heading h1{margin:.25rem 0;font-size:2rem;color:#5a3e35}.library-heading p{margin:0;color:#7b5f3b}.new-draft,.library-meta button{min-height:2.55rem;display:inline-flex;align-items:center;justify-content:center;gap:.35rem;border:1px solid #decfc5;border-radius:999px;background:#fff5eb;color:#5a3e35;padding:.65rem 1rem;cursor:pointer;font-weight:800}.new-draft{border-color:#b85b69;color:#fff;background:#b85b69}.library-meta{display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;color:#7b5f3b;font-size:.85rem}.draft-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:1rem}.notice{padding:.8rem 1rem;border:1px solid #d99898;border-radius:16px;background:#fff2ee;color:#8d363a;margin-bottom:1rem}.notice button{border:0;color:inherit;background:transparent;font-weight:800;text-decoration:underline;cursor:pointer}.spin{animation:library-spin .8s linear infinite}@keyframes library-spin{to{transform:rotate(360deg)}}
@media(max-width:640px){.library-heading{align-items:start;flex-direction:column}.new-draft{width:100%}.library-meta{align-items:center}.draft-grid{grid-template-columns:1fr}}
@media(prefers-reduced-motion:reduce){.spin{animation:none}}
</style>
