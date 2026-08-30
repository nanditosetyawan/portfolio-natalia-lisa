# PHASE 032 - Professional Asset Library & Media Management

## Final verdict

**PASS**

Phase 032 replaces the mock Manage Media experience with a repository-backed Asset Library and connects that library to the existing metadata-driven Editor. Snapshot, Draft, Favorite Drafts, Publish, Rollback, Guest Runtime, Storage bucket configuration, database schema, and RLS were not redesigned.

The only deliberate product limitation is that Media Favorites are stored as an Admin UI preference in the current browser. This preserves the explicit no-database/no-RLS-change boundary, remains separate from Draft Favorites, and survives browser reloads on that device. It is not cross-device account data.

## Protected boundaries

- No migration, table, column, RPC, grant, policy, or RLS change.
- No change to `portfolio-media` visibility; the existing bucket remains PUBLIC.
- No new Storage bucket.
- No Snapshot schema change.
- No Draft, Favorite Draft, Publish, Rollback, or Guest Runtime contract change.
- No direct Supabase query from a Vue page/component.
- No change to the intentional fixed-template `Ctrl+D` boundary.
- No changes to `AGENTS.md`, `md/**`, or `design/**`.

## Architecture

```text
Existing media_assets metadata ─┐
Saved Draft snapshots ──────────┼─> Media Library store (derived view)
Active Published snapshot ──────┤      ├─ usage/location/safety index
Canonical Default snapshot ─────┘      ├─ search/filter/sort
                                       ├─ browser-local media favorites
                                       └─ virtualized cards

AdminMedia / AssetPicker
        │
        └─ mediaRepository
              ├─ existing portfolio-media bucket
              ├─ draft/library/* uploads
              └─ existing media_assets table

Editor picker / drag-drop
        └─ Editor command -> EditorSnapshot.media -> live Preview -> dirty Draft
```

`src/stores/mediaLibrary.ts` builds a non-canonical, read-only index from existing canonical sources. It never duplicates or replaces EditorSnapshot. Stable asset IDs remain the identity; display names are metadata only.

The existing `mediaRepository.ts` exports were preserved. Additive Asset Library operations were added to the same persistence boundary, so components still do not call Supabase directly.

## Media workflow

### Upload

1. Admin selects one or more images.
2. Repository validates image MIME and the existing 10 MB maximum.
3. Dimensions are read in the browser.
4. The object is uploaded to `portfolio-media/draft/library/{assetId}.{extension}`.
5. Existing `media_assets` receives metadata only.
6. A signed Admin preview URL is resolved for Draft content.

Upload rollback removes the Storage object if metadata indexing fails. The bucket and visibility are unchanged.

### Library views

The dedicated `/admin/media` page provides:

- virtualized thumbnail grid;
- instant search over filename/name, ID, MIME/type, usage, section, role, location, safety, and folder;
- Newest, Oldest, Name, Size, and Usage Count sorting;
- Images, Icons, Background, Logo, Unused, Recently Uploaded, and Favorites filters;
- resolution, aspect ratio, and file size on cards;
- complete detail panel with preview, dimensions, MIME, upload/last-used time, usage count, folder, and Draft/Published/Both/Library location;
- full keyboard card navigation and multi-selection.

The obsolete Images/Videos/Documents child routes redirect to the real Asset Library instead of rendering dummy data.

### Usage and safety

Usage is derived from media assignments and background asset IDs in every saved Draft, the active Published revision, and the immutable Default template. Each usage stores object ID, label, section, role, source, revision identity, and last-used timestamp when available.

Clicking a usage opens the Editor with the correct Draft source (or a new Published-derived workspace) and the exact object query. Editor initialization then selects the object, updates the Navigator/Inspector, and focuses its Preview representation.

Safety is conservative:

- built-in assets cannot be deleted or moved;
- Published/Both assets cannot be deleted or moved;
- any referenced asset cannot be deleted or moved;
- only unreferenced managed objects under `draft/library/*` are marked **Safe to delete**;
- rename changes `alt_text` metadata only, so identity and references remain valid;
- move is allowed only before an asset is referenced;
- delete removes metadata and the unused object, with metadata restoration attempted if Storage removal fails.

### Bulk actions

Browser runtime executed all bulk operations with multiple selected assets:

- Favorite;
- two-file Download;
- numbered metadata Rename;
- Move under `draft/library/*`;
- Delete of two unused objects.

Used, Published, and built-in objects remain natively disabled for destructive/move workflows.

## Media Favorites

Media Favorites are independent from `editor_favorites` (Draft Favorites). They use stable asset IDs and a versioned browser key:

```text
portfolio:media-favorites:v1
```

Favorites survive page refresh on the same browser and are exposed in both the library and picker. No snapshot is duplicated and no Favorite Draft row is created.

## Professional picker

`AssetPickerModal.vue` replaces the old select control with:

- instant search;
- All, Favorites, and Recent tabs;
- virtualized preview cards;
- details for the current selection;
- arrow/Home/End keyboard navigation;
- Enter/Apply and double-click apply;
- draggable assets for Preview drop targets;
- favorite toggling;
- responsive dock layout that leaves the Editor target visible.

The picker reads the same media store as the dedicated library and contains no dummy media.

## Editor integration

The existing generic Property Registry now declares these metadata actions:

- Upload;
- Choose Existing;
- Replace;
- Remove;
- Duplicate Reference;
- Reveal in Library.

No category-specific PropertyControl renderer branch was added. All buttons still use the registered generic `button` renderer and action metadata.

Choose/apply, remove, and duplicate-reference operations each create one existing Editor command against `EditorSnapshot.media`. They update the Preview immediately, mark the Draft dirty, preserve selection, participate in Undo/Redo, and remain isolated from Guest until the existing Save/Publish lifecycle is used.

Dragging an Asset Library card over a media-capable Preview object produces a transparent editor-only target outline. Drop selects that object, creates the media command, and updates the rendered image `src` immediately. Locked/non-media objects reject the drop.

Reveal opens `/admin/media?asset={stableAssetId}` in a separate tab so unsaved Editor work is not replaced.

## Performance

Fresh headless Chromium/DevTools evidence from `tests/media-library-runtime.mjs`:

- total indexed assets in stress run: `262`;
- rendered cards: `25`;
- virtualization ratio: less than 10% of the data set mounted;
- filtered result cards: `1`;
- 80-query burst duration: `42.8 ms`;
- DevTools ScriptDuration delta: `0.00263 s`;
- DevTools LayoutCount delta: `5`;
- thumbnails use `loading="lazy"` and `decoding="async"`;
- ResizeObserver recalculates columns without rendering the full list.

The Phase 031 performance regression also passed after this work: 80 property events still became one targeted Preview update, the Preview root was not replaced, measured frame rate remained 60 FPS, and command history remained capped at 10.

## Accessibility

Verified in the browser:

- grid and card roles with row/column counts and selected state;
- arrow, Home, End, Space, Enter, Ctrl/Meta, and Shift selection behavior;
- visible focus rings;
- accessible Favorite state (`aria-pressed`);
- named upload/search/sort inputs;
- dialog labels and live status/error regions;
- zero nameless buttons and zero unlabeled inputs/selects in the tested library state;
- lazy images have meaningful card alt text; decorative icons are hidden where appropriate.

## Browser evidence

`tests/media-library-runtime.mjs`: **PASS**.

Verified using actual canonical default data plus repository-uploaded test assets:

- the built-in profile asset was indexed with three real usages;
- every required filter and metadata detail rendered;
- Media Favorite survived local persistence and remained separate from Draft Favorite;
- built-in delete remained disabled;
- upload created three `draft/library/*` assets;
- multi-select and every bulk action executed;
- rename preserved identity;
- move preserved metadata and remained Draft-only;
- delete removed only safe assets;
- usage click opened Editor and selected `portfolio-profile-media`;
- picker search/tabs/keyboard/double-click applied an existing asset;
- Duplicate Reference, Remove, Undo, and Reveal worked;
- drag target highlight appeared and drop changed Snapshot plus the live blob Preview URL;
- command history remained within 10;
- no unhandled rejection or serious browser console error occurred.

Screenshots captured and visually inspected:

- [`artifacts/phase-032-asset-library.png`](artifacts/phase-032-asset-library.png)
- [`artifacts/phase-032-media-picker.png`](artifacts/phase-032-media-picker.png)

The rendered library uses the established cream/rose Admin palette, consistent radii, focus states, detail hierarchy, and non-blocking picker dock. Formal reference comparison: **Belum dilakukan.** This checkout has no `design/` directory or Phase 032 visual reference, so no pixel-fidelity claim is made.

## Regression report

| Boundary | Evidence | Result |
|---|---|---:|
| Phase 029F-R3 selection/property/Draft/Favorite | `tests/editor-r3-runtime.mjs` | PASS |
| Phase 030 object model/registry/validation/Draft-Guest mapping | `tests/editor-object-system-runtime.mjs` | PASS |
| Phase 031 Editor UX/accessibility/performance | `tests/editor-professional-ux-runtime.mjs` | PASS |
| Phase 030A Default/Published/rollback/isolation contracts | `tests/default-guest-runtime.mjs` | PASS |
| Phase 032 library/picker/editor/bulk/performance | `tests/media-library-runtime.mjs` | PASS |
| Authenticated Cloud mutation rerun | service-role credential unavailable in this session | NOT RUN |

The last authenticated Cloud regression remains recorded in Phase 031A. This phase did not change Auth, normalized CRUD, Messages, Draft/Favorite repositories, Publish/Rollback, Guest Runtime, schema, migrations, RLS, or bucket configuration. No fresh authenticated Cloud evidence is fabricated.

## Static validation

| Command | Result |
|---|---:|
| `npx vue-tsc --noEmit` | PASS |
| `npm run build` | PASS - 1,979 modules transformed |
| `git diff --check` | PASS (line-ending warnings only) |

## Files

Created:

- `src/types/mediaLibrary.ts`
- `src/stores/mediaLibrary.ts`
- `src/pages/admin/components/AssetVirtualGrid.vue`
- `src/pages/admin/components/AssetPickerModal.vue`
- `tests/media-library-runtime.mjs`
- `artifacts/phase-032-asset-library.png`
- `artifacts/phase-032-media-picker.png`
- `PHASE-032-PROFESSIONAL-ASSET-LIBRARY.md`

Modified for Phase 032:

- `src/repositories/mediaRepository.ts`
- `src/pages/admin/AdminMedia.vue`
- `src/pages/admin/AdminEdit.vue`
- `src/editor/propertyRegistry.ts`
- `src/types/editor.ts`
- `src/router/index.ts`
- `tests/editor-r3-runtime.mjs`
- `tests/editor-professional-ux-runtime.mjs`
- `PROJECT-IMPLEMENTATION-LOG.md`

Pre-existing dirty Phase 031A reports, tests, and refreshed artifacts were preserved.

## Known limitations

1. Media Favorites are browser-local and not cross-device because Phase 032 explicitly prohibited database/RLS architecture changes.
2. Legacy/built-in assets without persisted width, height, size, or timestamps correctly display `Not available`; values are never invented.
3. A fresh authenticated Cloud upload/move/delete run was not possible without a disposable service-role credential. Local repository/browser flows and existing Cloud boundaries were verified without fabricating Cloud evidence.
4. The PUBLIC bucket decision is unchanged. Draft isolation remains an application/repository/reference boundary; Guest Runtime continues to consume only Published Snapshot references.

## Final self-audit

| Section | Status | Evidence |
|---|---:|---|
| A - Media Library | PASS | Dedicated real-data route, virtual grid, all search/sort/filter modes. |
| B - Media Details | PASS | Preview, dimensions, size, MIME, dates, usage and location. |
| C - Media Usage | PASS | Snapshot-derived usage index; Used-in click selected exact Editor object. |
| D - Media Picker | PASS | Search, Preview, Favorites, Recent, drag, double-click and keyboard. |
| E - Editor Integration | PASS | Upload, Choose, Replace, Remove, Duplicate Reference, Reveal. |
| F - Media Favorites | PASS | Stable-ID browser persistence, explicitly separate from Draft Favorites. |
| G - Unused Media | PASS | Safe/Used/Published/Draft-only/built-in classification and gates. |
| H - Bulk Actions | PASS | Multi Favorite/Download/Rename/Move/Delete executed in browser. |
| I - Rename | PASS | Metadata-only single/batch rename; stable identity unchanged. |
| J - Thumbnails | PASS | Lazy cards show resolution, aspect ratio, and file size where known. |
| K - Editor UX | PASS | Drag target outline plus immediate Snapshot and Preview update. |
| L - Search | PASS | Instant name/type/usage/folder search; 80-query stress run passed. |
| M - Performance | PASS | Virtualization, lazy thumbnails, bounded DOM, DevTools evidence. |
| N - Accessibility | PASS | Keyboard, ARIA, focus, live status, zero unlabeled tested controls. |
| Static validation | PASS | Typecheck, production build, diff check. |
| Previous-phase regression | PASS | R3, Object System, Professional UX, Default/Published runtime all rerun. |

No Phase 032 requirement was silently skipped. No Phase 033 work was started.
