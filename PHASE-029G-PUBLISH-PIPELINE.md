# PHASE 029G — Atomic Publish Pipeline & Published Runtime

## Verdict

`PASS`

Phase 029G is implemented and verified against the authenticated Supabase Cloud project. Publish and Rollback activate immutable Published Snapshots atomically at the database boundary. Guest Runtime reads only the active Published Snapshot and only emits media references under `portfolio-media/published/`.

The existing `portfolio-media` bucket remains **PUBLIC**. No bucket was created and its visibility was not changed.

## Recovered after context limit

The implementation was not restarted. The following unfinished verification items were recovered and completed:

1. Reconstructed the committed Phase 029G checkpoint and isolated the remaining E2E work.
2. Corrected the Publish harness to wait for an actual `publishedRevisionNumber` increment instead of a stale status label.
3. Diagnosed repeated stale-Publish timeouts from PostgreSQL logs.
4. Replaced retryable SQLSTATE `40001` conflicts with non-retryable PostgREST HTTP 409 conflicts (`PT409`) through migration `0022_revision_conflict_http_409.sql`.
5. Added reliable Chromium target polling.
6. Split final Guest verification into active snapshot, Pinia hydration, route, and rendered-DOM assertions.
7. Added bounded retry only for recoverable network errors in the E2E harness.
8. Classified the deliberately generated HTTP 409 resource log as expected only after the RPC response proved both `(409)` and `PT409`.
9. Completed authenticated Cloud Publish, Guest, History, Rollback, isolation, and cleanup verification.
10. Re-ran typecheck, production build, diff validation, Cloud metadata checks, advisor checks, and screenshot inspection.

No original Phase 029G requirement was silently skipped because of the context limit.

## Architecture

```text
Admin Editor
  -> EditorDraftRepository
  -> saved Draft in site_revisions
  -> EditorPublishRepository
       -> validate typed EditorSnapshot
       -> prepare and verify published/* media
       -> publish_editor_draft RPC
            -> advisory transaction lock
            -> revision and Draft lock checks
            -> snapshot/media/database validation
            -> insert immutable Published revision
            -> commit

Guest Runtime
  -> GuestPublishedRepository
  -> get_active_published_snapshot RPC
  -> latest Published revision only
  -> reject every non-published/* media reference
  -> public Published media URL
```

`site_revisions` is reused for both Draft rows and immutable Published history. The `status`, `publication_kind`, and monotonically increasing Published `revision_number` define the revision role. No duplicate snapshot model or replacement runtime table was introduced.

## Published Snapshot

Each Published row stores:

- the complete validated `EditorSnapshot`;
- monotonic `revision_number`;
- `published_at` and `published_by`;
- `source_draft_revision_id`;
- optional `publish_note`;
- `publication_kind` (`publish` or `rollback`);
- optional `rollback_source_revision_id`.

Published rows are append-only through the Admin workflow. Normal Admin RLS allows deletion only for owned Draft rows, not Published history rows.

## Repository boundaries

Persistence and activation remain behind repositories:

- `EditorDraftRepository` saves and reloads Drafts.
- `EditorPublishRepository.validateDraft()` validates the saved Draft.
- `EditorPublishRepository.publishDraft()` prepares media and calls the atomic Publish RPC.
- `EditorPublishRepository.rollbackRevision()` calls the atomic Rollback RPC.
- `EditorPublishRepository.getPublishedRevision()` and `getHistory()` expose current/history metadata.
- `GuestPublishedRepository.loadPublishedSnapshot()` calls only the narrow active-Published RPC.
- `GuestPublishedRepository.resolvePublishedMedia()` rejects any reference outside `portfolio-media/published/*` and generates public URLs.

Vue pages do not execute Publish or Rollback through direct Supabase calls.

## Publish flow

```text
Saved Draft
  -> validate EditorSnapshot domains and required content
  -> verify Draft lock token
  -> prepare all media under published/{nextRevision}/
  -> download and verify every prepared object
  -> call publish_editor_draft(...expected revisions...)
  -> acquire shared advisory transaction lock
  -> compare current Published revision
  -> lock and compare the source Draft
  -> validate snapshot shape/content/entities/media parity
  -> verify every prepared storage.objects row, MIME, size, and owner
  -> insert one Published history row
  -> commit
  -> invalidate Published Runtime cache signal
```

Publish never updates normalized Guest tables and never deletes or rewrites the source Draft, Favorite relation, or Editor command history.

## Atomic transaction boundary

Storage copy/upload operations cannot participate in a PostgreSQL transaction. Media preparation therefore completes before activation. Atomicity is enforced at the only Guest-visible boundary:

- the new Published row is inserted in one RPC transaction;
- revision comparison and activation share an advisory transaction lock with Draft saves and Rollback;
- the database rechecks object metadata and snapshot parity after preparation;
- any validation/conflict failure aborts the transaction;
- Guest continues reading the previous highest Published revision until commit;
- a failed attempt cannot expose a partially prepared snapshot.

The stale-revision boundary returns HTTP 409 / `PT409`. This avoids PostgREST treating an intentional application conflict as retryable serialization failure.

## Publish validation

Validation covers:

- typed EditorSnapshot compatibility/version;
- typography, layout, media, background, button, and animation domains;
- required Portfolio/Profile/About/Education/Experience/Certificate/Contact text;
- unique and valid entity references;
- unique media asset identities and valid assignments;
- required profile image assignment;
- supported image MIME and non-empty media;
- no embedded `data:` or transient `blob:` references;
- Published references restricted to `portfolio-media/published/*`;
- prepared content parity with the saved Draft outside physical media locations;
- prepared media identity/metadata parity;
- physical object existence, MIME, positive size, and Admin ownership;
- current Published revision, Draft base revision, and Draft lock version.

## Storage promotion

The existing bucket is reused exactly as required:

```text
portfolio-media/
  draft/{draftRevisionId}/...
  published/{publishedRevisionNumber}/...
```

- The bucket remains PUBLIC.
- No second bucket exists.
- Draft source objects remain untouched after Publish.
- Draft references are copied to a revision-scoped Published path.
- Existing valid Published references may be reused.
- External/static source media is uploaded to the new Published path.
- Every prepared object is downloaded and checked before activation.
- Guest repository and database validation both reject `draft/*` references.

### Public-bucket limitation

Because bucket visibility is explicitly required to remain PUBLIC, anyone who already knows an exact public object URL can request that object directly; public delivery is not made private by Storage SELECT policies. Draft isolation is therefore enforced by snapshot references, repository boundaries, RLS/Data API access, and application logic: Guest receives and renders only `published/*` paths and never receives a Draft reference.

This is the intentional project tradeoff required by the PUBLIC-bucket decision, not an unreported private-bucket guarantee.

## Guest Published Runtime

Application bootstrap now initializes `GuestPublishedRepository` instead of normalized editable repositories. Guest behavior is:

1. call `get_active_published_snapshot()`;
2. read only the greatest Published revision;
3. validate/resolve only `published/*` media;
4. hydrate Site and Certificate runtime stores from the canonical EditorSnapshot adapter;
5. render without editor selection metadata or Draft fallback.

When no valid Published Snapshot can be loaded, Guest shows an unavailable/retry state. It does not fall back to Draft or normalized editable content.

## Cache invalidation

Successful Publish and Rollback emit a Published revision invalidation through local storage and `BroadcastChannel`. A Guest refresh always reloads the active Published Snapshot; revision-scoped media paths avoid stale object replacement.

## Publish History and Rollback

The `/admin/published` page provides:

- current revision badge;
- revision/date/author/source Draft metadata;
- optional notes;
- immutable history cards;
- confirmation before Rollback;
- explicit Rollback status/errors.

Rollback does not mutate an old row. `rollback_published_revision` creates a new monotonically increasing Published row whose snapshot equals the selected historical revision. The source Draft, Favorite, and Editor history remain unchanged.

## Editor and Dashboard UI

- Existing Publish button is enabled only for a clean, saved Draft.
- Confirmation dialog states that Draft/Favorite/history remain.
- Toolbar status uses `Publishing...`, `Published`, and `Failed`; no `alert()` is used.
- Editor remains on the same Draft after Publish.
- Dashboard Published card displays current revision/date and opens Publish History.
- History provides revision badges and Rollback actions.

## Database, RLS, and grants

Cloud migrations applied:

- `atomic_publish_pipeline`
- `keep_portfolio_media_public`
- `service_role_maintenance_grants`
- `revision_conflict_http_409`

Verified Cloud state:

- `site_revisions` contains all Published metadata columns;
- `portfolio-media.public = true`;
- anon direct SELECT on `site_revisions` and `editor_favorites` is false;
- anon can execute only `get_active_published_snapshot()` for this flow;
- anon cannot execute Publish or Rollback;
- authenticated Admin has the required table and RPC grants, still constrained by RLS and `private.is_admin()`;
- Draft/Published object prefix policies and Admin object policies exist;
- all three revision conflict routines contain `PT409` and no `40001`.

The Supabase security advisor flags anonymous execution of the SECURITY DEFINER active-Published RPC. This is intentional and narrowly scoped: direct table SELECT is revoked, the function has a fixed empty search path, takes no caller-controlled arguments, and returns only the latest Published row. Other advisor notices (`rls_auto_enable`, first-admin bootstrap, leaked-password setting, and old unused indexes) predate this phase and were not changed.

## Authenticated Cloud runtime evidence

Final harness output:

```json
{
  "status": "PASS",
  "scope": "Phase 029G authenticated Cloud Publish/Guest/Rollback E2E",
  "revisions": [1, 2, 3],
  "draftPreserved": true,
  "favoritePreserved": true,
  "guestPublishedOnly": true,
  "publicBucket": true,
  "cleanupScheduled": true
}
```

Verified sequence:

1. Create authenticated disposable Admin and membership.
2. Edit and save one Draft; add its Favorite relation.
3. Publish Revision 1; verify Guest title/media and Draft/Favorite/history preservation.
4. Edit Draft without saving; verify Guest still displays Revision 1.
5. Save and publish Revision 2; verify Guest advances only after activation.
6. Submit stale expected Published revision; verify immediate `(409)` / `PT409` and unchanged Guest Revision 2.
7. Trigger a separate invalid Publish through the UI; verify recoverable `Failed` state and visible errors.
8. Verify the Dashboard Published card shows Revision 2/date, exposes button/focus semantics, and opens History with Enter.
9. Open History and atomically Rollback to Revision 1, creating active Revision 3.
10. Verify anonymous active RPC, Guest Pinia state, route, rendered title, and all Guest media URLs reflect the rollback.
11. Verify Guest network traffic contains the active-Published RPC and no Draft, Favorite, `site_revisions`, or normalized editable table query.
12. Verify Draft, Favorite, and history remain after Rollback.
13. Remove exact disposable objects, revisions, Favorite, membership, and Auth user.

Independent post-test cleanup query returned:

```text
site_revisions: 0
favorites: 0
phase users: 0
published test objects: 0
advisory locks: 0
```

## Runtime screenshots

- `artifacts/phase-029g-publish-confirmation.png`
- `artifacts/phase-029g-publish-history.png`
- `artifacts/phase-029g-guest-rollback.png`

All three were visually inspected. They show the Publish confirmation, two-row Publish History before Rollback, and the Guest rendering restored Revision 1. A formal design-reference comparison was unavailable because no Phase 029G design reference exists in this checkout.

## Static validation

Executed after the final Cloud E2E:

- `npx vue-tsc --noEmit` — PASS.
- `npm run build` — PASS; Vite transformed 1,945 modules.
- `git diff --check` — PASS.

## Known operational notes

- Storage preparation is non-transactional by platform design; atomicity is at Published activation. Prepared objects from a failed activation remain future cleanup candidates and are never referenced by Guest.
- The bucket remains PUBLIC by explicit requirement, so path secrecy is not a physical access-control guarantee. Application and repository isolation is verified.
- Formal pixel comparison is not claimed because the repository contains no relevant Phase 029G design reference.

## Final self-audit

| Requirement | Result | Evidence |
| --- | --- | --- |
| Published Snapshot representation | PASS | Full typed snapshot and metadata in immutable Published rows |
| Atomic Publish | PASS | Advisory lock, compare/validate/insert in one RPC transaction |
| Media promotion | PASS | Prepared and verified `published/{revision}/*`; Draft untouched |
| Publish validation | PASS | Client domain validation plus database content/media/object checks |
| Monotonic revisions | PASS | Cloud E2E activated revisions 1, 2, then rollback revision 3 |
| Publish History | PASS | Persistent Published rows and authenticated History UI |
| Atomic Rollback | PASS | New revision 3 restored revision 1 without Draft/Favorite mutation |
| Draft/Favorite preservation | PASS | Repository and Cloud E2E assertions before/after Publish/Rollback |
| Editor remains on same Draft | PASS | Draft ID and command history assertions |
| Publish status and confirmation | PASS | Publishing/Published/Failed states and modal screenshot |
| Guest Published-only cutover | PASS | Active RPC only; no editable/normalized query in Guest trace |
| Cache invalidation | PASS | Revision signal emitted; Guest refresh/runtime reload verified |
| Repository-only persistence boundary | PASS | Vue delegates to repositories/composable runtime |
| Database/RLS/grants | PASS | Independent Cloud metadata and privilege query |
| PUBLIC bucket preserved | PASS | Cloud `public=true`; no visibility mutation or new bucket |
| Draft/Published prefix isolation | PASS | Snapshot, repository, SQL, network, and DOM assertions |
| Dashboard/History UI | PASS | Current revision card, History route, badges, Rollback control |
| Failure/partial-activation safety | PASS | Stale and invalid Publish leave active Guest unchanged |
| Authenticated runtime E2E | PASS | Final harness output and screenshots |
| Disposable cleanup | PASS | Independent zero-count query after harness completion |
| Static validation | PASS | Typecheck, build, and diff check all passed |
| Report and project log | PASS | This report and Request #134 log entry |

### Did the previous context limit skip any required step?

No. The unfinished items are listed under **Recovered after context limit** and were completed. No Phase 029G requirement remains `PARTIAL`, `FAIL`, or `NOT RUN`.

## Final verdict

`PASS`
