# PHASE 026 - MESSAGE CENTER

Status: IMPLEMENTED / RUNTIME PARTIAL

## Scope

Phase 026 replaces the previous Admin dummy messages and Guest local-only form behavior. The new flow uses Supabase PostgreSQL through `messageRepository`; Vue components do not query Supabase directly.

Affected implementation files:

- `supabase/migrations/0012_message_center.sql`
- `src/repositories/messageRepository.ts`
- `src/pages/guest/ContactDetail.vue`
- `src/pages/admin/AdminMessages.vue`
- `src/types/database.generated.ts`

No Auth, Storage, CRUD entity, or routing implementation was changed.

## Schema

`public.messages` contains:

- `id uuid primary key default gen_random_uuid()`
- `name text`
- `email text null`
- `message text`
- `created_at timestamptz`
- `updated_at timestamptz`
- `expires_at timestamptz null`
- `is_saved boolean`
- `ip_hash text`
- `user_agent text null`
- `status text`

All timestamps use PostgreSQL `timestamptz` and are stored in UTC. Indexes cover newest-first listing, expiration cleanup, and IP/time-window rate checks.

## RLS and privileges

- Anonymous: INSERT only.
- Anonymous SELECT, UPDATE, and DELETE: no policy and no table privilege.
- Admin authenticated role: SELECT, UPDATE, and DELETE through `private.is_admin()`.
- Admin UPDATE is guarded by a trigger: content, creation time, IP hash, user agent, and status cannot be edited. Only the save state is intended to change.

The remote policy inspection returned the four expected policies: `messages_anon_insert`, `messages_admin_select`, `messages_admin_update`, and `messages_admin_delete`.

## TTL and auto cleanup

`private.prepare_message_insert()` sets server-side values on every new message:

- `created_at = now()`
- `expires_at = created_at + interval '30 days'`
- `is_saved = false`
- `ip_hash = SHA-256(request IP)`
- `user_agent` from the request context

`private.prepare_message_update()` sets `expires_at = NULL` when saved. When unsaved, it recalculates `expires_at = now() + 30 days`.

Supabase Cron job `messages-auto-delete` runs every 15 minutes and calls `private.purge_expired_messages()`. No frontend cron or timer is used for deletion.

## Spam protection

The insert trigger reads the trusted PostgREST request context (`x-forwarded-for`, falling back to `x-real-ip`), stores only the SHA-256 hash, and counts messages from that hash over the last 24 hours. At five messages it raises SQLSTATE `PT429`.

Runtime response:

```text
HTTP 429
You have reached today's message limit. Please try again tomorrow.
```

The frontend only displays the server response; it does not calculate or enforce the limit.

## UI behavior

Guest:

- Name and message are required.
- Email is optional.
- Successful submit shows a success toast and clears the form.
- The previous “Supabase Database belum terhubung” dummy text was removed.

Admin:

- Loads directly from `messageRepository`.
- Search, select, delete, save, and unsave are implemented.
- Saved messages show a heart/love icon and `Saved` badge.
- Unsaved messages show `Expires in X days`.
- Message content is read-only in the UI.

## Runtime results

PASS:

- Remote `messages` table exists with RLS enabled.
- Guest form submitted through a clean anonymous browser.
- Success toast displayed.
- Form cleared after submit.
- PostgreSQL row contained UTC timestamps.
- `expires_at` was exactly 30 days after `created_at`.
- `is_saved=false` on new message.
- `ip_hash` length was 64 hexadecimal characters.
- User-agent metadata was captured.
- Anonymous SELECT was denied.
- Backend rate limit returned HTTP 429 with the required message.
- Cron job exists as `messages-auto-delete` with schedule `*/15 * * * *`.
- RLS policy definitions match the requested anonymous/admin matrix.
- Temporary runtime rows were removed; remaining Phase 026 test rows: `0`.
- `npx vue-tsc --noEmit` passed.
- `npm run build` passed with 1926 modules.
- `git diff --check` passed.

NOT FRESHLY EXECUTED:

- Admin browser E2E sequence (list → save → refresh → unsave → delete) was not freshly run because no safe disposable Admin credential/session was available after the isolated anonymous test. The repository calls and Admin RLS policies are implemented and the policy definitions were verified remotely, but this browser sequence remains an evidence gap.

## Migration application note

The authenticated CLI reached the linked Cloud project but `supabase db push` stopped because the remote migration history contains timestamped versions that are not present in this local migration directory. No migration repair or destructive history rewrite was performed. The Phase 026 migration was applied successfully through the configured Supabase MCP migration path and verified by remote table, policy, function, and cron inspection.
