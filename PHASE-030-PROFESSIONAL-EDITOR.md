# PHASE 030 — Professional Editor Object System & Inspector

## Verdict

`PASS`

Phase 030 completes the internal Editor architecture without changing the public contracts of Repository, Draft, Publish, Rollback, EditorSnapshot, Storage, or Guest Runtime. The Editor now has one object/selection model, a metadata-driven Inspector and control renderer, a Layers/Navigator surface, metadata validation, compatible style copy/paste, and a shared registry-driven Preview/Guest property runtime.

No migration, database schema, bucket configuration, repository contract, Publish RPC, or Rollback RPC was changed. The existing `portfolio-media` bucket remains PUBLIC.

## Scope and sources

- The explicit Phase 030 requirements were the implementation authority.
- `PROJECT-IMPLEMENTATION-LOG.md` and the existing Phase 029G implementation were inspected before changes.
- No `md/` or `design/` directory is present in this checkout. A formal design-reference comparison was therefore unavailable; no visual fidelity claim against a missing reference is made.
- Existing dirty Phase 029G report, screenshots, and runtime-harness changes were preserved.

## Architecture

```text
Editor Object Registry
  -> object type registration
  -> capabilities
  -> normalized EditorObject[]
       -> single Editor selection
       -> Layers / Navigator
       -> Inspector

Property Registry
  -> category and ordering metadata
  -> validation and dependency metadata
  -> serializer
  -> snapshot/database mapping
  -> preview updater
  -> generic control renderer

Property edit
  -> one EditorCommand
  -> canonical EditorSnapshot
  -> post-flush Preview hydration
  -> registry-driven DOM updater
  -> dirty state

Saved Draft / Published Snapshot
  -> same canonical EditorSnapshot
  -> unchanged repositories and atomic Publish/Rollback RPCs
  -> shared registry-driven Guest property updater
```

The EditorSnapshot remains the sole content-write source. The Site store is only an internal render adapter for the embedded Preview. Preview hydration now runs at a deterministic post-flush boundary, and object registration is idempotent to prevent reactive feedback loops.

## Object model and capabilities

Every runtime entity is normalized to an `EditorObject` with:

- stable `id` / `entityId`;
- registered `type` / `objectType`;
- name, section, layer, parent layer, and order;
- declared capabilities;
- property values;
- validation metadata.

Built-in registrations are present for:

- Text;
- Image;
- Button;
- Container;
- Background;
- Divider;
- Icon.

`registerEditorObjectType()` adds future object types without changing Inspector code. Runtime proof registered a synthetic `Video` type and its property successfully without adding a Vue branch.

Capabilities drive visibility and enablement. Text, Image, Button, and structural objects expose only compatible metadata. Per-object differences remain intact; capabilities are not globally forced across all images or controls.

## Selection system

`selectedObjectId` is the only stored selection identity. The following are derived from it:

- `selectedObjectType`;
- `selectedCapabilities`;
- `selectedSection`;
- `selectedLayer`.

`selectedEntityId` remains a read-only compatibility alias, not duplicate state. Preview click, manual selectors, Layers, Navigator search results, and Inspector all call the same central selection action. Property typing never infers or changes selection.

Preview entities receive editor-only object metadata. Hover, selected, locked, and hidden states use transparent outlines/classes without a color overlay or layout shift. The indicators do not enter EditorSnapshot content and are not applied by Guest Runtime.

## Inspector

The Inspector is generated from registry metadata and object capabilities. Its accordion categories are:

1. FONT
2. MEDIA
3. LAYOUT
4. POSITION
5. EFFECTS
6. ADVANCED

FONT opens by default for compatible text. Existing object content fields remain as a compact metadata-driven inline group above the six professional property accordions.

### FONT

Font, size, spacing, color, shadow, hover, X/Y, and rotation are registered metadata. Paired controls use metadata row keys, not category-specific template branches.

### MEDIA

Upload, repository-backed media picker, replace, width/height, hover, X/Y, outline, outline thickness, and rotation are registered metadata. Upload/replace remain behind the existing media repository path.

### LAYOUT, POSITION, EFFECTS, ADVANCED

- LAYOUT: margin, padding, alignment, display, and Published visibility.
- POSITION: X, Y, width, height, and rotation.
- EFFECTS: opacity, shadow, blur, border, radius, and compatible background fields.
- ADVANCED: read-only object ID, capabilities, validation status, section, and layer.

## Property Registry and generic controls

Each registered property now supplies:

- property type and control type;
- label, category, order, and optional paired row;
- default value;
- validation rule;
- dependency rule and dependency keys;
- serializer/deserializer;
- preview updater;
- canonical snapshot/database mapping;
- capability and compatible style key.

`PropertyControl.vue` does not switch on property category. It resolves a control component through `propertyControlRegistry`; controls can be registered independently. New categories render through the same grouping/accordion algorithm. A future property such as Video Filter, Blend Mode, or Border Radius can use existing control metadata without changing the Inspector template.

Dependencies use metadata context and native `disabled`. Runtime verification proved that Outline Thickness starts disabled and becomes enabled only after Outline is enabled.

## Live Preview and Undo/Redo

Every Inspector edit:

1. serializes through property metadata;
2. records one command against the selected object;
3. updates EditorSnapshot;
4. refreshes the embedded Preview without reload;
5. marks content dirty.

Undo/Redo stays command-based with a maximum of 10 commands. Paste Style is one logical multi-property `PASTE_STYLE` command. Selection and editor session changes are excluded from content history.

The Preview race found during E2E was fixed at its architectural source: Snapshot-to-Preview hydration is post-flush, Guest section bindings follow reactive root replacement, and object/entity registration writes only when metadata actually changes. No key/remount or force-update workaround remains.

## Layers, Navigator, and search

The Layers panel is generated from `EditorObject[]` and grouped by section. It supports:

- section expansion;
- selection synchronized with Preview and Inspector;
- selected-object highlighting;
- automatic expansion and scroll into view;
- search by name, stable ID, or object type;
- per-object lock and editor-only hide actions.

The runtime harness exercised all three search dimensions and selected an object through Navigator while confirming the Preview outline and central selection state.

## Lock, Hide, and Copy Style

- Locked objects stay visible and selectable but Inspector edits are natively disabled and commands are rejected by the store.
- Hidden objects are dimmed only in the Admin Preview. Guest visibility is not changed.
- Copy Style records only meaningful, compatible registered values.
- Paste Style matches canonical `styleKey` metadata and target capabilities.
- Empty registry placeholders are not persisted as invalid Snapshot values.
- Paste, Undo, and Redo preserve the selected object.

## Validation

Validation is metadata-driven and rendered inline. Invalid registered properties appear in the Inspector, are summarized, and disable Publish with a clear reason. Snapshot domain validation also validates the expanded layout/effects/media fields and accepts safe CSS length functions such as `clamp()` while rejecting malformed input.

EditorSnapshot serialization now safely accepts JSON-compatible Vue reactive proxies and still returns a plain validated Snapshot.

## Draft, database, Publish, and Guest integration

All supported property values remain inside the existing EditorSnapshot JSONB envelope. No new table or duplicated model was introduced.

- Draft Save/reload uses the unchanged `EditorDraftRepository` contract.
- Publish uses the unchanged `EditorPublishRepository` and atomic RPC.
- Rollback remains append-only and does not modify Draft or Favorite.
- Published properties require no per-property Publish mapping because the complete Snapshot is activated.
- Preview and Guest style application both use `applyRegisteredSnapshotProperties()`.
- Editor-only object lock/hide classes are intentionally excluded from the Guest updater.

## Runtime evidence

### Local professional Editor browser E2E

`node tests/editor-object-system-runtime.mjs`:

```json
{
  "status": "PASS",
  "scope": "Phase 030 local professional Editor Object System runtime",
  "objectCount": 45,
  "extensibleObjectType": "Video",
  "selection": "portfolio-hero",
  "navigator": "navigation-brand",
  "copyPasteCommand": "PASTE_STYLE",
  "dependencyNativeDisabled": true,
  "validationBlockedPublish": true,
  "draftRoundTrip": true,
  "guestMetadataRuntime": "0.7"
}
```

The test covers selection stability, live text changes, transparent selected outline, Inspector categories, name/ID/type search, Navigator synchronization, lock/hide, compatible Copy/Paste Style, Undo/Redo, native dependencies, inline validation, Publish blocking, Draft repository round-trip, and shared Guest property rendering.

Screenshot: `artifacts/phase-030-professional-editor.png`. It was visually inspected at 1600×1000. The three-column Navigator/Inspector/Preview composition, selected transparent media outline, cream/rose visual system, and non-blocking content were present. Formal design comparison was not possible because a corresponding design reference is absent.

### Disposable Cloud transaction

A read-only/setup transaction exercised the existing Cloud functions with an Admin identity and then executed `ROLLBACK`:

```json
{
  "status": "PASS",
  "scope": "Disposable transactional Cloud Draft/Publish/Rollback contract",
  "draft_rows_in_transaction": 1,
  "favorite_rows_in_transaction": 1,
  "published_rows_in_transaction": 3,
  "active_revision_in_transaction": 3,
  "active_metadata_opacity": "0.42",
  "bucket_public": true
}
```

The sequence saved a Draft, favorited it, published two revisions with `published/*` references, rolled back to the first property value, and asserted that the Draft retained the second property value while Favorite remained. Post-rollback verification returned zero `site_revisions`, zero Favorites, and zero Phase 030 Storage rows.

Cloud metadata verification also confirmed:

- `site_revisions` and `editor_favorites` exist with RLS enabled;
- all required Draft/Favorite/Publish/Rollback/active-Published functions exist;
- both Published-prefix Storage policies exist;
- `portfolio-media.public = true`;
- no migration was required by Phase 030.

## Static validation

- `npx vue-tsc --noEmit` — PASS.
- `npm run build` — PASS; 1,966 modules transformed.
- `git diff --check` — PASS; line-ending warnings only.

## Known limitations

- The Cloud project currently contains no persistent business Draft or Published rows after disposable Phase 029G/030 cleanup. Guest therefore has no active production revision until an Admin publishes real content.
- The full authenticated HTTP browser Publish suite was not rerun because no disposable service-role test secret was available in this session. Phase 030 instead used a local Admin browser E2E plus a disposable Cloud transaction; the previously verified Phase 029G repository/browser architecture was not changed.
- No formal visual-reference comparison could be performed because the repository has no Phase 030 design reference.

## Self-audit

| Requirement | Result | Evidence |
|---|---|---|
| Internal architecture and canonical Snapshot | PASS | One object model and one Snapshot write path |
| Text/Image/Button/Container/Background/Divider/Icon | PASS | Built-in object type registry |
| Future metadata-only extensibility | PASS | Runtime Video + Video Filter registration proof |
| Capability-driven controls | PASS | Object and property registries |
| Single-source selection | PASS | Store derivations and browser E2E |
| Preview selection and transparent outlines | PASS | Browser E2E and inspected screenshot |
| FONT/MEDIA/LAYOUT/POSITION/EFFECTS/ADVANCED | PASS | Generic metadata accordions |
| Metadata dependency system | PASS | Native disabled runtime assertion |
| Generic control renderer, no category branches | PASS | Component renderer registry |
| Live Preview, dirty state, Undo/Redo max 10 | PASS | Browser command assertions |
| Layers and Navigator synchronization | PASS | Browser E2E |
| Search by name, ID, and type | PASS | Browser E2E |
| Lock and editor-only Hide | PASS | Store guard and Guest isolation assertion |
| Compatible Copy/Paste Style | PASS | One batch command plus Undo/Redo proof |
| Inline metadata validation and Publish blocking | PASS | Invalid/corrected opacity runtime proof |
| Draft persistence and reload | PASS | Serialized repository round-trip |
| Publish/History/Rollback preservation | PASS | Disposable Cloud transaction |
| Guest metadata rendering without per-property mapper | PASS | Shared registry runtime proof |
| Repository/Publish/Rollback/Storage contracts unchanged | PASS | No contract/schema migration changes |
| Auth/CRUD/Messages regression boundary | PASS | No scoped source changes; typecheck/build PASS |
| Runtime acceptance | PASS | Composite local browser + disposable Cloud transaction |
| Static validation | PASS | Typecheck, build, diff check |
| Report and project log | PASS | This report and Request #135 log entry |

No required Phase 030 implementation item was skipped. The unavailable one-piece authenticated Cloud browser rerun is disclosed above and does not replace or weaken the completed local browser and transactional Cloud evidence.
