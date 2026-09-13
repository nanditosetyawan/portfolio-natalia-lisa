# PHASE 038 — Dynamic Editor Instance Model

## Status

**IN PROGRESS — architecture approved for implementation in this phase.**

This document records the required pre-implementation audit and the backward-compatible design decision before product code is changed. Runtime evidence and the final audit will replace this status after implementation and verification.

## 1. Pre-implementation architecture audit

The existing runtime is a fixed-template system:

- `EditorSnapshot.entities` is a manifest of fixed section objects.
- `media.assignments` can bind an asset only to an existing semantic object/photo-area ID.
- typography, layout, backgrounds/effects, buttons, animations, responsive records, and editor session state are already sparse maps keyed by stable object ID.
- Draft and Published revisions persist the complete `EditorSnapshot` JSON atomically through the existing repositories/RPCs.
- Rollback copies an older complete Published snapshot.
- Guest sections render fixed Vue markup, then the shared Published DOM runtime applies canonical properties.
- the Object Registry is metadata-driven, but currently derives objects only from fixed runtime entities and photo areas.

Therefore, additional instances need only one new canonical manifest. Existing property maps, command history, Draft/Publish transport, responsive runtime, animation runtime, and media repository remain authoritative and are reused.

## 2. Snapshot extension decision

`EditorSnapshot` advances from schema version 1 to schema version 2 and gains an `instances` collection. Version 1 remains a supported read format and is normalized in memory to version 2 with `instances: []`. Serialization always emits version 2.

No relational instance table and no database migration are required: Draft, Published, history, and rollback rows already store the entire validated snapshot document.

Canonical instance shape:

```ts
interface EditorInstance {
  instanceId: string
  type: 'image'
  sectionId: string
  label: string
  order: number
  source: {
    kind: 'media-assignment'
    assignmentEntityId: string
  }
  createdAt: string
}
```

The instance manifest owns identity, type, section, source binding, order, and user-facing metadata. Existing maps remain the single owners of values:

- `layout[instanceId]` — geometry and persisted visibility;
- `media.assignments` / `media.styles[instanceId]` — asset and image effects;
- `backgrounds[instanceId]` — semantic image outline/shadow/radius/opacity data already used by the renderer;
- `animations[instanceId]` — animation configuration;
- existing responsive sparse IDs derived from `instanceId` — breakpoint overrides;
- `session.objectStates[instanceId]` — editor-only lock/hide state.

No value is duplicated in a second model.

## 3. Backward compatibility strategy

- Fixed objects and `entities` remain unchanged.
- Dynamic instances are additive and are not duplicated into the fixed entity manifest.
- Version 1 Drafts and Published revisions deserialize as version 2 snapshots with an empty instance collection.
- Existing fixed photo-area/media assignments retain their current semantics.
- Rollback to pre-Phase-038 revisions renders the old fixed template because the normalized collection is empty.

## 4. Stable identity strategy

New IDs use `<normalized-section>-image-<uuid>`. Identity is generated once before the insert command, persisted in the snapshot, and restored unchanged by Draft reload, Publish, Guest rendering, Undo, Redo, and Rollback. Array indexes are never used as identity.

## 5. Runtime integration design

The Object Registry merges fixed descriptors with canonical instances and creates Image descriptors through the existing registered Image object type. A shared snapshot-driven DOM reconciler renders image instances in both Editor Preview and Guest Runtime before existing property, responsive, image-effect, and animation adapters run.

The reconciler creates DOM only as a rendering projection of `snapshot.instances`; it is not an Editor-only persistence mechanism. Stable `data-snapshot-instance-id` attributes connect the canonical instance to the existing semantic DOM resolver, selection, Navigator, Inspector, and targeted Preview updates.

## 6. Media action semantics

- **Upload New Image:** upload through the existing Media Library repository, then insert a new canonical image instance using that asset.
- **Choose from Media:** select an existing asset from the existing picker, then insert a new canonical image instance without duplicating the binary.
- **Replace Selected Image:** retain the instance ID and all property maps; change only its assignment/reference.
- **Remove Selected Image:** delete only the page instance and keyed canonical records; retain the underlying library asset/reference when otherwise unused by the page.
- **Duplicate Image / Ctrl+D:** create a new instance ID using the same asset and cloned compatible records, offset its X/Y, and use the same command path as Inspector/context-menu duplication.

## 7. Commands and targeted updates

Canonical commands are extended with `INSERT_INSTANCE`, `DELETE_INSTANCE`, `DUPLICATE_INSTANCE`, and `REORDER_INSTANCE`. Each operation is one multi-change command and remains subject to the existing maximum history of ten commands. Redo restores the same generated ID because the command stores the complete next values.

Instance collection mutations trigger reconciliation; property-only mutations continue to update the selected semantic DOM target without remounting the Preview root.

## 8. Responsive and animation integration

Dynamic IDs use the existing responsive sparse-record helpers and animation map. Delete removes base and breakpoint-specific records; duplicate clones them. Desktop and Tablet Landscape ownership remains unchanged.

## 9. Aspect-ratio decision

Phase 038 will add explicit, optional `aspectRatioLocked` and `aspectRatio` fields to the existing per-image `MediaStyleSettings`. The lock is never inferred. Width/height edits use the same canonical command and responsive paths; when locked, one edit writes the paired dimension in that same command.

## 10. Limits and safety

The implementation uses a product-safety ceiling of 100 dynamic instances per section and 500 per snapshot. This is intentionally far above ordinary portfolio use while preventing accidental repeated insertion from freezing the Editor. Validation enforces the same canonical limits; UI rejection is not the sole boundary.

## 11. Protected architecture

Repository contracts, Draft/Favorite tables, atomic Publish/Rollback RPCs, Guest repository boundaries, storage bucket and visibility, responsive engine, animation engine, database schema, and RLS remain unchanged. `portfolio-media` remains public and current `draft/` / `published/` handling remains owned by the existing repositories.

## 12. Sources and visual reference status

- Relevant Phase 038 specification under `md/`: **Tidak ditemukan dalam specification.**
- Relevant protected visual reference under `design/`: **Tidak ditemukan dalam specification.**
- Formal design-reference comparison: **Belum dilakukan.** Runtime screenshots will be inspected directly and reported as runtime evidence, not as reference-accuracy evidence.

## Final sections pending verification

Upload/choose/replace/delete/duplicate flows, Navigator and Inspector integration, Draft reload, atomic Publish, Guest rendering, Rollback, old-revision compatibility, media usage, responsive behavior, animation, performance, screenshots, regression results, and the PASS/PARTIAL/FAIL/NOT RUN audit remain pending until implementation and actual execution.
