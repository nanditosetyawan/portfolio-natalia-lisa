# Architecture

## Application boundaries

```text
Guest route
  -> GuestPublishedRepository
  -> active Published Snapshot
  -> Published media references
  -> Default Snapshot only when no Published revision exists

Admin Editor
  -> EditorSnapshot in memory
  -> command history
  -> EditorDraftRepository
  -> EditorPublishRepository
  -> existing atomic RPCs
```

Guest never queries Draft, Favorite, Editor session, or normalized editable tables. The Default Snapshot is immutable runtime content and is neither Draft nor Published.

## Canonical models

- `EditorSnapshot` remains the one content model for Draft, Preview, Publish, rollback, and Guest rendering.
- Property, Object, Responsive, Design System, and Animation metadata materialize supported values into that Snapshot through the existing command system.
- The production layer adds no parallel content model.

## Persistence

- Vue components use repositories; no Phase 036 component calls Supabase directly.
- Draft, Favorite, Published revision, Publish History, and rollback contracts are unchanged.
- The PUBLIC `portfolio-media` bucket remains unchanged. Application isolation uses `draft/*` and `published/*`, repository boundaries, and snapshot validation.

## Production layer

`src/production/` contains additive delivery concerns:

- `seo.ts`: canonical/title/description/OpenGraph/Twitter/JSON-LD and hero preload management;
- `monitoring.ts`: bounded diagnostics, Vue/runtime/network capture, and Web Performance observers;
- `pwa.ts`: production-only service-worker registration;
- `backup.ts`: repository-backed export, ZIP generation, and read-only import validation.

These modules do not activate Published revisions, mutate Drafts, copy Storage objects, or bypass RLS.

## Delivery and caching

- Guest/Admin routes are lazy chunks.
- Vue, Supabase, icons, and motion dependencies are split into stable vendor chunks.
- Vite filenames are content hashed.
- The service worker caches same-origin application shell/assets and uses network-first navigation.
- Cross-origin Supabase traffic is never service-worker cached.

## Error and observability model

- A route-level 404 handles unknown paths.
- a Vue error boundary provides a friendly render-failure state;
- online/offline events provide a non-blocking status;
- Supabase REST requests abort after 20 seconds with a retryable message;
- diagnostics are kept in a bounded in-memory ring and exported only on explicit Admin ZIP export;
- no external telemetry endpoint or duplicate persistence was introduced.

## Security model

- Browser code uses only the Supabase publishable key.
- RLS/grants remain the trusted data boundary.
- user message highlighting uses escaped Vue text nodes, not `v-html`;
- external targets use `noopener noreferrer`;
- document previews are sandboxed;
- imported backups reject credential-shaped keys, invalid Snapshots, oversized packages, and bad ZIP checksums.
