import { ref } from 'vue'

type SaveAction = () => Promise<void>

export const editorHasChanges = ref(false)
export const editorSaveStatus = ref('')

let saveAction: SaveAction | null = null

export function registerEditorSave(action: SaveAction): () => void {
  saveAction = action 
  return () => {
    if (saveAction === action) saveAction = null
  }
}

export function markEditorChanged(): void {
  editorHasChanges.value = true
  editorSaveStatus.value = 'Unsaved Changes'
}

export async function saveEditor(): Promise<void> {
  if (!saveAction) return
  await saveAction()
}
