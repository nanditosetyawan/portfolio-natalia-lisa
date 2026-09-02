<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Heart, LoaderCircle, RefreshCw } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import ProductEmptyState from '../../components/ProductEmptyState.vue'
import ProductSkeleton from '../../components/ProductSkeleton.vue'
import { productFeedback } from '../../composables/useProductFeedback'
import { editorDraftRepository, favoriteRepository, type FavoriteDraft } from '../../repositories/editorRevisionRepository'
import DraftLibraryCard from './components/DraftLibraryCard.vue'

const router = useRouter()
const favorites = ref<FavoriteDraft[]>([])
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
    favorites.value = await favoriteRepository.listFavorites()
  } catch (error) {
    errorMessage.value = normalizeError(error, 'Favorites could not be loaded.')
    productFeedback.error('Favorites unavailable', errorMessage.value)
  } finally {
    loading.value = false
  }
}

function openDraft(id: string): void {
  void router.push({ name: 'admin-edit', query: { draft: id, source: 'favorite' } })
}

async function removeFavorite(id: string): Promise<void> {
  pendingId.value = id
  errorMessage.value = ''
  try {
    await favoriteRepository.removeFavorite(id)
    favorites.value = favorites.value.filter((item) => item.revision.id !== id)
    productFeedback.success('Removed from Favorites', 'The Draft remains available in Draft Library.')
  } catch (error) {
    errorMessage.value = normalizeError(error, 'Favorite could not be removed.')
    productFeedback.error('Favorite update failed', errorMessage.value)
  } finally {
    pendingId.value = null
  }
}

async function deleteDraft(id: string): Promise<void> {
  const accepted = await productFeedback.confirm({
    title: 'Delete this Draft?',
    message: 'The underlying Draft and this Favorite reference will be removed. Published and Guest Runtime remain unchanged.',
    confirmLabel: 'Delete Draft',
    tone: 'danger'
  })
  if (!accepted) return
  pendingId.value = id
  errorMessage.value = ''
  try {
    await editorDraftRepository.discardDraft(id)
    favorites.value = favorites.value.filter((item) => item.revision.id !== id)
    productFeedback.success('Draft deleted', 'The Favorite reference was removed automatically.')
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
    <header class="library-heading"><div><p class="eyebrow">Workspace</p><h1>Favorite Drafts</h1><p>Your quick access to saved design directions.</p></div></header>
    <p v-if="errorMessage && favorites.length" class="notice" role="alert">{{ errorMessage }} <button type="button" @click="void load(false)">Retry</button></p>
    <div class="library-meta"><span>{{ favorites.length }} / 8 favorites</span><button type="button" :disabled="loading" @click="void load()"><LoaderCircle v-if="loading" class="spin" :size="15" /><RefreshCw v-else :size="15" />Refresh</button></div>

    <ProductSkeleton v-if="loading" variant="cards" :count="3" label="Loading Favorite Drafts" />
    <ProductEmptyState v-else-if="errorMessage && !favorites.length" title="Favorites could not be loaded" :description="errorMessage" eyebrow="Connection issue" :icon="RefreshCw" tone="error">
      <button type="button" @click="void load()">Retry</button>
      <button type="button" @click="router.push('/admin/drafts')">Open Draft Library</button>
    </ProductEmptyState>
    <ProductEmptyState v-else-if="!favorites.length" title="No Favorite Drafts yet" description="Mark a saved Draft with the heart action to keep it close without duplicating its Snapshot." :icon="Heart">
      <button type="button" @click="router.push('/admin/drafts')">Browse Drafts</button>
      <button type="button" @click="void load()">Refresh</button>
    </ProductEmptyState>
    <div v-else class="draft-grid">
      <DraftLibraryCard
        v-for="item in favorites"
        :key="item.revision.id"
        :revision="item.revision"
        favorite
        :busy="pendingId === item.revision.id"
        @open="openDraft(item.revision.id)"
        @favorite="void removeFavorite(item.revision.id)"
        @delete="void deleteDraft(item.revision.id)"
      />
    </div>
  </section>
</template>

<style scoped>
.library-page{max-width:1180px;margin:0 auto;color:#49362f}.library-heading{margin-bottom:1.5rem}.eyebrow{margin:0;color:#b45f69;font-size:.72rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase}.library-heading h1{margin:.25rem 0;font-size:2rem;color:#5a3e35}.library-heading p{margin:0;color:#7b5f3b}.library-meta{display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;color:#7b5f3b;font-size:.85rem}.library-meta button{min-height:2.55rem;display:inline-flex;align-items:center;justify-content:center;gap:.35rem;border:1px solid #decfc5;border-radius:999px;background:#fff5eb;color:#5a3e35;padding:.65rem 1rem;cursor:pointer;font-weight:800}.draft-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:1rem}.notice{padding:.8rem 1rem;border:1px solid #d99898;border-radius:16px;background:#fff2ee;color:#8d363a;margin-bottom:1rem}.notice button{border:0;color:inherit;background:transparent;font-weight:800;text-decoration:underline;cursor:pointer}.spin{animation:library-spin .8s linear infinite}@keyframes library-spin{to{transform:rotate(360deg)}}
@media(max-width:640px){.draft-grid{grid-template-columns:1fr}}
@media(prefers-reduced-motion:reduce){.spin{animation:none}}
</style>
