# PHASE 038 — Dynamic Editor Instance Model

## Final verdict

**PASS**

Additional image instances are now canonical `EditorSnapshot` data. They use stable IDs, survive Draft save/reload, publish atomically with the containing snapshot, render from Published Snapshot in Guest Runtime, and follow rollback history. No DOM-only persistence, parallel model, relational instance table, new bucket, or storage-visibility change was introduced.

Final release certification subsequently completed authenticated Cloud database/RLS transaction coverage for Snapshot v1/v2 Publish, Guest reads, rollback, limits, preservation, and cleanup. A fresh end-user GoTrue Admin browser mutation remains **NOT RUN** because no disposable Admin credential or `PHASE029G_SERVICE_ROLE_KEY` was available; database-owner/MCP evidence is not presented as a substitute for that browser session.

## 1. Pre-implementation architecture audit

Before the extension, the Editor was fixed-template based:

- `EditorSnapshot.entities` described fixed section objects.
- `media.assignments` could bind an asset only to an existing semantic object/photo-area ID.
- typography, layout, media styles, backgrounds/effects, animations, responsive overrides, and session state were already sparse maps keyed by stable object ID.
- Draft and Published rows already persisted the complete validated snapshot document.
- Publish and rollback already operated atomically on a complete snapshot.
- Guest rendered fixed Vue markup and applied the Published Snapshot through the shared runtime adapters.

The smallest backward-compatible extension was therefore an optional canonical instance manifest while reusing all existing keyed property maps and persistence paths.

## 2. Snapshot extension decision

`EditorSnapshot` is now schema version 2 and contains `instances: EditorInstance[]`. The new collection owns only instance identity and placement metadata. Existing maps remain the single owners of editable values.

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

Current dynamic registration covers the required Image instance type. The runtime uses a type renderer registry so future canonical instance types can be added without creating another persistence system.

## 3. Backward compatibility and versioning

- Version 1 snapshots remain valid read input.
- Deserialization normalizes version 1 to version 2 with `instances: []`.
- Serialization writes version 2 explicitly.
- Existing fixed objects remain in the original entity manifest and are not converted.
- Old Drafts and Published revisions therefore continue to render the fixed template.
- Rollback to an old revision produces an empty dynamic collection while leaving the newer Draft unchanged.

Runtime evidence: a version 1 fixture normalized to version 2, serialized/deserialized successfully, published a dynamic instance, rolled back to the old fixed revision, and preserved the Draft instance.

## 4. Canonical ownership and stable identity

New IDs use `<section>-image-<uuid>` and are generated once before insertion. Array index is never identity. The instance manifest points to its media assignment while existing maps own its values:

| Concern | Canonical owner |
|---|---|
| Identity/type/section/order/label | `snapshot.instances` |
| Asset | `snapshot.media.assignments` and `media.references` |
| Image geometry/effects | `layout[id]`, `media.styles[id]`, `backgrounds[id]` |
| Animation | `animations[id]` |
| Responsive values | existing sparse breakpoint records keyed from `instanceId` |
| Lock/hide editor state | `session.objectStates[id]` |

Validation rejects duplicate IDs, invalid section/order/source values, missing media assignments/references, invalid keyed records, and invalid aspect-ratio data.

## 5. Media insertion and editing flows

### Upload New Image

The existing Media Library repository stages and registers the local file under the current Draft media rules. A single `INSERT_INSTANCE` command then creates a new image instance and assignment. The selected fixed image is not replaced.

### Choose from Media

The existing Asset Library picker returns an existing asset identity. Applying it creates a new instance and assignment without uploading or duplicating its binary.

### Replace Selected Image

`REPLACE_MEDIA` changes only the selected instance's media reference. Its ID, layout, effects, animation, responsive records, and aspect-ratio setting remain attached. The old library asset is retained.

### Remove Selected Image

`DELETE_INSTANCE` removes the page instance and its keyed canonical records. It does not delete the underlying Media Library asset or Storage object. The existing confirmation UI is retained.

### Duplicate / Ctrl+D

`DUPLICATE_INSTANCE` creates one new stable ID, uses the same asset, clones compatible visual/responsive/animation records, and offsets X/Y by 24px. Undo removes it; Redo restores the same ID and configuration. Inspector, context menu, and shortcut use the same command path.

## 6. Object Registry, Navigator, and Inspector

Dynamic instances are merged into the same Object Registry as fixed objects and use the existing registered Image capabilities. There is no separate dynamic-image Inspector.

Verified behavior:

- immediate Navigator appearance;
- preview click selects the same stable object;
- Inspector opens Media controls for it;
- rename, reorder, lock, hide, delete, and copy/paste style work through existing actions;
- selection remains stable during edits;
- object-level geometry/effects modify only the selected instance.

The user-facing actions are `Upload New Image`, `Choose from Media`, `Replace Selected Image`, `Remove Selected Image`, and `Duplicate Image`.

## 7. Preview and Guest rendering

`dynamicInstanceRuntime` is a snapshot-to-DOM renderer registry. The generated nodes are projections of canonical data, not temporary Editor state. Stable `data-snapshot-instance-id` attributes connect them to the shared semantic DOM resolver.

The same renderer is invoked by the Published Snapshot DOM runtime, after which the existing property, responsive, alpha-image-effect, and animation adapters apply. Fixed and dynamic images therefore share one rendering/effect boundary.

Performance evidence after rollback:

- 58.68 FPS over the sampled animation frames;
- Preview/Guest root identity unchanged;
- selected dynamic node identity unchanged;
- three dynamic nodes reconciled;
- alpha filters remained bounded to affected images.

No full Preview remount was observed.

## 8. Independent geometry and alpha-aware effects

Each dynamic image independently supports W, H, X, Y, rotate, opacity, radius, silhouette outline, alpha-aware shadow, and Hover Style through the existing Phase 037C adapters.

Focused evidence for Image B:

- computed size changed to 300 × 225px;
- computed translate changed to 190px / 35px;
- computed rotation changed to 9 degrees;
- alpha outline/filter and `drop-shadow()` were present on the semantic image target;
- wrapper `box-shadow` remained `none`;
- fixed Image A, Image C, siblings, and section root remained unchanged.

## 9. Aspect-ratio lock

The existing per-image media style was extended with explicit optional `aspectRatioLocked` and `aspectRatio` values. The lock is never inferred. When enabled, changing one dimension writes the paired dimension in the same command; when disabled, dimensions remain independent.

The runtime test confirmed a 4:3 ratio while changing Image B to 300px wide, producing 225px height.

## 10. Responsive integration

Dynamic IDs use the existing sparse responsive ownership model. Desktop and Tablet Landscape values remain independent:

- Desktop Image B: 300 × 225px;
- Tablet override: 260 × 195px;
- returning to Desktop restored 300 × 225px.

Deleting an instance removes its base and responsive keyed records. No breakpoint or responsive architecture was added.

## 11. Animation integration

Dynamic objects use the existing animation map and runtime. Entrance, Hover Motion, Click, Scroll, Timeline, presets, and reduced-motion behavior remain shared. The focused harness applied and rendered the existing Fade entrance configuration on Image B.

## 12. Command history and exact restoration

The command union now supports `INSERT_INSTANCE`, `DELETE_INSTANCE`, `DUPLICATE_INSTANCE`, and `REORDER_INSTANCE`. Each structural operation is one multi-change command and remains under the existing maximum history of ten commands.

A genuine Undo restoration defect was found during certification: deleting a previously absent nested value could leave an empty per-object record. The store now avoids constructing missing parents during deletion and prunes only empty keyed entity records. Copy Style/Paste Style Undo consequently restores the exact prior canonical state instead of leaving `{}`.

## 13. Draft persistence

The browser scenario saved A/B/C, reloaded the Editor, and confirmed:

- all instances restored;
- every ID remained identical;
- assignments, geometry, effects, responsive values, and animation restored;
- saving the same Draft updated that Draft rather than creating a second row;
- the Draft Favorite relation remained attached.

## 14. Atomic Publish and media promotion

Dynamic instances are part of the same complete snapshot passed to the existing atomic Publish boundary. They are not published separately.

Verified locally:

- Publish revision 1 contained the dynamic instance collection;
- Draft and Favorite remained intact;
- Draft references retained `draft/*` paths;
- every Published reference used bucket `portfolio-media` and `published/*` paths;
- no Draft reference was exposed to Guest Runtime.

The public visibility of the existing `portfolio-media` bucket was not changed.

## 15. Guest Runtime, second publish, and rollback

Guest Runtime loaded only the active Published Snapshot and rendered fixed plus dynamic instances.

Scenario evidence:

1. Revision 1 published A/B/C and duplicated D.
2. C was deleted from the Draft only.
3. Guest still retained C before another publish.
4. Revision 2 published the updated Draft, so Guest removed C.
5. Atomic rollback created revision 3 from revision 1.
6. Guest restored C and all active references still used `published/*`.
7. The Draft still did not contain C and its Favorite relation remained unchanged.

The zero-publish Default Runtime remains unchanged and contains no dynamic instances unless a Published Snapshot explicitly contains them.

## 16. Media usage integration

Manage Media scans fixed and dynamic assignments in Draft and active Published snapshots. After rollback, the replacement asset reported four distinct usages: Image B and its duplicate in both Draft and Published sources. Location was `Both`, and deletion safety correctly reported the asset as unsafe to delete.

## 17. Limits and safety

- 100 dynamic instances maximum per section.
- 500 dynamic instances maximum per snapshot.
- insertion checks enforce both limits before creating a command;
- snapshot validation enforces the canonical collection limits;
- a focused runtime assertion confirmed both boundaries reject the next insertion;
- instance removal retains asset storage and uses existing confirmation behavior.

These ceilings are deliberately above normal portfolio use while preventing accidental insertion loops from freezing the Editor.

## 18. Database, repository, storage, and security

The Phase 038 instance model itself required no relational table or storage-schema redesign because Draft and Published rows already persist whole versioned snapshot JSON documents. Final release certification subsequently found one Cloud compatibility defect in the existing Publish RPC: its validation gate accepted only Snapshot v1. The focused `0024_editor_snapshot_v2_publish.sql` migration now accepts and validates v1/v2 through the same atomic RPC signature; it does not add an instance table, parallel persistence, or a new repository contract.

Protected behavior retained:

- no direct Supabase call from Vue;
- no new instance table or parallel persistence;
- no new Storage bucket;
- `portfolio-media` remains public;
- uploads remain under `draft/` until Publish prepares `published/` references;
- Guest rejects non-published media references;
- RLS, database schema, and existing RPCs were not changed.

The Supabase workflow was reviewed because persistence crosses Supabase repositories. No schema action was taken.

## 19. Exact E2E scenario result

All 31 requested steps passed in the focused local browser/repository harness: upload B, insert existing C, independent B geometry/effects, Draft reload with stable IDs, duplicate D, Undo/Redo, first publish, Draft-only deletion of C, Guest isolation, second publish, rollback, and unchanged Draft/Favorite state.

The harness also hardened earlier tests so they require both canonical changes and actual DOM geometry/effect changes.

## 20. Runtime and regression evidence

| Validation | Result |
|---|---|
| `tests/dynamic-editor-instances-runtime.mjs` | PASS |
| Phase 037C media/image effects | PASS |
| Phase 037B scrub/Text Outline | PASS |
| Phase 037A object isolation | PASS |
| Human-Friendly Inspector | PASS |
| Professional Editor UX | PASS |
| Editor Object System | PASS |
| Responsive Layout | PASS |
| Animation System | PASS |
| Design System | PASS |
| Media Library | PASS after updating its obsolete fixed-template assertion |
| Editor R3 runtime | PASS after updating Upload to assert canonical insertion |
| Default Guest Runtime | PASS |
| Navigator collapse | PASS |
| Natural wheel/touchpad scrolling | PASS; current headless synthetic scrollbar-thumb drag remains an automation limitation, with prior real runtime evidence retained |
| Stabilization routes/runtime | PASS |
| Production hardening runtime | PASS |
| PWA/offline runtime | PASS |
| Authenticated Cloud v1/v2 transaction certification | PASS — disposable SQL/RLS transactions published v1, v2-empty, and v2-dynamic snapshots, rolled between v1/v2, preserved Draft/Favorite, and rolled all test state back |
| Fresh real GoTrue Admin browser mutation | NOT RUN — no disposable Admin credential/service-role setup key was available |

Final static validation:

- `npx vue-tsc --noEmit` — PASS
- `npm run build` — PASS
- `git diff --check` — PASS (rerun after final documentation/log update)

## 21. Screenshots and visual verification

- `artifacts/phase-038-editor-instances.png` — inspected at original resolution; Navigator contains dynamic image layers, Image B is selected, and Media controls/preview projection are visible.
- `artifacts/phase-038-guest-rollback.png` — inspected at original resolution; Guest renders the complete rolled-back Published portfolio without Editor chrome.

The dynamic test images intentionally overlap because duplicate placement begins with a small offset; the harness verifies three distinct canonical DOM nodes and stable identities.

Relevant specification under `md/`: **Tidak ditemukan dalam specification.**

Relevant design reference under `design/`: **Tidak ditemukan dalam specification.**

Formal design-reference comparison: **Belum dilakukan.** The screenshots are runtime evidence only and are not presented as pixel-accuracy evidence against a missing reference.

## 22. Primary implementation files

- `src/types/editorSnapshot.ts`
- `src/types/editor.ts`
- `src/editor/editorSnapshot.ts`
- `src/editor/editorInstances.ts`
- `src/editor/editorInstanceCommands.ts`
- `src/composables/useEditorObjectRegistry.ts`
- `src/runtime/dynamicInstanceRuntime.ts`
- `src/runtime/publishedSnapshotDom.ts`
- `src/runtime/imageEffectRuntime.ts`
- `src/runtime/animationRuntime.ts`
- `src/editor/objectDomTarget.ts`
- `src/pages/admin/AdminEdit.vue`
- `src/pages/guest/HomePage.vue`
- `src/stores/editor.ts`
- `src/stores/mediaLibrary.ts`
- `src/repositories/editorRevisionRepository.ts`
- section root components carrying canonical section IDs
- focused and updated regression harnesses under `tests/`

No protected architecture was redesigned.

## 23. Final self-audit

| Phase 038 section | Status | Evidence / boundary |
|---|---|---|
| A — Architecture audit | PASS | Smallest additive snapshot extension identified before implementation |
| B — Instance model | PASS | Canonical stable-ID image instance manifest |
| C — Backward compatibility | PASS | Fixed entities retained; v1 fixtures normalize correctly |
| D — Snapshot versioning | PASS | Explicit v2 writer with v1 reader support |
| E — Upload insertion | PASS | New reusable asset plus new canonical Image B |
| F — Existing-media insertion | PASS | Existing asset creates Image C without binary duplication |
| G — Replace | PASS | Same ID/config, new reference, old asset retained |
| H — Remove | PASS | Page instance only; asset remains |
| I — Duplicate | PASS | New ID, cloned style, offset, same Undo/Redo path |
| J — Object Registry | PASS | Same registry/capability/selection system |
| K — Navigator/Layers | PASS | Select, rename, reorder, lock, hide, delete verified |
| L — Preview | PASS | Canonical reconciler, stable nodes, no root remount |
| M — Independent layout | PASS | B geometry changed; A/C/siblings/root unchanged |
| N — Alpha-aware effects | PASS | Shared Phase 037C outline/shadow/hover boundary |
| O — Responsive | PASS | Desktop/Tablet sparse ownership verified |
| P — Animation | PASS | Existing animation record/runtime used |
| Q — Undo/Redo | PASS | Structural commands and same-ID restoration verified |
| R — Draft | PASS | Reload preserved IDs/config and Favorite |
| S — Atomic Publish | PASS | Complete snapshot revisions and media isolation verified locally |
| T — Guest Runtime | PASS | Active Published Snapshot only; dynamic instances rendered |
| U — Rollback | PASS | Older collection restored; Draft unchanged |
| V — Default Runtime | PASS | Zero-publish fixed fallback unchanged |
| W — Media usage | PASS | Distinct Draft/Published instance references counted |
| X — Aspect-ratio lock | PASS | Explicit canonical lock and proportional command |
| Y — Limits/safety | PASS | 100/section and 500/snapshot boundaries tested |
| Z — Database decision | PASS | Whole-snapshot tables remain unchanged; final RC applied one focused compatibility migration to the existing atomic Publish RPC |
| Critical regression suite | PASS | Previous Editor/Media/Guest systems remain functional |
| Authenticated Cloud transaction | PASS | v1/v2 Publish, Guest read, rollback, limits, conflicts, Draft/Favorite preservation, and cleanup were verified through authenticated Supabase tooling |
| Fresh real GoTrue Admin browser mutation | NOT RUN | No disposable Admin credential/service-role setup key; no evidence fabricated |

## Known evidence limitation

Cloud database/RLS transaction certification is now complete, including the focused Snapshot v2 Publish compatibility fix. A fresh end-user GoTrue password-login browser scenario remains unexecuted because no disposable Admin credential or authorized account-provisioning key was available. Database-owner/MCP evidence is not presented as a substitute for that browser session.
