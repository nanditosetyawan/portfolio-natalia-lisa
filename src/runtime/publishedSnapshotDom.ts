import { applyRegisteredSnapshotProperties } from '../editor/propertyRuntime'
import type { EditorSnapshot } from '../types/editorSnapshot'
import { applyAnimationRuntime } from './animationRuntime'
import { renderDynamicInstances } from './dynamicInstanceRuntime'
import { createEditorObject } from '../editor/objectRegistry'
import { applyResponsiveObjectProperties, responsiveBreakpointForWidth, restoreResponsiveSnapshotProperties } from '../editor/responsiveLayout'
import { editorSectionLabel } from '../editor/editorInstances'

/**
 * Guest styling deliberately delegates to the same metadata registry used by
 * the Editor preview. Adding a registered snapshot property therefore does
 * not require a second Guest-specific mapper.
 */
export function applyPublishedSnapshotDom(root: HTMLElement, snapshot: EditorSnapshot): void {
  renderDynamicInstances(root, snapshot)
  restoreResponsiveSnapshotProperties(root)
  applyRegisteredSnapshotProperties(root, snapshot)
  const breakpoint = responsiveBreakpointForWidth(root.clientWidth || window.innerWidth)
  for (const [order, entity] of (snapshot.entities ?? []).entries()) {
    const object = createEditorObject({
      id: entity.entityId,
      section: entity.section,
      label: entity.label,
      kind: entity.kind,
      isMedia: entity.kind === 'media'
    }, order)
    applyResponsiveObjectProperties(root, snapshot, object, breakpoint)
  }
  for (const [order, instance] of (snapshot.instances ?? []).entries()) {
    const object = createEditorObject({
      id: instance.instanceId,
      section: editorSectionLabel(snapshot, instance.sectionId),
      label: instance.label,
      kind: 'media',
      objectType: 'Image',
      isMedia: true,
      ux: { dynamicInstance: true }
    }, order)
    applyResponsiveObjectProperties(root, snapshot, object, breakpoint)
  }
  applyAnimationRuntime(root, snapshot, { autoplayEntrance: true, respectReducedMotion: true })
}
