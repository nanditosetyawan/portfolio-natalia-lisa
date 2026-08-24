# PHASE SUPABASE-PERSISTENCE-VERIFICATION-018 — FINAL REPORT

## Schema gaps fixed

The five gaps from `SUPABASE-CANONICAL-ENTITY-REPOSITORY-AUDIT-017.md` were traced against the canonical types, default snapshot, Guest consumers, Admin registry, store, and repository.

| Gap | Evidence | Result |
|---|---|---|
| College / SHS identity | Guest `CollegeSection.vue` and `SHSSection.vue` read `item.frameIds.back/front`; Admin edits `label`; store preserves stable IDs | Added `label`, `frame_back_id`, `frame_front_id` to both tables |
| `photo_frames` metadata | Photo-area registry and Guest `PhotoArea` consume section/label/object position | Added `section`, `label`, `object_position`; repository now round-trips them directly |
| Navigation metadata | `GuestNavbar.vue` consumes `brand`, `sections[].menuKey`, and `sections[].darkBg`; Admin exposes brand; existing `navigation_items` only owns links | Added single-owner `navigation_config` table with `brand` and JSONB `sections`; transient scroll state remains excluded |
| Certificate behavior | Admin exposes `autoplay` and `slideshowIntervalMs`; Guest uses them for autoplay; current slide, expanded, loading are component/store UI state | Added `autoplay` and constrained `slideshow_interval_ms` to `certificate_sections` |
| `entity_media.owner_type` | DB already contained the field, but runtime inferred it from usage ID strings | Added `ownerType` to `MediaUsage`; repository validates/round-trips the DB value; ID inference removed |

## Migrations added

- `supabase/migrations/0007_canonical_persistence_gaps.sql`
- Applied remotely as `canonical_persistence_gaps`.
- Existing six migrations were not edited.
- Remote migration history now contains seven entries.

The migration ran against an empty application database. No existing application rows were altered or deleted.

## Tables/columns final

The original 17 application tables remain. `navigation_config` is the only additional table, justified by the absence of a correct owner for canonical navigation brand/section metadata; duplicating brand/sections onto every `navigation_items` row would create a duplicate source of truth.

Important additions:

- `college_entries.label`, `frame_back_id`, `frame_front_id` — required text, stable identity fields.
- `shs_entries.label`, `frame_back_id`, `frame_front_id` — required text, stable identity fields.
- `photo_frames.section`, `label`, `object_position` — persistent frame metadata.
- `certificate_sections.autoplay`, `slideshow_interval_ms` — persistent Guest/Admin behavior; interval has a minimum-value check.
- `navigation_config.id`, `brand`, `sections` — one-row canonical navigation owner; `sections` is constrained to a JSON array.
- `entity_media.owner_type` — existing required text field, now represented in the runtime type without inference.

Remote live verification confirmed RLS remains enabled on all application tables, the new table is RLS-enabled, and all additions have the expected data types/nullability/defaults.

## Repository round-trip

Updated:

- `src/repositories/supabaseSiteRepository.ts`
- `src/types/site.ts`
- `src/composables/usePhotoAreaRegistry.ts`
- `src/data/default/site.ts`
- `src/types/database.generated.ts`

The adapter now:

- loads/saves College and SHS labels and frame IDs;
- loads/saves photo frame section, label, and object position;
- loads/saves navigation brand and section metadata through `navigation_config`;
- loads/saves certificate autoplay and interval;
- reads and writes `MediaUsage.ownerType` directly;
- rejects unsupported persisted owner types instead of silently mapping them to `about`;
- continues to keep Supabase access inside the repository/REST boundary, not Vue components.

## Storage

Not completed. The current MCP inventory exposes no Storage bucket/object mutation tool. No bucket, object, or direct `storage` schema mutation was attempted.

## Auth

The existing schema contains `admin_memberships` and admin policies use `private.is_admin()`. No Auth user or password was created. Authenticated admin login and membership bootstrap remain unverified because the current toolset does not expose the required Auth flow.

## RLS

The new `navigation_config` table has anonymous/public read, authenticated read, and admin-only insert/update/delete policies. Existing RLS policies were not broadened.

Security advisors were rerun. The only warnings remain the pre-existing `public.rls_auto_enable()` SECURITY DEFINER function being executable by anon/authenticated roles. This warning was documented and not changed in this phase.

## Admin → DB

Not runtime-proven. The repository save path is implemented, but Node/npm and a browser runtime are unavailable in the current environment, and no authenticated Admin session exists to exercise RLS-authorized writes.

## DB → Guest

Not runtime-proven. The repository load path is implemented and schema reads were verified through Supabase MCP, but no browser/Guest session could be run against persisted test rows.

## Hard refresh

Not run. Node/npm/browser runtime is unavailable; therefore no hard-refresh PASS is claimed.

## Multi-session

Not run. No second browser/session and no authenticated Admin bootstrap are available in the current environment.

## Media independence

The relational model preserves independent `media_assets`, `entity_media`, and `photo_frames` identities. Storage upload/replace/delete proof is pending because Storage mutation tools are unavailable. No duplicate media object or data URL was written.

## Validation

- Supabase project URL verified as `https://anyhuqqnjliepllrkebo.supabase.co`.
- Remote migration application: PASS.
- Remote schema/type/nullability verification: PASS.
- Generated TypeScript types: refreshed from the remote schema.
- `git diff --check`: PASS.
- `npx vue-tsc --noEmit`: NOT RUN — `node`, `npm`, and `npx` are unavailable on PATH.
- `npm run build`: NOT RUN — `node`, `npm`, and `npx` are unavailable on PATH.
- Desktop/tablet/mobile runtime: NOT RUN.

## Free plan safety

No branching, paid compute, paid add-on, Edge Function, realtime channel, project upgrade, or billing mutation was performed. Billing plan metadata remains unavailable through the current MCP inventory and is not inferred.

## Remaining limitations

- Authenticated Admin write proof is pending an Auth-capable runtime/session.
- Storage bucket and Storage policy proof is pending a supported Storage mutation mechanism.
- Guest hard-refresh and second-session proof is pending Node/npm/browser availability and configured publishable-key environment.
- No Phase 018 production content or test rows were inserted because the required runtime/RLS proof could not be completed safely in this environment.

## Final verdict

`PARTIAL`

Schema gaps and repository mappings are implemented and remotely verified, but the phase cannot be `PASS` without the required Admin→DB→Guest, hard-refresh, multi-session, Auth, and Storage runtime evidence.
