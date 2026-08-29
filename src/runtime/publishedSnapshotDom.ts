import { applyRegisteredSnapshotProperties } from '../editor/propertyRuntime'
import type { EditorSnapshot } from '../types/editorSnapshot'

/**
 * Guest styling deliberately delegates to the same metadata registry used by
 * the Editor preview. Adding a registered snapshot property therefore does
 * not require a second Guest-specific mapper.
 */
export function applyPublishedSnapshotDom(root: HTMLElement, snapshot: EditorSnapshot): void {
  applyRegisteredSnapshotProperties(root, snapshot)
}
