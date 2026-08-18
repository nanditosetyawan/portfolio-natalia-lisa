# PHASE ENTITY-ADMIN-SOURCE-OF-TRUTH-REMEDIATION-011 FINAL REPORT

Date: 2026-08-19 (Asia/Jakarta)  
Execution mode: implementation/remediation, local application architecture only  
Final status: **READY WITH LIMITED REMEDIATION**

No remote database, Supabase client, SQL migration, authentication, storage bucket, or backend provider was created. The repository did not contain `md/` or `design/`; therefore specification/design-image comparison was **Tidak ditemukan dalam specification** / unavailable. Visual preservation was assessed against the existing runtime and preservation harnesses.

## 1. Problems addressed from Audit #009/#010

| Audit problem | Remediation | Result |
| --- | --- | --- |
| Guest imported independent defaults directly | Added one seed snapshot and Pinia runtime owner; Guest sections consume the canonical store | PASS |
| About paragraphs depended on position | Paragraphs now have `id`, `order`, `body` and render with `v-for`/stable key | PASS |
| College and SHS used `items[0]` | Both render the ordered complete collection | PASS |
| SHS/navigation anchor mismatch | Canonical `targetSectionId` and `shs-section`/`college-section` anchors | PASS |
| Experience assumed four frame IDs and `400vh` | Frame IDs are strings, missing frame configs are generated per entity, and budget is `max(1,count) * 100vh` | PASS |
| Certificate Admin discovery used a fixed registry | Runtime registry merges semantic usages, entity-backed frames, and every editable Certificate photo area | PASS |
| Certificate IDs could be index-derived/collide with fallback | Normalization requires persistent record IDs; child IDs are deterministic from that stable ID; combined namespace is validated | PASS |
| Certificate had two image sources | Guest and Admin now use the normalized Certificate entity/repository shape; the old Pinia override is a compatibility proxy only | PASS |
| `gambar1.webp` acted as three semantic identities | One physical `media-profile-primary` asset has three independent usage records | PASS |
| Shared physical media caused potential coupled edits | Admin mutation uses copy-on-write: editing one usage creates/repoints a usage asset and leaves the other usages intact | PASS |
| Admin Edit was a shell | Replaced with section/entity/property discovery, schema-driven controls, canonical mutations, live Guest preview, media editor, and repository draft action | PASS for mapped subset |
| CSS `!important` competed with editable values | Removed 34 conflicting responsive rules; responsive values now come from viewport-aware config/renderer bindings where migrated | PASS for mapped subset |
| Placeholder contact email existed as content | Canonical Contact href is empty until supplied; duplicate dead visual CTA content was removed | PASS |
| Legacy dead transition configuration | Unconsumed Certificate transition config was removed after a full consumer search | PASS |

## 2. Files changed

New files:

- `PHASE-ENTITY-ADMIN-SOURCE-OF-TRUTH-REMEDIATION-011-TODO.md`
- `PHASE-ENTITY-ADMIN-SOURCE-OF-TRUTH-REMEDIATION-011-FINAL-REPORT.md`
- `src/types/site.ts`
- `src/data/default/site.ts`
- `src/repositories/siteRepository.ts`
- `src/stores/site.ts`
- `src/composables/useAdminEntityRegistry.ts`
- `src/composables/usePhotoAreaRegistry.ts`
- `tests/entity-admin-source-runtime.mjs`
- `tests/responsive-visual-runtime.mjs`

Modified production files:

- `src/components/EducationGlobal.vue`
- `src/components/GuestNavbar.vue`
- `src/data/default/about.ts`
- `src/data/default/college.ts`
- `src/data/default/contact.ts`
- `src/data/default/education.ts`
- `src/data/default/experience.ts`
- `src/data/default/navigation.ts`
- `src/data/default/photoAreas.ts`
- `src/data/default/portfolio.ts`
- `src/data/default/profile.ts`
- `src/data/default/shs.ts`
- `src/data/default/visual/about.ts`
- `src/data/default/visual/certificate.ts`
- `src/data/default/visual/contact.ts`
- `src/data/default/visual/experience.ts`
- `src/pages/admin/AdminEdit.vue`
- `src/router/index.ts`
- `src/sections/about/AboutSection.vue`
- `src/sections/certificate/CertificateSection.vue`
- `src/sections/contact/ContactSection.vue`
- `src/sections/education/EducationSection.vue`
- `src/sections/education/college/CollegeSection.vue`
- `src/sections/education/shs/SHSSection.vue`
- `src/sections/experience/ExperienceSection.vue`
- `src/sections/portfolio/PortfolioSection.vue`
- `src/stores/certificates.ts`
- `src/stores/photoAreaImages.ts`

Modified tests:

- `tests/certificate-data-runtime.mjs`
- `tests/frame-image-preservation.mjs`
- `tests/frame-image-runtime.mjs`

`PROJECT-IMPLEMENTATION-LOG.md` is updated by this phase as required by project convention. No protected `AGENTS.md`, `md/**`, or `design/**` source was changed.

## 3. Canonical entity model

```text
SiteSnapshot
├─ content
│  ├─ portfolio-hero
│  ├─ profile-primary
│  ├─ about
│  │  ├─ about-paragraph-1 / about-paragraph-2
│  │  └─ about-cta
│  ├─ education-section
│  ├─ college-entry-* → college frame IDs
│  ├─ shs-entry-* → SHS frame IDs
│  ├─ experience-section
│  │  └─ klinik-* → experience-frame-klinik-*
│  ├─ certificate-section
│  │  └─ certificate ID → thumbnail/detail photo IDs
│  ├─ contact → contact-cta
│  └─ navigation-main/about/activity/contact
├─ visual (section-scoped config)
├─ behavior (persistent behavior only)
├─ mediaAssets
├─ mediaUsages
└─ photoAreas
```

Ordering is a field; it is never identity. Dynamic entities, frames, media usages, photo areas, and navigation items all use stable string IDs. Default values are seed/fallback data, not separate Guest authority.

The Portfolio evidence is a hero/profile, not a project collection. No invented `PortfolioProject` domain or unsupported project fields were added.

## 4. Guest renderer changes

- **Portfolio:** reads `portfolio` and `profile` from the site store; image is resolved through `portfolio-profile-media`.
- **About:** canonical owner, stable paragraph loop, canonical CTA, two protected independent PhotoAreas, and reactive `about-foreground-portrait` usage.
- **Education:** title reads the same canonical content owner.
- **College:** ordered `v-for` renders 0/1/2/5 entries with stable entity/frame IDs.
- **SHS:** ordered `v-for`, stable IDs, and canonical `shs-section` anchor.
- **Experience:** arbitrary count, dynamic frame relation, derived scroll budget, preserved special scroll and line/dot.
- **Certificate:** arbitrary database count, initial-two business rule, normalized persistent media IDs, one image source.
- **Contact:** canonical lines/CTA, empty unset href, and `contact-person-media` usage.

No renderer under these sections imports a default content object as its editable runtime authority.

## 5. Admin architecture

```text
selected section
  → selected entity ID
    → metadata property descriptor
      → read/write canonical store or Certificate repository
        → same reactive property consumed by Guest preview
```

Property groups are Content, Typography, Layout, Appearance, Media, and Behavior. Admin Edit has no decorative shell controls counted as functional. Certificate content writes through its repository adapter. Media discovery is entity-backed and includes runtime Certificate records automatically; no `startsWith('cert-')` routing exists.

Semantic usage edits are isolated with copy-on-write. Seed Portfolio/About/Contact can share one physical asset, while a later edit can repoint only the selected usage.

## 6. Property coverage

Audit #010 baseline and post-remediation runtime census:

| Metric | Before | After |
| --- | ---: | ---: |
| Guest C/V candidates | 492 | 492 (visual inventory preserved) |
| Admin mapped property instances | 17 | 125 |
| Strict schema-traced mappings | 10 PASS + 7 PARTIAL | 125 PASS |
| Scalar descriptors | not canonical | 85 |
| Media descriptors | fixed/static | 40 across 20 default runtime targets |
| Shell controls | 28 | 0 in Admin Edit |
| Raw C/V candidates not exposed | 475 | 367 |

The 125 is not an artificial claim of complete 492/492 coverage. It comprises 85 property descriptors plus source/object-position for 20 runtime media targets. The runtime Certificate test additionally proved that a newly loaded database-shaped certificate contributes its own thumbnail/details without a code-list change.

The remaining 367 raw candidates include structural layout, decorative/system values, responsive composition values not approved for persistence, and editable-looking legacy visual values that still need a product-level decision. They are deliberately not mass-exposed merely to increase the count. Representative runtime mutation proof covered 15 values/classes: title, font size, font family, color, x, y, width, height, rotation, background, radius, shadow, image, object position, and autoplay.

## 7. Source-of-truth changes

- Seed data → repository fallback → canonical runtime snapshot → Guest/Admin.
- Static sections no longer bypass the runtime store.
- Certificate Guest/Admin share normalized Certificate cards; IndexedDB is only the adapter.
- PhotoArea compatibility store forwards to the canonical site store.
- About responsive frame values moved from competing CSS literals into explicit desktop/tablet/mobile config consumption.
- Experience frame rotation uses a renderer-owned CSS variable; mobile layout uses explicit renderer state rather than `!important` competition.
- Contact text/href duplicate values were removed from visual config.
- Unused Certificate transition config was removed after finding zero consumers.

Remaining `!important` uses are structural: Certificate collapsed transition state and Admin sidebar layout. They do not override a mapped editable property.

## 8. Identity changes

Before: array position, fixed list membership, filename, or fallback slot could implicitly identify records.  
After: entity IDs are persistent; `order` controls only ordering; frame/photo IDs are stored child identities; semantic media usages are separate from physical assets.

Default identities retained where already safe: `cert-a`, `cert-b`, their child photo IDs, `klinik-1..4`, and `experience-frame-klinik-1..4`. Dynamic database records must supply an ID. Combined default/database photo namespaces are checked for collision before rendering.

## 9. Certificate changes

- Normalizer rejects missing/duplicate entity IDs and duplicate child photo IDs.
- Child fallback IDs derive from stable certificate ID and role, never array position.
- `editableCards` exposes all database cards plus required fallback cards to Admin discovery even when Guest initially displays two.
- DB 0 → two defaults; DB 1 → one DB + one fallback; DB 2 → two DB; DB 5 → first two, then all after refresh.
- Reorder preserves thumbnail/detail IDs.
- Replace and remove image persist through the local repository adapter.
- UI-only `showAll`, loading, error, current slide, and timer remain outside entity content.

## 10. Experience changes

`experienceScrollBudgetVh = max(1, entityCount) × 100`. Runtime proof:

| Count | Cards | Budget | Rendered height at 804px |
| ---: | ---: | ---: | ---: |
| 1 | 1 | 100vh | 804px |
| 4 | 4 | 400vh | 3216px |
| 7 | 7 | 700vh | 5628px |
| 20 | 20 | 2000vh | 16080px |

The default four-item appearance, card movement, center line, center dot, and special-scroll behavior remain intact. The line/dot and Certificate card dimensions/positions remain the four explicit allowed hardcodes.

## 11. CSS/config changes

- Removed 34 `!important` declarations that overrode responsive About/Experience values.
- Added viewport-aware About frame config and bound it through Vue styles.
- Repaired mobile Experience selector specificity without changing desktop card geometry.
- Removed the dead fixed `desktopHeight: 400vh` config.
- Kept responsive layout technique, decorative SVG/CSS, breakpoints, Certificate card geometry, and Experience line/dot as structural/allowed constants.
- Router Admin pages are lazy-loaded, preserving Guest bundle separation.

## 12. TODO update

The complete verification checklist is in `PHASE-ENTITY-ADMIN-SOURCE-OF-TRUTH-REMEDIATION-011-TODO.md`. All phase tasks are checked only after their relevant source/runtime validation. Deferred backend/provider work and coverage limitations are listed separately, not marked as completed backend work.

## 13. Runtime tests

- Desktop 1422×804: PASS; eight sections captured; no document overflow, duplicate photo IDs, or runtime errors.
- Tablet 1024×768: PASS; same checks.
- Mobile 390×844: PASS for runtime safety/no document overflow; known compact-composition limitations remain and are not silently redesigned without design evidence.
- About paragraph cardinality: 0/1/2/3 PASS.
- College and SHS cardinality: 0/1/2/5 PASS.
- Experience cardinality: 1/4/7/20 PASS.
- Certificate DB scenarios: 0/1/2/5, refresh, hard reload, loading/error fallback, collision, reorder, dynamic discovery, replace, and remove PASS.

## 14. Mutation/isolation tests

Actual Admin → state → Guest tests passed for Content, Typography, Layout, Appearance, Media, and approved Behavior fields. About/College/SHS/Experience sibling mutation isolation returned `[true,true,true,true]`.

The 17 protected default frame/photo areas remained unique and independent across six source ratios. Semantic media test proved:

```text
Portfolio usage → media-profile-primary
About edit      → about-foreground-portrait-asset
Contact usage   → media-profile-primary
```

Thus editing About did not mutate Portfolio or Contact.

## 15. Preservation tests

- 17 default PhotoAreas: unique 17/17; placeholder switching PASS.
- Intrinsic ratio/no-upscale/clipping/whitespace behavior: PASS for 1000×1000, 1600×900, 900×1600, 2000×500, 100×100, and 100×50.
- Responsive frame fixtures at tablet/mobile: PASS, zero horizontal document overflow.
- Navbar anchor navigation, reduced motion, touch/native scroll, hard refresh, and Lenis root: PASS.
- Experience special scroll changed cards and dot as expected while section height stayed 3216px for four defaults.
- Runtime exceptions and console errors: 0.

Visual comparison to original design images could not be claimed because `design/` does not exist in this repository. Runtime screenshots were inspected and no unintended frame-system redesign was observed.

## 16. Validation

| Validation | Result |
| --- | --- |
| `npx vue-tsc --noEmit` | PASS |
| `npm run build` | PASS (1,844 modules) |
| `tests/entity-admin-source-runtime.mjs` | PASS |
| `tests/certificate-data-runtime.mjs` | PASS |
| `tests/frame-image-runtime.mjs` | PASS |
| `tests/frame-image-preservation.mjs` | PASS |
| `tests/responsive-visual-runtime.mjs` | PASS |
| Console/runtime errors | 0 |
| Horizontal document overflow | false at all required viewports |
| Duplicate runtime entity/photo IDs | 0 |
| `git diff --check` | PASS |

## 17. Database readiness

**READY WITH LIMITED REMEDIATION**

The database phase can begin at the repository-adapter boundary because stable identities, normalized runtime state, Guest/Admin shared property ownership, media relations, and Certificate persistence boundaries now exist.

Limits to carry into the database architecture phase:

1. Do not treat the 367 deliberately unexposed raw C/V candidates as approved database columns; classify them with product/design evidence first.
2. Replace `StaticSiteRepository` with a selected backend adapter only after a separate provider/schema decision.
3. Map content entities relationally; keep responsive visual sub-config as scoped JSON only where independent querying is unnecessary.
4. Preserve `media_assets` and `entity_media_usages` as separate relations so physical deduplication does not merge semantic ownership.
5. Certificate IndexedDB must remain a development/local adapter, not coexist as a second production truth after backend adoption.

## 18. Known limitations

- There is no remote persistence. Non-Certificate draft save is in-memory for the current repository instance.
- There is no authentication, authorization, publishing workflow, versioning, upload service, or storage lifecycle.
- Admin coverage is 125 evidence-backed property instances under the default dataset, not full raw Audit #010 coverage.
- Responsive screenshot tests prove safety and preservation, not pixel-perfect agreement with unavailable design references.
- Some legacy visual config remains broad; only proven dead or conflicting fields were removed. Further cleanup must remain consumer-driven.
- Default Portfolio is correctly modeled as hero/profile because no project collection exists in current Guest evidence.

## Exact source evidence

- Canonical seed/media relations: `src/data/default/site.ts:25-90`
- Canonical types: `src/types/site.ts:1-57`
- Repository contract/static adapter: `src/repositories/siteRepository.ts:10-27`
- Runtime store, derived count, collection replacement, media copy-on-write: `src/stores/site.ts:14-123`
- Dynamic Admin schema: `src/composables/useAdminEntityRegistry.ts:50-178`
- Dynamic media registry: `src/composables/usePhotoAreaRegistry.ts:6-65`
- Functional Admin UI: `src/pages/admin/AdminEdit.vue:11-130`
- About stable paragraph rendering: `src/sections/about/AboutSection.vue:76-82`
- College collection rendering: `src/sections/education/college/CollegeSection.vue:16-20`
- SHS collection/anchor: `src/sections/education/shs/SHSSection.vue:16-20`
- Experience derived height/rendering: `src/sections/experience/ExperienceSection.vue:14,115-124,210-232,311-313`
- Certificate normalization/display/update boundary: `src/stores/certificates.ts:22-235`
- Canonical navigation consumption: `src/components/GuestNavbar.vue:276-292,369`
- Runtime census/mutation/isolation: `tests/entity-admin-source-runtime.mjs`
- Certificate behavior/collision tests: `tests/certificate-data-runtime.mjs`
- Frame preservation: `tests/frame-image-runtime.mjs`, `tests/frame-image-preservation.mjs`
- Responsive screenshots/overflow/error checks: `tests/responsive-visual-runtime.mjs`
