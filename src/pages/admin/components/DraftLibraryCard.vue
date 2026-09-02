<script setup lang="ts">
import { Heart, LoaderCircle, PencilLine, Trash2 } from 'lucide-vue-next'
import type { RevisionRecord } from '../../../repositories/editorRevisionRepository'

const props = withDefaults(defineProps<{
  revision: RevisionRecord
  favorite?: boolean
  busy?: boolean
}>(), {
  favorite: false,
  busy: false
})

const emit = defineEmits<{
  open: []
  favorite: []
  delete: []
}>()

function title(): string {
  return props.revision.snapshot.content.portfolio.title || `Draft ${props.revision.revision_number}`
}

function summary(): string {
  return props.revision.snapshot.session.selectedSection || 'Portfolio'
}

function relative(value: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - Date.parse(value)) / 1000))
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h ago`
  return `${Math.round(seconds / 86400)}d ago`
}

function thumbnailStyle(): Record<string, string> {
  const reference = props.revision.snapshot.media.references.find((candidate) => /^(https?:|blob:|data:|\/)/i.test(candidate.uri) && !candidate.uri.startsWith('/draft/'))
  return reference ? { backgroundImage: `url(${reference.uri})` } : {}
}
</script>

<template>
  <article class="draft-library-card" :aria-busy="busy">
    <button type="button" class="draft-library-card__surface" :aria-label="`Open ${title()} in Editor`" :disabled="busy" @click="emit('open')">
      <span class="draft-library-card__preview" :style="thumbnailStyle()"><strong>{{ summary() }}</strong></span>
      <span class="draft-library-card__copy">
        <strong>{{ title() }}</strong>
        <small>Revision {{ revision.revision_number }} · base {{ revision.base_revision_number ?? '—' }}</small>
        <small>Modified {{ relative(revision.updated_at) }}</small>
      </span>
    </button>
    <footer>
      <button type="button" class="draft-library-card__favorite" :aria-label="favorite ? 'Remove favorite' : 'Add favorite'" :aria-pressed="favorite" :disabled="busy" @click="emit('favorite')">
        <LoaderCircle v-if="busy" class="product-spin" :size="17" aria-hidden="true" />
        <Heart v-else :size="18" :fill="favorite ? 'currentColor' : 'none'" aria-hidden="true" />
      </button>
      <button type="button" :disabled="busy" @click="emit('open')"><PencilLine :size="15" aria-hidden="true" />Open in Editor</button>
      <button type="button" class="is-danger" :disabled="busy" @click="emit('delete')"><Trash2 :size="15" aria-hidden="true" />Delete Draft</button>
    </footer>
  </article>
</template>

<style scoped>
.draft-library-card{overflow:hidden;border:1px solid #e5d8cf;border-radius:22px;color:#5a3e35;background:#fff;box-shadow:0 .5rem 1.6rem -1rem rgba(73,54,47,.38);transition:transform var(--product-motion-standard) var(--product-ease),box-shadow var(--product-motion-standard) var(--product-ease),border-color var(--product-motion-standard) var(--product-ease)}.draft-library-card:hover{transform:translateY(-3px);border-color:#dbc4ba;box-shadow:0 1rem 2rem -1rem rgba(73,54,47,.42)}.draft-library-card__surface{width:100%;display:grid;padding:0;border:0;color:inherit;background:transparent;text-align:left;cursor:pointer}.draft-library-card__preview{height:132px;display:flex;align-items:flex-end;padding:1rem;background:#eadfd4 center/cover;color:#fff;text-shadow:0 1px 5px #49362f}.draft-library-card__preview strong{padding:.28rem .55rem;border-radius:999px;background:rgba(73,54,47,.66);font-size:.68rem;letter-spacing:.05em;text-transform:uppercase}.draft-library-card__copy{display:grid;gap:.3rem;padding:1rem 1rem .8rem}.draft-library-card__copy>strong{overflow:hidden;font-size:1.02rem;text-overflow:ellipsis;white-space:nowrap}.draft-library-card__copy small{color:#8c7568;font-size:.72rem}.draft-library-card footer{display:flex;align-items:center;gap:.45rem;padding:0 1rem 1rem}.draft-library-card footer button{min-height:2.35rem;display:inline-flex;align-items:center;justify-content:center;gap:.3rem;padding:.55rem .7rem;border:1px solid #e2d5cb;border-radius:999px;color:#684e45;background:#fff9f2;font-size:.68rem;font-weight:800;cursor:pointer}.draft-library-card footer button:hover:not(:disabled){border-color:#d4b7ac;background:#fff3e9}.draft-library-card footer .draft-library-card__favorite{flex:0 0 2.35rem;width:2.35rem;padding:0;color:#b14d61}.draft-library-card footer .is-danger{margin-left:auto;color:#963f47}.draft-library-card button:disabled{cursor:wait;opacity:.6}.product-spin{animation:product-card-spin .8s linear infinite}@keyframes product-card-spin{to{transform:rotate(360deg)}}
@media(max-width:520px){.draft-library-card footer{flex-wrap:wrap}.draft-library-card footer button:not(.draft-library-card__favorite){flex:1}.draft-library-card footer .is-danger{margin-left:0}}
@media(prefers-reduced-motion:reduce){.draft-library-card{transition:none}.product-spin{animation:none}}
</style>

