# PHASE 029F — Draft Persistence, Media Staging & Editor Recovery

## Scope

Implemented only the editor Draft lifecycle.

Explicitly excluded:

- Publish execution;
- Published Snapshot activation;
- Guest Runtime cutover;
- Published media promotion;
- Runtime table replacement;
- migration and Storage policy redesign.

## Architecture

```text
Admin Editor
  -> EditorSnapshot
  -> EditorDraftRepository
  -> site_revisions (draft rows only)
```

The Vue editor does not call Supabase directly for Draft persistence or media upload. It uses `editorDraftRepository`.

## Save flow

Before saving, the editor:

1. records the current editor session in `EditorSnapshot.session`;
2. sends the complete snapshot and draft media references to `EditorDraftRepository`;
3. validates the snapshot;
4. checks the expected base revision;
5. persists one complete Draft row;
6. updates the local revision metadata only after success.

The editor keeps its local state on network or validation failure. Partial save success is not reported as success.

Header states are `Unsaved`, `Saving…`, `Saved`, and `Conflict`. No `alert()` is used.

## Recovery flow

On editor startup:

- an existing Draft is loaded from `EditorDraftRepository`;
- its snapshot, revision metadata, session, and media references are restored;
- otherwise the editor initializes from the published repository boundary when available, with the existing site snapshot as the local fallback.

Restored session fields include selected entity, accordion, preview scroll offsets, zoom, and property search value.

## Media staging

Draft uploads use the existing `portfolio-media` bucket and the logical path:

```text
draft/{draftScope}/{assetId}.{extension}
```

The Draft snapshot stores references only: asset ID, bucket, storage path, MIME type, and dimensions. Binary data is never embedded.

Replacing an image adds a new reference and updates the assignment. The previous object/reference is retained; no deletion or promotion occurs in this phase.

On reload, the repository creates an authenticated signed preview URL for each restored Draft media reference. Discard does not delete physical Storage objects.

## Conflict handling

The repository compares the expected base revision to the latest published revision before saving. A mismatch raises `RevisionConflictError`.

The editor then shows:

```text
This draft is outdated. Reload latest draft.
```

Local edits remain intact and are not silently discarded or overwritten.

## Discard

Discard removes the Draft Snapshot and its references through `EditorDraftRepository`, then resets the editor to the published baseline. Storage objects are intentionally retained for future garbage collection.

Undo/Redo history is not cleared by Save Draft. Discard resets the editor state and history through editor initialization.

## Runtime evidence

The existing repository runtime test was extended to cover:

- Draft media staging under `draft/`;
- media reference persistence and reload;
- preview URL restoration through the repository;
- Draft save/recovery;
- revision conflict rejection;
- serialization round trip;
- discard without repository-side physical deletion.

Browser/CDP execution was not available because no Vite runtime was listening on ports 5173–5175. Therefore browser persistence, screenshots, and remote Storage evidence are `UNVERIFIED`, not PASS.

## Validation

- `npx vue-tsc --noEmit` — PASS;
- `npm run build` — PASS, including Vue typecheck, 1,933 modules transformed;
- `git diff --check` — PASS.

