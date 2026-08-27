import { ref } from 'vue'

type PublishAction = (note: string) => Promise<void>

export const editorPublishStatus = ref('')
export const editorPublishErrors = ref<string[]>([])

let publishAction: PublishAction | null = null

export function registerEditorPublish(action: PublishAction): () => void {
  publishAction = action
  return () => {
    if (publishAction === action) publishAction = null
  }
}

export async function publishEditor(note = ''): Promise<void> {
  if (!publishAction) throw new Error('Publish is not available outside the Editor.')
  await publishAction(note)
}

export function resetEditorPublishFeedback(): void {
  editorPublishStatus.value = ''
  editorPublishErrors.value = []
}
