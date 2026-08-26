# PHASE-029F-R2 — Draft Recovery, Draft Library & Favorites

Status: PARTIAL / IMPLEMENTED

## Scope

Implemented editor recovery remediation, Draft Library, Favorite Drafts, dashboard navigation, repository boundaries, and the disabled Publish boundary. Publish execution, Published Snapshot activation, Guest Runtime cutover, media promotion, and migration of normalized runtime tables were not implemented.

## Review remediation

- Save failures now propagate through the save action; only a successful repository save reports `Saved`.
- Selected entity, selected section, accordion, zoom, scroll position, and session state are restored without being overwritten by default initialization.
- Certificate content and certificate media edits are represented in `EditorSnapshot` and use local editor state until Draft persistence.
- Media assignments use semantic media usage/photo-area IDs rather than owner IDs.
- Draft discard uses an Admin-only database function boundary and the focused migration adds matching RLS/grants.
- Draft writes use `save_editor_draft`, which serializes the revision boundary with a PostgreSQL advisory transaction lock and rejects stale bases.
- Startup failures show a retry surface; local editor state is not silently replaced.
- The in-memory fallback returns its browser object URL for staged media. It remains process-memory-only and is documented as non-persistent until Supabase is configured.
- Snapshot validation now checks session, typography, layout, media, background, animation, and certificate-card domains.

## Repository and database

`EditorDraftRepository` now supports listing, loading by stable revision ID, counting, creating, updating, and deleting Draft revisions. Repeated saves update the same Draft when `draftRevisionId` is supplied. New workspaces explicitly pass `createNew`.

`FavoriteRepository` stores only a relation to an existing Draft revision. It does not duplicate snapshots. Favorite insertion is idempotent and limited to eight per Admin.

Migration `0015_draft_library_favorites.sql` adds:

- owned Draft SELECT/UPDATE/DELETE policies;
- `editor_favorites` with a unique `(user_id, revision_id)` constraint;
- Admin-only Favorite policies;
- atomic Draft save/discard RPC boundaries;
- concurrent-safe Draft and Favorite limit triggers;
- authenticated grants and function execution permissions.

The migration was created locally but was not applied to a remote project in this phase.

## UI and navigation

- `/admin/drafts` lists up to ten Drafts, newest first, with revision/base revision, relative modified time, section summary, preview reference, favorite toggle, open, and delete actions.
- `/admin/favorites` lists up to eight Favorite Draft relations, newest favorite first, with open, unfavorite, and delete actions.
- Dashboard Draft and Favorite cards show live repository counts and are full keyboard-accessible navigation cards.
- The editor has a `+` source modal for opening Draft or Favorite libraries and displays the current Draft source.
- Publish remains disabled and no publish operation was added.

## Runtime evidence

The in-memory CDP repository test was extended to cover:

- same-ID Draft update on repeated save;
- two distinct Drafts;
- Draft limit rejection at item eleven;
- Favorite add/remove and favorite limit rejection;
- delete cascade of Favorite relation;
- media object URL behavior in fallback mode;
- stale revision rejection;
- snapshot serialization.

Authenticated browser E2E was not run: no authenticated Admin session or usable local Vite runtime target was available in this environment. No screenshot is claimed.

## Validation

- `npx vue-tsc --noEmit` — PASS
- `npm run build` — PASS, 1,939 modules transformed
- `git diff --check` — PASS, with normal LF/CRLF warnings only

## Remaining blockers

1. Apply and verify migration `0015_draft_library_favorites.sql` against the configured Supabase project.
2. Run authenticated browser acceptance for Draft/Favorite navigation, switching, hard refresh, session restore, and RLS/limit behavior.
3. Replace the current native confirmation fallback for editor switching with the final three-action Save/Discard/Cancel modal if the existing design system requires distinct buttons.
4. Phase 029G must implement Publish while preserving Draft rows and Favorite relations.
