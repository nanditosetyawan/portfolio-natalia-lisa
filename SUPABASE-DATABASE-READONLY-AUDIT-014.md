# SUPABASE DATABASE READ-ONLY AUDIT 014

Audit date: 2026-08-25 (Asia/Jakarta)  
Execution mode: read-only Supabase MCP audit; zero cloud mutation.

## 1. Connection

- Supabase MCP tools were available and authenticated for read-only calls.
- Project URL was obtained with `get_project_url`.
- `apply_migration` was not used. No resource-creation or write operation was executed.
- `FULL-PORTFOLIO-HARDCODE-DATA-CSS-AUDIT-009` final report file was not present in the repository; only its historical references in `PROJECT-IMPLEMENTATION-LOG.md` were available. Therefore that phase's final report is `Tidak ditemukan dalam specification` / unavailable.

## 2. Exact project identity

- Expected project name: `portfolio-natalia`.
- Expected project ref: `anyhuqqnjlieplrkebo`.
- Exact URL returned by MCP: `https://anyhuqqnjliepllrkebo.supabase.co`.
- Ref check: **FAIL**; the URL hostname does not match the expected ref exactly (`...plr...` expected vs `...pllr...` returned).
- Project-name check: **UNVERIFIED**. The currently exposed MCP inventory has no project metadata/name tool. No name was inferred from the URL.

Because the project ref mismatches, and the exact name and Free Plan status could not be independently verified through available MCP tools, the final verdict is `BLOCKED`. Per instruction, no mutation was attempted.

## 3. Database state

- `list_tables` returned no project/application tables in `public`.
- Internal Supabase tables are present in `auth`, `storage`, `realtime`, and `vault`; these are platform-managed tables and are not treated as application schema.
- `storage.buckets` has 0 rows and `storage.objects` has 0 rows.
- `auth.users` has 0 rows; `auth.identities`, `auth.sessions`, and `auth.instances` also have 0 rows.
- Database application state: **empty for this repository's application schema**. The database itself is not literally devoid of platform tables.

## 4. Migration state

- `list_migrations` returned `migrations: []`.
- No project migration history was reported by MCP.
- Platform-managed migration tables exist internally, but they are not project migration history.

## 5. RLS/policies

- `public` has no application tables, so no application-table RLS policy state exists to audit.
- The read-only `pg_policies` query returned an empty array.
- Internal tables reported by `list_tables` generally have RLS enabled; this is platform state, not an application policy design.
- Security advisor: two warnings for `public.rls_auto_enable()` being SECURITY DEFINER and executable by `anon` and `authenticated`.
- Performance advisor: no lints returned.
- The advisor warning is an existing remote finding; it was not changed in this phase.

## 6. Storage state

- No dedicated Storage MCP bucket tool appeared in the current inventory.
- Read-only database inspection of `storage.buckets` returned 0 rows.
- Read-only database inspection of `storage.objects` returned 0 rows.
- Bucket configuration: not applicable because no bucket exists.
- Storage status: **verified empty for buckets/objects**; service-level configuration beyond these rows is unavailable from current tools.

## 7. Auth state

- No dedicated Auth-management read tool appeared in the current inventory.
- Read-only counts: users 0, identities 0, sessions 0, instances 0.
- No user was created.
- Provider configuration, email settings, MFA/provider toggles, and Auth service plan metadata: **Belum ditentukan** with the available MCP inventory.

## 8. Free-plan safety

- No branch was created.
- No paid feature, upgrade, resource, table, migration, bucket, object, policy, user, or setting was created or changed.
- Free Plan status itself is **UNVERIFIED** because no plan/billing metadata tool is exposed in this session. It must be confirmed in project metadata/dashboard before implementation.

## 9. Canonical entity candidate table mapping

These are candidate mappings only, derived from the canonical Phase 011 model. They are not approved schema requirements and were not implemented.

| Canonical source | Candidate table/shape | Identity notes |
| --- | --- | --- |
| `SiteSnapshot.content.portfolio`, `profile` | `site_content` or section-specific content records | Portfolio is evidenced as hero/profile, not a project collection. Stable IDs for missing profile/portfolio records still need policy. |
| `about`, paragraphs | `about_sections`, `about_paragraphs` | Paragraph `id` is persistent; `order` is ordering only. |
| `education` | `education_sections` | Content owner is canonical; exact columns require product/schema approval. |
| `college.items` | `college_entries` | Entry ID and independent frame IDs are stable. |
| `shs.items` | `shs_entries` | Entry ID and independent frame IDs are stable; section anchor is `shs-section`. |
| `experience.items` | `experience_entries` | Entry ID and `frame_id` are stable; count is dynamic. |
| `certificate` cards | `certificates` plus child photo records/relations | One certificate is one card; certificate ID is required and `order` is not identity. |
| `contact` | `contact_sections` or contact content record | CTA href is currently empty/unset; do not invent a value. |
| `navigation` | `navigation_items` plus site/navigation owner | Keys/target section IDs are stable; exact persistence boundary is unresolved. |
| `visual` config | `site_visual_config` JSONB or normalized per-entity property rows | Phase 011 exposes only a mapped subset; 367 raw C/V candidates remain product decisions. |

## 10. Candidate relations

- `site`/section content owner → section-specific entities (one-to-many where collections exist).
- `about_section` → `about_paragraphs` (one-to-many, ordered).
- `college_entry` → frame/photo-area records (one-to-many, independent frame identities).
- `shs_entry` → frame/photo-area records (one-to-many, independent frame identities).
- `experience_entry` → one frame/media usage relation (one-to-one in the current canonical default shape).
- `certificate` → certificate photo children (thumbnail plus detail images).
- `media_asset` → many `media_usage` rows; usage identity is separate from physical asset identity.
- Candidate foreign keys and deletion rules are **Belum ditentukan** and require an approved database plan.

## 11. Candidate media/storage relations

Phase 011 canonical evidence supports:

- `media_assets`: physical asset identity, source/object reference, alt, MIME metadata.
- `media_usages`: semantic usage identity, owner/role, `media_asset_id`, object position.
- `photo_areas`: frame/photo-area identity for section-backed or certificate-backed editable areas.
- Storage object relation: candidate `media_assets.storage_object_id` or bucket/path fields. Exact shape is unresolved because no bucket exists and the application currently uses a static adapter/IndexedDB certificate adapter.
- One physical seed asset (`media-profile-primary`) may serve independent Portfolio/About/Contact usages; copy-on-write must preserve usage independence.
- Certificate media currently passes through IndexedDB and should not be assumed to be a Storage object until the media lifecycle is approved.

## 12. Risks/blockers

- Project name cannot be verified with the currently exposed MCP tools.
- Free Plan/paid-feature status cannot be verified with the currently exposed MCP tools.
- No dedicated Storage or Auth service audit tools are exposed; only read-only database evidence is available.
- `public.rls_auto_enable()` has two security advisor warnings requiring a later authorized review.
- No application schema or migration history exists, so relations, RLS policies, grants, and Data API exposure are still design work.
- The 009 final report file is absent; mapping relies on 010, 011, and canonical source files only.
- Phase 011 explicitly leaves 367 raw C/V candidates unresolved; database columns must not be generated for them automatically.
- Current `StaticSiteRepository` is process-local and `certificateRepository` is IndexedDB; neither is a remote persistence contract.

## 13. Final verdict

**BLOCKED**

Reason: the returned project ref does not match the expected ref, and exact project name and Free Plan status are not verifiable from the currently available MCP tools. Per the requested safety rule, stop and do not begin database implementation.
