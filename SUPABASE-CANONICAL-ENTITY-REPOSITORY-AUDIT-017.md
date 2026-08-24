# SUPABASE CANONICAL ENTITY / REPOSITORY AUDIT 017

Date: 2026-08-25 (Asia/Jakarta)  
Scope: six existing migrations, 17 live public tables, Phase 011 canonical model, and repository integration.  
Database mutation in this request: **none**.

## 1. Live baseline

The existing six migrations remain unchanged and the live project still has 17 public application tables. The six migration roles are:

1. `initial_schema`: tables, foreign keys, timestamps, triggers.
2. `rls_policies`: initial RLS and admin helper.
3. `indexes`: order/owner indexes.
4. `security_hardening`: fixed trigger search path.
5. `rls_policy_consolidation`: non-overlapping public/authenticated/admin policies.
6. `foreign_key_indexes`: media foreign-key indexes.

No table or migration was added in this request.

## 2. Table/column canonical audit

Notation: `G` = Guest consumer, `A` = Admin control, `R` = repository field, `Y/N` = consumed by the current runtime/adapter. `timestamps` means `created_at`/`updated_at`.

### `admin_memberships`

| Column | Canonical owner | G | A | R | Consumed | Key / issue |
| --- | --- | --- | --- | --- | --- | --- |
| `user_id` | Auth admin membership | None | Future admin authorization | `private.is_admin()` | Y | PK and FK `auth.users.id`; no hardcoded UUID. |
| `role` | Admin authorization | None | Future admin authorization | `private.is_admin()` | Y | Check constrained to `admin`. |
| `created_at`, `updated_at` | Admin membership metadata | None | None | None | N | Dead for current Guest/Admin UI; operational metadata only. |

Missing: an authenticated bootstrap flow creates the first membership. No current Admin control creates it.

### `portfolio_profile`

| Column | Canonical owner | G | A | R | Consumed | Key / issue |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `content.profile.id` | Profile identity | Profile selector | `profile.id` | Y | Stable text PK; compatible with `profile-lisa-natalia`. |
| `title` | `content.portfolio.title` | Portfolio hero title | Portfolio title | `portfolio.title` | Y | Correct type. |
| `name` | `content.profile.name` | Profile alt/name | Profile name/alt | `profile.name` | Y | Correct type. |
| `media_usage_id` | `content.profile.mediaUsageId` | Portfolio image resolution | Photo-area media | `profile.mediaUsageId` | Y | Logical reference only; no FK because semantic usage table is polymorphic. |
| `active` | Publication state | Adapter filters inactive | No current control | load filter | Y | Required for public visibility. |
| `created_at`, `updated_at` | Persistence metadata | None | None | None | N | Not Guest/Admin fields. |

Missing: no separate `portfolio_projects` is required; Phase 011 identifies this section as hero/profile.

### `about_sections`

| Column | Canonical owner | G | A | R | Consumed | Key / issue |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `content.about.id` | About owner | About entity | `about.id` | Y | Stable text PK. |
| `title` | `content.about.title` | About title | About title | `about.title` | Y | Correct. |
| `cta_id` | `content.about.cta.id` | Not rendered as value | CTA identity | `about.cta.id` | Partial | Identity retained, no visual consumer. |
| `cta_text` | `content.about.cta.text` | About CTA | CTA text | `about.cta.text` | Y | Correct. |
| `cta_target_section_id` | `content.about.cta.targetSectionId` | CTA navigation | CTA target | `about.cta.targetSectionId` | Y | Correct semantic string. |
| `active` | Publication state | Adapter filters | No direct control | load filter | Y | Correct non-visual state. |
| `created_at`, `updated_at` | Metadata | None | None | None | N | Operational only. |

### `about_paragraphs`

| Column | Canonical owner | G | A | R | Consumed | Key / issue |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `AboutParagraph.id` | Stable render key | Entity selector | `paragraph.id` | Y | Stable text PK. |
| `about_section_id` | Paragraph parent | Parent render | No direct control | paragraph parent filter | Y | FK to `about_sections.id`. |
| `body` | `AboutParagraph.body` | Paragraph text | Paragraph body | `paragraph.body` | Y | Correct. |
| `order_index` | `AboutParagraph.order` | Paragraph order | No current reorder control | `paragraph.order` | Y | Identity/order separated. |
| `active` | Publication state | Adapter filter | No direct control | paragraph filter | Y | Correct. |
| timestamps | Metadata | None | None | None | N | Operational only. |

### `education_sections`

| Column | Canonical owner | G | A | R | Consumed | Key / issue |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `content.education.id` | Education owner | Education title entity | `education.id` | Y | Stable text PK. |
| `title` | `content.education.title` | Education title | Education title | `education.title` | Y | Correct. |
| `active` | Publication state | Adapter filter | No direct control | load filter | Y | Correct. |
| timestamps | Metadata | None | None | None | N | Operational only. |

### `college_entries` and `shs_entries`

Both tables have the same column audit.

| Column | Canonical owner | G | A | R | Consumed | Key / issue |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `CollegeItem.id` / `SHSItem.id` | Stable render key | Entity selector | item.id | Y | Stable text PK; no array identity. |
| `school` | item.school | School text | School | item.school | Y | Correct. |
| `period` | item.period | Period text | Period | item.period | Y | Correct. |
| `description` | item.description | Description | Description | item.description | Y | Correct. |
| `order_index` | item.order | Collection order | No current reorder control | item.order | Y | Correct order/identity separation; indexes exist. |
| `active` | Publication state | Adapter filter | No direct control | load filter | Y | Correct. |
| timestamps | Metadata | None | None | None | N | Operational only. |

Missing columns: canonical `label` is exposed by the Admin registry/default item shape but is not a persisted table column; `frameIds.back/front` are also missing. The adapter preserves fallback frame IDs for known defaults and derives `${id}-frame-back/front` for new rows. This is a compatibility fallback, not a database identity guarantee. Guest currently consumes school/period/description and frame IDs through photo-area state; Admin exposes label and content but no frame-ID control.

### `experiences`

| Column | Canonical owner | G | A | R | Consumed | Key / issue |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | ExperienceItem.id | Stable item key | Experience selector | item.id | Y | Stable text PK. |
| `title` | item.title | Title | Title | item.title | Y | Correct. |
| `date` | item.date | Date | Date | item.date | Y | Canonical field is `date`, not a separate period/company model. |
| `description` | item.description | Description | Description | item.description | Y | Correct. |
| `frame_id` | item.frameId | Frame relation | Frame target | item.frameId | Y | Stable relation field; no hardcoded four-table design. |
| `order_index` | item.order | Scroll/order | No current reorder control | item.order | Y | Correct. |
| `active` | Publication state | Adapter filter | No direct control | load filter | Y | Correct. |
| timestamps | Metadata | None | None | None | N | Operational only. |

### `certificate_sections`

| Column | Canonical owner | G | A | R | Consumed | Key / issue |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `content.certificate.id` | Certificate section owner | Section title entity | certificate section id | Y | Stable text PK. |
| `title` | Certificate section title | Section title | Section title | site store title | Y | Correct. |
| `active` | Publication state | Not currently filtered in certificate section | No control | Not mapped to certificate store | Partial | Adapter can use it; CertificateSection currently reads canonical store title. |
| timestamps | Metadata | None | None | None | N | Operational only. |

### `certificates`

| Column | Canonical owner | G | A | R | Consumed | Key / issue |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | CertificateCard.id | Stable card key | Certificate selector | certificate store | Y | Stable text PK; preserves `cert-a`/`cert-b`. |
| `title` | card.title | Card title | Card title | certificate store | Y | Correct. |
| `date` | card.date | Card date | Card date | certificate store | Y | Correct. |
| `description` | card.description | Card description | Card description | certificate store | Y | Correct. |
| `order_index` | card.order | Card order | No current reorder control | certificate store | Y | Correct. |
| `active` | card.active | Display filtering | No current direct control | certificate store | Y | Correct. |
| timestamps | Metadata | None | None | None | N | Operational only. |

No `issuer` column is missing relative to Phase 011: the canonical `CertificateCard` has no issuer field.

### `certificate_images`

| Column | Canonical owner | G | A | R | Consumed | Key / issue |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | CertificatePhotoArea.id | Image/frame key | Photo-area selector | certificate store | Y | Persistent text PK; no index-derived IDs. |
| `certificate_id` | Card parent | Card relation | Card ownership | certificate store | Y | FK to `certificates.id`. |
| `role` | thumbnail/detail | Image layout role | Photo-area role | certificate store | Y | Check constrained. |
| `order_index` | Detail order | Detail order | No current reorder control | certificate store | Y | Identity separated from order. |
| `media_asset_id` | Physical media relation | Image source | Media target | certificate store | Y | FK to `media_assets.id`; indexed. |
| `object_position` | image.objectPosition | Image crop | Photo-area control | certificate store | Y | Correct string representation. |
| `placeholder_config` | image.placeholder | Empty-state placeholder | Placeholder-related UI | certificate store | Partial | Current Guest maps values; Admin does not expose all placeholder fields. |
| timestamps | Metadata | None | None | None | N | Operational only. |

### `contact_profiles`

| Column | Canonical owner | G | A | R | Consumed | Key / issue |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `content.contact.id` | Contact owner | Contact entity | contact.id | Y | Stable text PK. |
| `line1`, `line2` | Contact lines | Contact text | Contact text | contact lines | Y | Correct. |
| `cta_id` | contact CTA identity | Not rendered value | CTA identity | contact CTA id | Partial | Identity retained, no standalone Guest value. |
| `cta_text` | CTA text | CTA | CTA text | contact.cta.text | Y | Correct. |
| `cta_href` | CTA href | Link target | CTA href | contact.cta.href | Y | Nullable as required; no fake email. |
| `person_media_usage_id` | Contact media usage | Person image | Photo target | contact.personMediaUsageId | Y | Polymorphic semantic relation; no FK by design. |
| `active` | Publication state | Adapter filters | No direct control | load filter | Y | Correct. |
| timestamps | Metadata | None | None | None | N | Operational only. |

### `navigation_items`

| Column | Canonical owner | G | A | R | Consumed | Key / issue |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | NavItem.id | Stable key | Nav selector | item.id | Y | Stable text PK. |
| `item_key` | NavItem.key | Navigation identity | Not currently controlled | item.key | Y | Unique. |
| `label` | NavItem.label | Nav label | Nav label | item.label | Y | Correct. |
| `target_section_id` | NavItem.targetSectionId | Anchor target | Target section | item.targetSectionId | Y | Correct. |
| `offset_mode` | NavItem.offsetMode | Scroll behavior | Not currently controlled | item.offsetMode | Y | Correct check constraint. |
| `offset_value` | NavItem.offset | Scroll offset | Not currently controlled | item.offset | Y | Renamed from reserved SQL `offset`; adapter maps it explicitly. |
| `order_index` | Navigation order | Nav order | Not currently controlled | sorted item order | Y | Correct; adapter sorts before mapping. |
| `visible` | Visibility | Adapter filters | Not currently controlled | load filter | Y | Correct. |
| timestamps | Metadata | None | None | None | N | Operational only. |

Missing: canonical `navigation.brand`, `sections[].label`, `menuKey`, and `darkBg` have no columns. Adapter preserves default values, so those values are not remotely editable/persisted.

### `media_assets`

| Column | Canonical owner | G | A | R | Consumed | Key / issue |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | MediaAsset.id | Asset identity | Media selector | media asset ID | Y | Stable text PK. |
| `storage_bucket`, `storage_path` | Storage relation | URL derivation | Media upload metadata | source resolver | Y | Bucket remains uncreated in prior phase. |
| `mime_type` | MediaAsset.mimeType | Browser/media type | Media validation | asset.mimeType | Y | Correct. |
| `file_size`, `width`, `height` | Storage metadata | Not rendered | Not currently controlled | Generated metadata only | N | Dead in current Guest/Admin runtime; useful future constraints. |
| `alt_text` | MediaAsset.alt | Image alt | Profile/media label | asset.alt | Y | Correct. |
| `source_url` | Runtime source | Image source | Source resolver | asset.source | Y | Current adapter prefers it. |
| timestamps | Metadata | None | None | None | N | Operational only. |

### `entity_media`

| Column | Canonical owner | G | A | R | Consumed | Key / issue |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | MediaUsage.id | Semantic usage identity | Photo-area selector | usage.id | Y | Stable text PK. |
| `owner_type`, `owner_id` | Media usage owner | Owner relation | Usage target | owner metadata | Partial | Runtime `MediaUsage` has ownerId but no ownerType; adapter currently infers owner type from usage ID when saving. |
| `role` | MediaUsage.role | Usage role | Usage label | usage.role | Y | Correct. |
| `media_asset_id` | Physical asset relation | Source lookup | Copy-on-write target | usage.mediaAssetId | Y | FK to `media_assets.id`. |
| `object_position` | MediaUsage.objectPosition | Crop | Object position | usage.objectPosition | Y | Correct. |
| timestamps | Metadata | None | None | None | N | Operational only. |

### `photo_frames`

| Column | Canonical owner | G | A | R | Consumed | Key / issue |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | PhotoAreaEntity.id/frame ID | Frame identity | Frame selector | area.id | Y | Stable text PK; dynamic IDs supported. |
| `owner_type`, `owner_id` | Frame owner | Frame relation | Frame target | area owner metadata | Y | Correct polymorphic relation. |
| `role` | Frame role | Frame role | Frame identity | area.role | Y | Correct. |
| `media_asset_id` | Frame media | Frame source | Upload target | area.source lookup | Y | FK and index present. |
| `visual_config` | Editable frame config | `objectPosition` only currently | Frame layout/appearance | partial frame mapping | Partial | Other config keys are not consumed by the current PhotoArea renderer. |
| `placeholder_config` | Frame placeholder | Not mapped into `PhotoAreaEntity` | Not exposed by current registry | Not currently mapped | N | Dead for current runtime; schema preserves future placeholder metadata. |
| timestamps | Metadata | None | None | None | N | Operational only. |

Missing: canonical `section`, `label`, `object_position`, and `persistence` are not columns. The adapter derives section/label and uses fallback/default object position; it cannot reconstruct arbitrary persisted values exactly.

### `entity_visual_configs`

| Column | Canonical owner | G | A | R | Consumed | Key / issue |
| --- | --- | --- | --- | --- | --- | --- |
| `entity_type`, `entity_id` | Visual config owner | Indirect renderer owner | Admin entity config | visual config key | Y | Composite PK; stable identity. |
| `config` | Mapped editable visual subset | Renderer config | Admin visual controls | section visual merge | Partial | Adapter persists only known mapped fields; broad structural CSS is intentionally excluded. |
| timestamps | Metadata | None | None | None | N | Operational only. |

## 3. Missing canonical fields

The existing 17-table schema does not contain:

- College/SHS `label` and persistent `frameIds` columns.
- Photo frame `section`, `label`, explicit `object_position`, and `persistence` columns.
- Navigation brand and navigation section metadata (`menuKey`, `darkBg`).
- Certificate autoplay/interval persistence. These are currently behavior settings, not part of the existing database tables.
- A storage upload/object lifecycle field beyond bucket/path metadata.

These are documented gaps. No new table was created blindly and no database was changed.

## 4. Dead or partially consumed fields

- All `created_at`/`updated_at` fields are operational and not rendered or controlled.
- Media dimensions/file size are stored metadata but not consumed by current Guest/Admin.
- `photo_frames.placeholder_config` is currently not projected into `PhotoAreaEntity`.
- Navigation brand/section fields are not represented in the schema and therefore remain fallback-only.
- Certificate section `active` is stored, but the current certificate title path does not use it as a visibility gate.

These are not automatically removed because they are legitimate persistence metadata or future-compatible fields, and removal would be a schema mutation outside this request.

## 5. Type, identity, ordering, and source-of-truth findings

- Database text IDs match the Phase 011 stable string-ID contract. UUIDs are used only for Auth membership because that is the `auth.users` identity type.
- `navigation.offset` required the database name `offset_value`; the adapter maps it back to the canonical `offset` field.
- `order_index` is separate from all primary keys and is sorted by the adapter for About, College, SHS, Experience, Certificate, Certificate images, and Navigation.
- College/SHS frame IDs are not persisted; known defaults use fallback IDs and new records derive deterministic IDs. This is the principal identity gap.
- `entity_media.owner_type` is persisted but the current `MediaUsage` type lacks that field; adapter save currently infers it from semantic usage IDs. This is duplicate source-of-truth risk.
- `photo_frames.visual_config` and the existing default visual config both can describe frame appearance. The adapter now applies only persisted mapped fields over defaults; CSS structural constants remain code-owned.
- Certificate data has one Supabase repository path when configured; IndexedDB remains only the no-environment fallback. Guest/Admin do not query Supabase directly.

## 6. Repository integration

Implemented locally:

- `src/lib/supabaseRest.ts`: project-configured REST boundary, publishable key, optional access token, read/upsert helpers.
- `src/repositories/supabaseSiteRepository.ts`: canonical snapshot load/save mapping for content, media, frames, and mapped visual config.
- `src/repositories/siteRepository.ts`: selects Supabase adapter when environment variables exist, otherwise static fallback.
- `src/repositories/certificateRepository.ts`: selects Supabase certificate/image adapter when configured, otherwise IndexedDB fallback.
- `src/main.ts`: triggers `useSiteStore().load()` at application bootstrap; Vue components remain query-free.
- `.env.example`: placeholder Supabase URL/publishable key.

Runtime flow is now:

`Guest/Admin → Pinia canonical store → repository adapter → Supabase REST`

## 7. Hard-refresh verification

The adapter and bootstrap path are implemented, but a real hard-refresh test could not be executed in this environment because Node/npm and a running browser/dev server are unavailable. The live database currently has zero application rows, so there is no persisted content row that can be compared against Guest output without creating test data (not authorized in this audit/integration request).

## 8. Final status

- Database was not modified in this request.
- Existing 17-table architecture was preserved.
- Canonical audit completed with column-level gaps documented.
- Repository adapter implementation completed locally.
- Hard-refresh/live persisted-data verification: **Belum dilakukan** due unavailable runtime and empty live dataset.

Final verdict: **PARTIAL — adapter implemented; runtime persistence verification pending.**

