# PHASE 030A — Default Guest Runtime & First Publish Experience

## Verdict

`PASS`

Guest Runtime now always resolves one of two explicit sources:

1. the active Published Snapshot; or
2. the immutable built-in Default Runtime Snapshot when the repository confirms that no Published revision exists.

Default is neither a Draft nor a Published revision. Repository contracts, Draft/Favorite architecture, atomic Publish/Rollback RPCs, Editor Object System, Property Registry, migrations, and Storage configuration were not changed. `portfolio-media` remains PUBLIC.

## Runtime flow

```text
Guest startup / route entry
  -> Guest Published Repository
  -> load active Published Snapshot
       -> found
            -> resolve published/* media
            -> hydrate Published Runtime
       -> no row
            -> clone immutable built-in Default Snapshot
            -> hydrate Default Runtime
       -> request/validation/media failure
            -> show recoverable unavailable state
            -> never silently substitute Default
```

`activeGuestRuntimeSource` and the Site store identify `default` versus `published`. The compatibility export `activePublishedEditorSnapshot` is intentionally `null` while Default is active, so Default cannot be mistaken for a database revision.

## Default Snapshot architecture

`src/runtime/defaultRuntimeSnapshot.ts` creates the canonical template from the project's existing source-of-truth defaults:

- `createDefaultSiteSnapshot()` for every section, content, visual configuration, behavior, media usage, layout, colors, decorations, buttons, and spacing;
- `defaultCertificates` for the original Certificate cards and media areas;
- `createEditorSnapshot()` for the final typed Snapshot envelope and compatibility metadata;
- 45 stable entity/object references covering the eight portfolio sections, navigation, buttons, media/photo areas, Certificate objects, and behavior metadata.

The module-level canonical template is deeply frozen. Consumers receive a structured clone, so Pinia, Preview, Draft, or Published hydration cannot mutate the built-in source. Snapshot validation runs while the canonical template is constructed; an invalid built-in template fails explicitly during development/build runtime.

The original visual data is reused rather than duplicated. No substitute asset, guessed style, migration seed row, or hidden Draft was created.

## Loading and error behavior

- Guest startup begins the Published lookup while Auth restores.
- If the runtime is still loading when Vue mounts, the existing loading state is available.
- A confirmed empty active-Published RPC hydrates Default and renders the complete portfolio.
- A real repository, snapshot-validation, or Published-media error clears the active runtime source and displays `Published site is temporarily unavailable.` with Retry.
- Retry performs a forced repository refresh.
- A Published row whose media resolution fails is never converted into Default; this was asserted in the browser harness.

The former no-Published empty page is therefore no longer reachable for a healthy, empty installation.

## Cache behavior

Default and Published resolutions share one source-aware in-memory runtime cache:

- route re-entry rehydrates the canonical Guest source instead of retaining Editor Preview memory;
- Publish/Rollback invalidation clears the cache;
- `localStorage` and `BroadcastChannel` signals refresh an open Guest tab;
- consecutive invalidations are queued rather than dropped;
- an older empty lookup cannot overwrite a newer first-Published lookup;
- the immutable Default module and its bundled assets also receive normal browser module/asset caching.

The race assertion deliberately delayed an old empty result, activated Revision 1, and verified that the final Guest source remained Published.

## Draft, first Publish, and subsequent Publish

The browser contract verified:

```text
Default visible
  -> Save Draft A
  -> Guest remains Default
  -> Publish Draft A as Revision 1
  -> Guest source becomes Published
  -> unsaved Draft edit
  -> Guest remains Revision 1
  -> Save and Publish Revision 2
  -> Guest becomes Revision 2
```

Publish continues through the existing repository/pipeline. Default is not passed to Publish, persisted to `site_revisions`, or used as a Draft identity. Once a Published row exists, repository-first resolution always chooses Published.

## Rollback behavior

The existing append-only Rollback contract was not changed. Runtime verification published revisions 1 and 2, rolled back revision 1 as active revision 3, and asserted that the resulting Guest source remained `published`. There is no Default revision ID and Rollback cannot select the built-in template.

## Guest isolation

- Guest never calls a Draft or Favorite repository.
- Guest route re-entry overwrites any stale Site Preview adapter with cached Default/Published data before rendering Guest content.
- Draft-only Save, unsaved edits, Draft deletion, and Favorite deletion did not change the active Guest result.
- Embedded Admin Preview no longer applies the global Guest runtime DOM updater; it remains bound to its own EditorSnapshot.

## Cloud evidence

Read-only Cloud inspection on 2026-08-29 returned:

```json
{
  "published_count": 0,
  "draft_count": 0,
  "favorite_count": 0,
  "public_bucket_count": 1,
  "active_rpc_count": 1,
  "active_rpc_rows": 0
}
```

The anonymous Cloud browser smoke test then loaded the application through the same `get_active_published_snapshot` RPC used by Guest and returned:

```json
{
  "status": "PASS",
  "source": "default",
  "revision": null,
  "activeRpcObserved": true,
  "editableQueriesObserved": false,
  "defaultEntities": 45
}
```

No request targeted `site_revisions`, Draft, Favorite, or normalized editable tables. No Cloud row, migration, function, policy, object, or bucket setting was changed during Phase 030A.

## Runtime scenarios

| Scenario | Result | Evidence |
|---|---|---|
| 1. Fresh database, no Published | PASS | Anonymous Cloud RPC returned zero rows; complete Default portfolio rendered |
| 2. Save Draft only | PASS | In-memory repository Save retained Default Guest title/source |
| 3. First Publish | PASS | Revision 1 replaced Default in runtime and rendered DOM |
| 4. Edit Draft without Publish | PASS | Published Revision 1 remained visible |
| 5. Publish second revision | PASS | Guest advanced to Revision 2 |
| 6. Rollback | PASS | Active Revision 3 restored Revision 1 and stayed Published |
| 7. Delete Draft | PASS | Published Guest and history remained unchanged |
| 8. Delete Favorite | PASS | Favorite relation disappeared; Draft/Guest were unchanged |

Additional assertions covered same-Draft updates, Draft/Favorite preservation through Publish, route re-entry isolation, recoverable failure UI, retry, cache invalidation, and stale-response rejection.

## Browser evidence

`tests/default-guest-runtime.mjs` final local result:

```json
{
  "status": "PASS",
  "defaultSource": "default",
  "defaultEntities": 45,
  "firstPublishedRevision": 1,
  "publishRevisions": [1, 2, 3],
  "rollbackStayedPublished": true,
  "draftAndFavoriteIsolation": true,
  "publishedFailureDidNotFallback": true,
  "routeReentryIsolation": true,
  "recoverableFailureUi": true,
  "staleDefaultRaceRejected": true
}
```

Screenshots:

- `artifacts/phase-030a-default-guest.png`
- `artifacts/phase-030a-first-published-guest.png`
- `artifacts/phase-030a-cloud-default-guest.png`

All three were opened and visually inspected. The original full Portfolio hero, image, navigation, decoration, colors, and typography render in Default; the first-Published screenshot visibly replaces its title. A formal design-reference comparison is not claimed because `design/` and `md/` are absent in this checkout.

## Regression verification

- Phase 030 professional Editor browser harness: PASS with 45 objects, metadata extensibility, selection, Inspector, Undo/Redo, dependency, validation, Draft round-trip, and shared Guest property runtime.
- Repository, Publish, Rollback, Snapshot, Draft, Favorite, Auth, CRUD, Message Center, Property Registry, and Storage source files/contracts outside the Guest orchestration scope were not changed.
- Existing Phase 029G authenticated Cloud Publish/Rollback evidence remains applicable because no pipeline, RPC, migration, repository contract, or Storage implementation changed.
- `portfolio-media` was independently confirmed as PUBLIC and was never modified.

The authenticated full Cloud Publish harness was not rerun because its disposable service-role credential was unavailable. Phase 030A instead adds a real anonymous Cloud zero-Published browser run plus a complete browser-executed in-memory Draft/Publish/Rollback contract. This limitation does not hide a failed test and no Cloud Publish claim was fabricated.

## Static validation

- `npx vue-tsc --noEmit` — PASS.
- `npm run build` — PASS; Vite transformed 1,967 modules.
- `git diff --check` — PASS; line-ending warnings only.

## Files

Created:

- `src/runtime/defaultRuntimeSnapshot.ts`
- `tests/default-guest-runtime.mjs`
- the three Phase 030A screenshots listed above
- this report

Modified:

- `src/runtime/publishedRuntime.ts`
- `src/stores/site.ts`
- `src/pages/guest/HomePage.vue`
- `src/main.ts`
- `PROJECT-IMPLEMENTATION-LOG.md`

Protected and unchanged:

- repository contracts and implementations;
- Draft/Favorite architecture;
- Publish/Rollback pipeline and RPCs;
- migrations and database schema;
- Editor Object System and Property Registry;
- bucket identity and visibility;
- `AGENTS.md`, `md/**`, and `design/**`.

## Final self-audit

| Requirement | Result | Evidence |
|---|---|---|
| Published-first, Default-second order | PASS | Repository-first resolver and local/Cloud runtime assertions |
| Default is not Draft or Published | PASS | Null revision, Default source, null active-Published ref, no DB row |
| Canonical complete initial template | PASS | Existing default Site/Certificate sources and 45 entity references |
| Immutable Default Snapshot | PASS | Deep-frozen canonical object; cloned consumers; runtime assertion |
| Guest never blank for zero Published | PASS | Cloud zero-row screenshot renders complete portfolio |
| Save Draft leaves Guest Default | PASS | Scenario 2 assertion |
| First Publish switches Default to Published | PASS | Revision 1 cache/DOM assertion and screenshot |
| Later Draft edits remain isolated | PASS | Unsaved and saved-without-Publish assertions |
| Second Publish updates Guest | PASS | Revision 2 assertion |
| Rollback uses Published history only | PASS | Revision 3 source remains Published |
| Draft/Favorite deletion leaves Guest unchanged | PASS | Independent delete assertions |
| Real Published failure does not fall back | PASS | Resolver and recoverable error-UI assertions |
| Source-aware cache and invalidation | PASS | Broadcast refresh, queued invalidation, stale-result race test |
| Editor never edits Default | PASS | Frozen source/clones; Editor Preview runtime kept separate |
| Guest never reads Draft/editable tables | PASS | Anonymous Cloud network trace and route re-entry test |
| Repository-only persistence boundary | PASS | Vue delegates to runtime/repository; no direct persistence call |
| Storage bucket remains PUBLIC | PASS | Cloud count confirms one matching public bucket; no Storage diff |
| Publish/Repository/Rollback not redesigned | PASS | No related contract/RPC/migration change |
| Browser runtime | PASS | Local and anonymous Cloud Chromium harnesses |
| Phase 029–030 regression | PASS | Phase 030 browser harness plus unchanged boundaries/static build |
| Static validation | PASS | Typecheck, build, and diff check |
| Report/screenshots/log | PASS | This report, three inspected screenshots, Request #136 log |

No required Phase 030A item is `PARTIAL`, `FAIL`, or `NOT RUN`.

## Final verdict

`PASS`
