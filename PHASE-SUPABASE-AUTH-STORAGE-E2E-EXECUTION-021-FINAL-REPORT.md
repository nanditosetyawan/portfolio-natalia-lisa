# PHASE SUPABASE-AUTH-STORAGE-E2E-EXECUTION-021 — FINAL REPORT

## 1. Admin authentication

Implemented:

- Browser `/admin/login` password login through Supabase Auth.
- Browser `/admin/bootstrap` first-admin signup/login flow.
- Password is held only in form memory and is never written to source, migration, `.env`, or logs.
- Session restore, refresh-token recovery, logout, and access-token injection are implemented.
- Anonymous `/admin/*` routes redirect to `/admin/login`.

Runtime proof:

- Anonymous `/admin/edit` redirected to `/admin/login`.
- `/admin/bootstrap` rendered with email/password controls.
- Anonymous call to `bootstrap_first_admin` returned `401`.

Not proven: a real account login, because no user credential was available and no safe user-management capability was exposed.

## 2. Admin authorization

Implemented through `auth.users.id → admin_memberships.user_id` and the existing `private.is_admin()` RLS authority.

Migration `0010_first_admin_bootstrap.sql` adds a one-time authenticated bootstrap function. It inserts the first membership only when the membership table is empty; it accepts no user ID and no role input. It is not callable by anonymous users.

The security advisor reports the expected SECURITY DEFINER warning for this authenticated-only bootstrap function. This is intentional, narrowly scoped, and separate from the pre-existing `rls_auto_enable()` warning.

## 3. PostgreSQL CRUD

Not proven with a real Admin session. No fixture rows were created because no account was available. Existing repository CRUD paths remain unchanged.

## 4. Reorder

Not proven against remote rows. Existing canonical ordering remains ID-independent and uses `order_index`.

## 5. Storage bucket

Target bucket: `portfolio-media`.

Read-only Storage API list returned an empty bucket list. Supported `supabase-js storage.createBucket()` was attempted with the publishable key and was rejected with:

`new row violates row-level security policy`

No bucket was created. No service-role key, Dashboard mutation, or direct SQL insert was used.

## 6. Upload

Implemented `src/repositories/mediaRepository.ts` using `supabase-js` Storage API:

- image-only validation;
- 10 MB limit;
- deterministic `portfolio/{entityType}/{entityId}/{mediaId}.{ext}` path;
- upsert upload;
- public URL return.

Runtime upload is blocked until the single target bucket exists.

## 7. Replace

Admin Edit no longer converts selected images to Base64/data URLs. It calls the media repository and updates the canonical source only after Storage upload succeeds.

Remote replace proof is blocked by the missing bucket and Admin session.

## 8. Delete

`removePortfolioMedia()` is implemented in the media repository and uses the supported Storage remove API. Remote delete proof is blocked by the missing bucket/session.

## 9. Media metadata

The adapter returns bucket, path, public URL, MIME type, and file size. Existing Postgres media persistence still rejects Base64/data URLs. Remote metadata round-trip is not proven because no object was available.

## 10. RLS matrix

| Actor | Read | Create | Update | Delete |
|---|---|---|---|---|
| Anonymous | Guest public reads previously PASS | DENY PASS | DENY PASS | DENY PASS |
| Authorized Admin | Not runtime-proven | Not proven | Not proven | Not proven |
| Unauthorized auth | Not runtime-proven | Not proven | Not proven | Not proven |

Existing anonymous-write denial was verified in Phase 019. The first-admin bootstrap endpoint is anonymously denied in this phase.

## 11. Storage policy matrix

Migration `0011_portfolio_storage_policies.sql` adds public read and admin-only insert/update/delete policies for bucket `portfolio-media`. It never inserts into `storage.buckets` or `storage.objects`.

Runtime matrix is not complete because the bucket and authenticated accounts are unavailable.

## 12. Certificate persistence

Not run against remote fixture rows. Existing fallback/default behavior and canonical persistent certificate behavior remain preserved. Storage-backed image persistence remains blocked.

## 13. Hard refresh

Not proven after a real mutation. Auth session persistence is implemented, but no real Admin mutation was available for comparison.

## 14. Multi-session

Not run. Requires a real Admin account and a second browser session.

## 15. Guest read

Previously PASS and preserved. Guest reads through the repository and falls back safely when the database is empty.

## 16. Admin write

Not proven with an authorized user. Anonymous write denial remains enforced; Admin UI upload/save now propagates explicit errors instead of reporting false success.

## 17. Error handling

Implemented/verified locally:

- invalid image type rejected;
- image over 10 MB rejected;
- Storage errors are thrown with explicit messages;
- Admin upload/save displays failure status;
- anonymous first-admin RPC denied.

Authenticated nonexistent-entity/media tests remain pending.

## 18. Runtime

- Node `v26.3.0`: PASS.
- npm `11.16.0`: PASS.
- Vite runtime: PASS.
- Bootstrap route browser smoke: PASS.
- Anonymous Admin route guard: PASS.
- Full Authenticated Admin/Storage E2E: NOT PROVEN.

## 19. Build

PASS — `npm run build` (1925 modules transformed).

## 20. Typecheck

PASS — `npx vue-tsc --noEmit`.

## 21. Diff check

PASS — `git diff --check`.

## 22. Free-plan safety

No branching, paid compute, add-on, Edge Function, realtime channel, service-role frontend exposure, second bucket, or upgrade was used. `@supabase/supabase-js` was installed as a project-local dependency only.

## 23. Remaining limitations

- A real Admin account must be created by opening `/admin/bootstrap` in the browser and entering credentials directly. The form is ready; credentials were intentionally not supplied to or stored by Codex.
- Supabase Storage bucket management rejects publishable-key creation. A supported project-admin/Storage management capability is required to create the one `portfolio-media` bucket.
- Authenticated CRUD, Storage upload/replace/delete, hard refresh after mutation, multi-session, and complete RLS matrix remain unproven.
- No test fixture rows, Auth users, or Storage objects were left in the project.

## 24. Final verdict

`PARTIAL`

The implementation blockers were addressed with a secure browser bootstrap flow, one-time database bootstrap function, Auth session integration, Storage repository, and Storage policies. Full PASS remains externally blocked by the absence of a valid Admin account and bucket-management capability; no unsafe credential or storage-schema shortcut was used.
