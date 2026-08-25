# PHASE 027 - ADMIN MESSAGE UX

Status: IMPLEMENTED / VISUAL EVIDENCE PARTIAL

## Scope

This phase changes only the Admin Messages presentation and the explicitly authorized persisted read state. Existing Auth, repository message data model, RLS, spam protection, TTL, auto-delete, and save/unsave behavior remain unchanged.

## Implemented UX

- Fixed-size circular avatar with initials from the sender name.
- Indonesian relative time: `Baru saja`, `5 menit lalu`, `Kemarin`, `3 hari lalu`, `2 minggu lalu`, and `1 bulan lalu`.
- `NEW` badge for `read_at IS NULL`.
- First detail open calls the repository `markRead()` operation and persists `read_at` in UTC.
- Unread rows use brighter surfaces, accent border, and heavier sender typography.
- Saved heart remains filled; unsaved heart remains outlined with hover animation.
- Saved badge or `Expires in X days` badge.
- Search highlighting with HTML escaping before highlighting.
- Empty state illustration and `Belum ada pesan.` text.
- Delete confirmation dialog with `Delete this message?`, `Cancel`, and `Delete`.
- Mobile layout preserves avatar size, badges, and relative time.

## Database change

Migration `0013_message_read_state.sql` adds only:

```sql
read_at timestamptz null
```

and an index for the read-state field. The remote Cloud migration was applied successfully through the Supabase MCP migration path and verified remotely. No TTL, RLS, spam, or auto-delete SQL was changed.

## Runtime and validation

PASS:

- Remote `read_at` exists as nullable `timestamp with time zone`.
- Remote `messages_read_at_idx` exists.
- `npx vue-tsc --noEmit`.
- `npm run build` — 1926 modules.
- `git diff --check`.

Evidence limitation:

- Fresh Admin browser screenshots for unread, read, saved, mobile, and empty states were not captured because this environment has no safe disposable Admin session. A temporary DevTools-only visual harness was attempted, but router protection correctly redirected it to Admin Login; no harness artifacts were retained and no source/Cloud data was mocked or modified.

The requested screenshot states therefore remain an evidence gap rather than being falsely reported as captured.
