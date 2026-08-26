<template>
  <section class="library-page">
    <div class="library-heading">
      <div><p class="eyebrow">Workspace</p><h1>Draft Library</h1><p>Saved editor workspaces, ready to continue.</p></div>
      <button class="new-draft" type="button" @click="openNew">New draft</button>
    </div>
    <p v-if="errorMessage" class="notice notice-error" role="alert">{{ errorMessage }}</p>
    <div class="library-meta"><span>{{ drafts.length }} / 10 drafts</span><button type="button" @click="load">Refresh</button></div>
    <div v-if="loading" class="empty-state">Loading drafts…</div>
    <div v-else-if="!drafts.length" class="empty-state">No saved drafts yet.</div>
    <div v-else class="draft-grid">
      <article v-for="item in drafts" :key="item.revision.id" class="draft-card" tabindex="0" @click="openDraft(item.revision.id)" @keydown.enter="openDraft(item.revision.id)" @keydown.space.prevent="openDraft(item.revision.id)">
        <div class="card-preview" :style="thumbnailStyle(item)"><span>{{ summary(item) }}</span></div>
        <div class="draft-body"><div class="draft-title-row"><h2>{{ title(item) }}</h2><button class="favorite-button" type="button" :aria-label="isFavorite(item.revision.id) ? 'Remove favorite' : 'Add favorite'" @click.stop="toggleFavorite(item)">{{ isFavorite(item.revision.id) ? '♥' : '♡' }}</button></div><p>Revision {{ item.revision.revision_number }} · base {{ item.revision.base_revision_number ?? '—' }}</p><p>{{ relative(item.revision.updated_at) }}</p><div class="draft-actions"><button type="button" @click.stop="openDraft(item.revision.id)">Open in Editor</button><button class="danger" type="button" @click.stop="deleteDraft(item)">Delete Draft</button></div></div>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { editorDraftRepository, favoriteRepository, FavoriteLimitError, type SaveDraftResult } from '../../repositories/editorRevisionRepository'

const router = useRouter()
const drafts = ref<SaveDraftResult[]>([])
const favorites = ref(new Set<string>())
const loading = ref(false)
const errorMessage = ref('')

async function load() { loading.value = true; errorMessage.value = ''; try { drafts.value = await editorDraftRepository.listDrafts(); favorites.value = new Set((await favoriteRepository.listFavorites()).map((item) => item.revision.id)) } catch (error) { errorMessage.value = error instanceof Error ? error.message : 'Drafts could not be loaded.' } finally { loading.value = false } }
function openDraft(id: string) { void router.push({ name: 'admin-edit', query: { draft: id } }) }
function openNew() { void router.push({ name: 'admin-edit', query: { draft: 'new' } }) }
function title(item: SaveDraftResult) { return item.revision.snapshot.content.portfolio.title || `Draft ${item.revision.revision_number}` }
function summary(item: SaveDraftResult) { return item.revision.snapshot.session.selectedSection || 'Portfolio' }
function isFavorite(id: string) { return favorites.value.has(id) }
async function toggleFavorite(item: SaveDraftResult) { try { if (isFavorite(item.revision.id)) { await favoriteRepository.removeFavorite(item.revision.id); favorites.value.delete(item.revision.id) } else { await favoriteRepository.addFavorite(item.revision.id); favorites.value.add(item.revision.id) }; favorites.value = new Set(favorites.value) } catch (error) { errorMessage.value = error instanceof FavoriteLimitError ? error.message : error instanceof Error ? error.message : 'Favorite update failed.' } }
async function deleteDraft(item: SaveDraftResult) { if (!window.confirm('Delete this draft?')) return; try { await editorDraftRepository.discardDraft(item.revision.id); await load() } catch (error) { errorMessage.value = error instanceof Error ? error.message : 'Draft could not be deleted.' } }
function relative(value: string) { const seconds = Math.max(0, Math.round((Date.now() - Date.parse(value)) / 1000)); if (seconds < 60) return 'just now'; if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`; if (seconds < 86400) return `${Math.round(seconds / 3600)}h ago`; return `${Math.round(seconds / 86400)}d ago` }
function thumbnailStyle(item: SaveDraftResult) { const ref = item.revision.snapshot.media.references.find((candidate) => /^(https?:|blob:|data:|\/)/i.test(candidate.uri) && !candidate.uri.startsWith('/draft/')); return ref ? { backgroundImage: `url(${ref.uri})` } : {} }
onMounted(load)
</script>

<style scoped>
.library-page{max-width:1180px;margin:0 auto;color:#49362f}.library-heading{display:flex;justify-content:space-between;align-items:end;gap:1rem;margin-bottom:1.5rem}.eyebrow{margin:0;color:#b45f04;font-size:.72rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase}.library-heading h1{margin:.25rem 0;font-size:2rem;color:#5a3e35}.library-heading p{margin:0;color:#7b5f3b}.new-draft,.library-meta button,.draft-actions button{border:1px solid #e8ded0;border-radius:999px;background:#fff5eb;color:#5a3e35;padding:.65rem 1rem;cursor:pointer;font-weight:700}.library-meta{display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;color:#7b5f3b;font-size:.85rem}.draft-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:1rem}.draft-card{overflow:hidden;background:#fff;border:1px solid #e8ded0;border-radius:22px;box-shadow:0 8px 25px -16px #5a3e35;cursor:pointer;outline:none;transition:transform .2s,box-shadow .2s}.draft-card:hover,.draft-card:focus-visible{transform:translateY(-3px);box-shadow:0 14px 28px -14px #5a3e35}.draft-card:focus-visible{box-shadow:0 0 0 3px #ff9a86}.card-preview{height:130px;background:#f2e7dc center/cover;display:flex;align-items:end;padding:1rem;color:#fff;font-weight:800;text-shadow:0 1px 4px #49362f}.draft-body{padding:1rem}.draft-title-row{display:flex;align-items:start;justify-content:space-between;gap:.5rem}.draft-body h2{margin:0;color:#5a3e35;font-size:1.05rem}.draft-body p{margin:.35rem 0;color:#8c7568;font-size:.8rem}.favorite-button{border:0;background:transparent;color:#b45f69;font-size:1.5rem;cursor:pointer}.draft-actions{display:flex;gap:.5rem;margin-top:1rem}.draft-actions .danger{color:#8d363a}.empty-state,.notice{padding:2rem;border:1px dashed #d9c7b9;border-radius:18px;background:#fffaf4;color:#7b5f3b}.notice-error{border-color:#d99898;color:#8d363a;margin-bottom:1rem}@media(max-width:640px){.library-heading{align-items:start;flex-direction:column}.draft-actions{flex-wrap:wrap}}
</style>
