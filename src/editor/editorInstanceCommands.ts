import type { EditorValue } from '../types/editor'
import type {
  EditorInstance,
  EditorSnapshot,
  LayoutSettings,
  MediaAssignment,
  MediaStyleSettings,
  SnapshotMediaReference
} from '../types/editorSnapshot'
import {
  assertCanInsertEditorInstance,
  createDynamicImageInstance,
  findEditorInstance
} from './editorInstances'
import { cloneResponsiveObjectChanges, removeResponsiveObjectChanges } from './responsiveLayout'

export interface InstanceMutationChange {
  propertyPath: string
  nextValue: EditorValue
}

export interface InsertImageInstanceInput {
  section: string
  reference: SnapshotMediaReference
  label?: string
  layout: LayoutSettings
  objectPosition?: string
  instanceId?: string
  createdAt?: string
}

export interface InstanceMutationResult {
  instance: EditorInstance
  changes: InstanceMutationChange[]
}

export interface DuplicateImageInstanceInput {
  sourceObjectId: string
  sourceAssignmentEntityId: string
  sourceSection: string
  sourceLabel: string
  fallbackLayout: LayoutSettings
}

const clone = <T>(value: T): T => {
  try { return structuredClone(value) }
  catch { return JSON.parse(JSON.stringify(value)) as T }
}

function applyChanges(snapshot: EditorSnapshot, changes: InstanceMutationChange[]): void {
  const root = snapshot as unknown as Record<string, unknown>
  for (const change of changes) {
    const segments = change.propertyPath.split('.')
    let parent = root
    for (const segment of segments.slice(0, -1)) {
      const current = parent[segment]
      if (!current || typeof current !== 'object' || Array.isArray(current)) parent[segment] = {}
      parent = parent[segment] as Record<string, unknown>
    }
    const leaf = segments.at(-1)
    if (!leaf) continue
    if (change.nextValue === undefined) delete parent[leaf]
    else parent[leaf] = clone(change.nextValue)
  }
}

function offsetGeometry(value: number | string | undefined, delta: number): number | string {
  if (typeof value === 'number') return Number((value + delta).toFixed(3))
  if (typeof value === 'string') {
    const match = value.trim().match(/^(-?\d+(?:\.\d+)?)(px)?$/i)
    if (match) return `${Number((Number(match[1]) + delta).toFixed(3))}${match[2] ?? ''}`
  }
  return delta
}

function upsertReference(references: SnapshotMediaReference[], reference: SnapshotMediaReference): SnapshotMediaReference[] {
  return [...references.filter((candidate) => candidate.assetId !== reference.assetId), clone(reference)]
}

function initialMediaStyle(reference: SnapshotMediaReference): MediaStyleSettings {
  const ratio = reference.width && reference.height ? reference.width / reference.height : undefined
  return {
    hoverEnabled: false,
    outlineEnabled: false,
    outlineWidth: 1,
    aspectRatioLocked: false,
    ...(ratio && Number.isFinite(ratio) && ratio > 0 ? { aspectRatio: ratio } : {})
  }
}

export function insertImageInstanceChanges(snapshot: EditorSnapshot, input: InsertImageInstanceInput): InstanceMutationResult {
  assertCanInsertEditorInstance(snapshot, input.section)
  const instance = createDynamicImageInstance(snapshot, input.section, input.label, input.instanceId, input.createdAt)
  const assignment: MediaAssignment = {
    entityId: instance.instanceId,
    role: 'dynamic-image',
    assetId: input.reference.assetId,
    objectPosition: input.objectPosition ?? '50% 50%'
  }
  return {
    instance,
    changes: [
      { propertyPath: 'instances', nextValue: [...clone(snapshot.instances), instance] as unknown as EditorValue },
      { propertyPath: 'media.references', nextValue: upsertReference(snapshot.media.references, input.reference) as unknown as EditorValue },
      { propertyPath: 'media.assignments', nextValue: [...clone(snapshot.media.assignments), assignment] as unknown as EditorValue },
      { propertyPath: `layout.${instance.instanceId}`, nextValue: { ...clone(input.layout), positionMode: 'absolute' } as unknown as EditorValue },
      { propertyPath: `media.styles.${instance.instanceId}`, nextValue: initialMediaStyle(input.reference) as unknown as EditorValue }
    ]
  }
}

export function duplicateImageInstanceChanges(
  snapshot: EditorSnapshot,
  sourceObjectId: string,
  sourceAssignmentEntityId: string,
  sourceSection: string,
  sourceLabel: string,
  fallbackLayout: LayoutSettings,
  offset = 24
): InstanceMutationResult | null {
  const assignment = snapshot.media.assignments.find((candidate) => candidate.entityId === sourceAssignmentEntityId)
  if (!assignment) return null
  assertCanInsertEditorInstance(snapshot, sourceSection)
  const instance = createDynamicImageInstance(snapshot, sourceSection, `${sourceLabel} Copy`)
  const sourceLayout = clone(snapshot.layout[sourceObjectId] ?? fallbackLayout)
  const nextLayout: LayoutSettings = {
    ...sourceLayout,
    positionMode: 'absolute',
    x: offsetGeometry(sourceLayout.x, offset),
    y: offsetGeometry(sourceLayout.y, offset)
  }
  const changes: InstanceMutationChange[] = [
    { propertyPath: 'instances', nextValue: [...clone(snapshot.instances), instance] as unknown as EditorValue },
    {
      propertyPath: 'media.assignments',
      nextValue: [...clone(snapshot.media.assignments), { ...clone(assignment), entityId: instance.instanceId, role: 'dynamic-image' }] as unknown as EditorValue
    },
    { propertyPath: `layout.${instance.instanceId}`, nextValue: nextLayout as unknown as EditorValue }
  ]

  for (const domain of ['typography', 'backgrounds', 'buttons', 'animations'] as const) {
    const value = snapshot[domain][sourceObjectId]
    if (value !== undefined) changes.push({ propertyPath: `${domain}.${instance.instanceId}`, nextValue: clone(value) as unknown as EditorValue })
  }
  const mediaStyle = snapshot.media.styles[sourceObjectId]
  if (mediaStyle !== undefined) changes.push({ propertyPath: `media.styles.${instance.instanceId}`, nextValue: clone(mediaStyle) as unknown as EditorValue })
  else {
    const reference = snapshot.media.references.find((candidate) => candidate.assetId === assignment.assetId)
    changes.push({ propertyPath: `media.styles.${instance.instanceId}`, nextValue: initialMediaStyle(reference ?? { assetId: assignment.assetId, uri: '' }) as unknown as EditorValue })
  }
  changes.push(...cloneResponsiveObjectChanges(snapshot, sourceObjectId, instance.instanceId))
  return { instance, changes }
}

export function duplicateImageInstancesChanges(
  snapshot: EditorSnapshot,
  inputs: DuplicateImageInstanceInput[]
): { instances: EditorInstance[]; changes: InstanceMutationChange[] } {
  const working = clone(snapshot)
  const instances: EditorInstance[] = []
  const finalChanges = new Map<string, EditorValue>()
  for (const input of inputs) {
    const result = duplicateImageInstanceChanges(
      working,
      input.sourceObjectId,
      input.sourceAssignmentEntityId,
      input.sourceSection,
      input.sourceLabel,
      input.fallbackLayout
    )
    if (!result) continue
    instances.push(result.instance)
    applyChanges(working, result.changes)
    for (const change of result.changes) finalChanges.set(change.propertyPath, clone(change.nextValue))
  }
  return {
    instances,
    changes: [...finalChanges].map(([propertyPath, nextValue]) => ({ propertyPath, nextValue }))
  }
}

export function deleteEditorInstanceChanges(snapshot: EditorSnapshot, instanceId: string): InstanceMutationChange[] {
  const instance = findEditorInstance(snapshot, instanceId)
  if (!instance) return []
  const removedAssignment = snapshot.media.assignments.find((candidate) => candidate.entityId === instance.source.assignmentEntityId)
  const assignments = snapshot.media.assignments.filter((candidate) => candidate.entityId !== instance.source.assignmentEntityId)
  const assetStillUsed = removedAssignment
    ? assignments.some((candidate) => candidate.assetId === removedAssignment.assetId)
      || Object.values(snapshot.backgrounds).some((background) => background.imageAssetId === removedAssignment.assetId)
    : true
  const changes: InstanceMutationChange[] = [
    { propertyPath: 'instances', nextValue: snapshot.instances.filter((candidate) => candidate.instanceId !== instanceId) as unknown as EditorValue },
    { propertyPath: 'media.assignments', nextValue: assignments as unknown as EditorValue }
  ]
  if (removedAssignment && !assetStillUsed) changes.push({
    propertyPath: 'media.references',
    nextValue: snapshot.media.references.filter((reference) => reference.assetId !== removedAssignment.assetId) as unknown as EditorValue
  })
  for (const domain of ['typography', 'layout', 'backgrounds', 'buttons', 'animations'] as const) {
    if (snapshot[domain][instanceId] !== undefined) changes.push({ propertyPath: `${domain}.${instanceId}`, nextValue: undefined })
  }
  if (snapshot.media.styles[instanceId] !== undefined) changes.push({ propertyPath: `media.styles.${instanceId}`, nextValue: undefined })
  if (snapshot.session.objectStates[instanceId] !== undefined) changes.push({ propertyPath: `session.objectStates.${instanceId}`, nextValue: undefined })
  changes.push(...removeResponsiveObjectChanges(snapshot, instanceId))
  return changes
}

export function deleteEditorInstancesChanges(snapshot: EditorSnapshot, instanceIds: string[]): InstanceMutationChange[] {
  const working = clone(snapshot)
  const finalChanges = new Map<string, EditorValue>()
  for (const instanceId of [...new Set(instanceIds)]) {
    const changes = deleteEditorInstanceChanges(working, instanceId)
    applyChanges(working, changes)
    for (const change of changes) finalChanges.set(change.propertyPath, clone(change.nextValue))
  }
  return [...finalChanges].map(([propertyPath, nextValue]) => ({ propertyPath, nextValue }))
}

export function reorderEditorInstanceChanges(snapshot: EditorSnapshot, sourceId: string, targetId: string): InstanceMutationChange[] {
  const source = findEditorInstance(snapshot, sourceId)
  const target = findEditorInstance(snapshot, targetId)
  if (!source || !target || source.sectionId !== target.sectionId || sourceId === targetId) return []
  const section = snapshot.instances
    .filter((instance) => instance.sectionId === source.sectionId)
    .sort((left, right) => left.order - right.order)
  const sourceIndex = section.findIndex((instance) => instance.instanceId === sourceId)
  const targetIndex = section.findIndex((instance) => instance.instanceId === targetId)
  if (sourceIndex < 0 || targetIndex < 0) return []
  const [moved] = section.splice(sourceIndex, 1)
  if (!moved) return []
  section.splice(targetIndex, 0, moved)
  const orderById = new Map(section.map((instance, order) => [instance.instanceId, order]))
  return [{
    propertyPath: 'instances',
    nextValue: snapshot.instances.map((instance) => instance.sectionId === source.sectionId
      ? { ...instance, order: orderById.get(instance.instanceId) ?? instance.order }
      : instance) as unknown as EditorValue
  }]
}
