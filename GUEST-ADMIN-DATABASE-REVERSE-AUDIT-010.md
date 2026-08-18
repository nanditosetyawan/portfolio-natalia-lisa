# GUEST-ADMIN-DATABASE-REVERSE-AUDIT-010 FINAL REPORT

Audit date: 2026-08-18 (Asia/Jakarta)

Mode: reverse audit, production source read-only

Scope: Guest, Admin, current runtime state/config/store/repository, and candidate backend model

Production files changed: none
Reference limitation: the current repository has no `md/` or `design/` directory. `Tidak ditemukan dalam specification.` `Tidak dapat dipastikan dari gambar.`

## 1. Executive verdict

**Final verdict: CRITICAL BLOCKED.**

The Guest is a largely static/config-driven renderer; the Admin is not its inverse. The Guest consumes 572 distinct visual-config leaf paths, 85 content/media persistence candidates, and many CSS/TS constants. The Admin exposes 30 runtime inputs/selects, but 28 are unbound shells. The only real Guest-facing mapping is the photo-area source path for 17 fixed IDs. Ten non-Certificate targets are functional but session-only; seven default Certificate targets are persistent to local IndexedDB but only **PARTIAL** under fast/sequential runtime mutation because completion is not observable and later operations can be measured while the previous async write is still settling.

Counting only properties classified C or V that have a concrete Guest consumer and are reasonable persistence candidates, this audit identifies **492 Guest-editable property instances**. Exactly **17** have an Admin target/binding, of which **10 PASS** strict runtime isolation and **7 PARTIAL**. Therefore **475 have no Admin control at all**. There are **28 Admin shell inputs with no Guest consumer**. There are **24 distinct config paths (30 entity-property instances)** with explicit `!important` source-of-truth competition. Functional coverage is not 1:1.

Database tables and columns can be proposed from evidence, but remote database implementation should not begin before identity, editor binding, dynamic media discovery, source-of-truth, and persistence boundaries are refactored. Current Certificate IndexedDB is a useful repository prototype, not the planned multi-device backend.

Runtime evidence:

- Guest inspected at 1422x804, 1024x768, and 390x844.
- All eight sections rendered and no document-level horizontal overflow was reported.
- Desktop section heights included Experience 3216 px = 400vh at 804 px; tablet 3072 px = 400vh at 768 px.
- Mobile screenshots show content clipping rather than document overflow: Portfolio/Education headings are clipped and Contact text is not in the captured top viewport. With no design reference, whether that composition is intended cannot be asserted.
- Empty baseline: 17 unique photo areas when both Certificate cards are expanded; 12 are mounted while Certificate details are collapsed.
- Runtime errors in the clean collector: zero.
- The existing 102-upload matrix passed geometry, ratio, no-upscale, SPA state, responsive, and no-overflow checks, but failed its isolation assertion for sequential Certificate operations.

## 2. Section inventory

| Order | Section | Guest root | Render/data source | Visual source | Admin coverage | Persistence |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Portfolio | `#main` | `defaultPortfolioContent`, `defaultProfile` | `defaultPortfolioConfig` + scoped CSS | None | None |
| 2 | About | `#about` | `defaultAbout`, photo-area Pinia | `defaultAboutConfig` + scoped CSS | 2 image sources | Session only |
| 3 | Education | `#education` | `defaultEducation` | `defaultEducationConfig`, magnet TS | None | None |
| 4 | College | `#college` | `defaultCollege.items[0]`, photo-area Pinia | `defaultCollegeConfig` + scoped CSS | 2 image sources | Session only |
| 5 | SHS | `.shs-section` (no DOM id) | `defaultSHS.items[0]`, photo-area Pinia | `defaultSHSConfig` + scoped CSS | 2 image sources | Session only |
| 6 | Experience | `#experience` | `defaultExperience.items`, photo-area Pinia | `defaultExperienceConfig` + RAF/CSS | 4 image sources | Session only |
| 7 | Certificate | `#certificate` | Certificate Pinia + defaults + IndexedDB | `defaultCertificateConfig` + large CSS literal layer | 7 fixed default image sources, PARTIAL | IndexedDB local browser |
| 8 | Contact | `#contact` | `defaultContact` | `defaultContactConfig` + scoped CSS | None | None |
| shared | Navbar | `.guest-navbar` | `defaultNavigation` | `defaultNavbarConfig` + stateful CSS | None | None |
| shared | Photo renderer | `[data-photo-area-id]` | `PhotoArea` props/store | intrinsic ratio calculation + CSS | Via 17-ID registry | Split session/IndexedDB |

## 3. Guest entity inventory

The candidate entity count is **42 logical records/children**, not a count of every decorative DOM node:

| Area | Candidate logical entities | Count | Identity state |
| --- | --- | ---: | --- |
| Portfolio | portfolio content, profile, profile media usage | 3 | Missing persistent IDs |
| About | about content, 2 paragraphs, 2 frames, foreground portrait | 6 | Only frame IDs stable |
| Education | education header/content | 1 | Section anchor only |
| College | college item, back frame, front frame | 3 | Stable item/frame IDs |
| SHS | SHS item, back frame, front frame | 3 | Stable item/frame IDs; root DOM id missing |
| Experience | section content, 4 items, 4 frame/media slots | 9 | Stable item/frame IDs |
| Certificate | section content, 2 cards, 7 photo areas | 10 | Stable default IDs; dynamic DB IDs normalized |
| Contact | contact content, person/profile media usage | 2 | Missing persistent IDs |
| Navigation | brand/config record, 4 nav items | 5 | Keys stable, no DB records |
| **Total** |  | **42** | 17 leaf photo entities are Admin-targetable |

Decorative SVGs, rings, dots, tape, blobs, placeholder labels, and navbar runtime state are not counted as business entities.

## 4. Guest editable property inventory

Counting rule: one property at one logical owner is one instance. C and V are counted because they have a concrete Guest consumer and are plausible persisted/editor properties. S/H/U/D are inventoried but excluded from the 492 figure. B is listed separately because no available specification authorizes exposing system motion parameters in Admin.

| Section | C/media | V | C+V total | Main groups |
| --- | ---: | ---: | ---: | --- |
| Portfolio | 2 | 30 | 32 | title, profile source, title typography, profile geometry, section background, scroll arrow |
| About | 7 | 57 | 64 | title, 2 paragraphs, CTA literal/data gap, 2 frame sources/geometries/placeholders, portrait, typography |
| Education | 1 | 15 | 16 | title, title typography/offset, section background, icon, scroll indicator |
| College | 6 | 53 | 59 | 4 item fields, 2 image sources, four text groups, two frames/placeholders |
| SHS | 6 | 56 | 62 | 4 item fields, 2 image sources, four text groups, two frames/placeholders |
| Experience | 17 | 94 | 111 | section title, 4 x title/date/description/source, shared typography, 4 x 18 frame/image/placeholder fields |
| Certificate | 32 | 50 | 82 | section/card text, order/active, 7 sources, 7 object positions, 7 x placeholder fields, title/info visual config |
| Contact | 5 | 37 | 42 | two lines, CTA text/href, image source, title/CTA/image visual properties |
| Navbar | 9 | 15 | 24 | brand, 4 labels/targets, brand/link typography and colors |
| **Total** | **85** | **407** | **492** |  |

The 572 consumed visual-config leaf paths are broader than the 407 V count because the former includes S and D. Mechanical consumed-leaf census: Portfolio 81, About 110, Education 20, College 65, SHS 80, Experience 50 direct paths plus 72 per-frame nested instances, Certificate 101, Contact 50, Navbar 15. Experience nested `imageFrames[frameId]` fields are counted per entity in the 492 property census.

Behavior inventory, excluded from the C+V total:

- Navbar active-section detection, velocity hide/show, Lenis navigation, mobile behavior: B/S.
- Education/College bidirectional magnet thresholds, resistance curve, throw duration/easing, cancellation/re-arm, touch and reduced-motion bypass: B.
- Portfolio/About scroll-arrow bounce and hover: B/D.
- Experience RAF progress, 400vh scroll budget, card transforms, dot curve/pulse: B/H/U.
- Certificate expand/collapse, 3000 ms autoplay, current slide, timer, refresh/showAll, download: B/U. `expandedCards`, `currentSlides`, timers, `isLoading`, and errors are U, not DB columns.
- Contact CTA navigation and hover: B.

## 5. Admin control inventory

Admin `/admin/edit` runtime census found 30 inputs/selects. The first 28 are shell controls with no model binding to Guest data/config:

| Admin group | UI controls | State/mutation | Guest consumer | Status |
| --- | ---: | --- | --- | --- |
| FONT | 21 | only two checkboxes mutate local visibility refs | None | Shell/dead for Guest |
| IMAGE | 7 | no `v-model`, no event handler | None | Dead |
| PHOTO AREAS selector | 1 | `selectedPhotoArea` local targeting | Selects one of 17 IDs | Functional targeting, not a property mutation |
| PHOTO AREAS upload | 1 rendered input | FileReader -> store/repository | selected image `source` | PASS for 10, PARTIAL for 7 Certificate IDs |
| PHOTO AREAS remove | 1 rendered button | store/repository | selected image `source` | same mapping as upload |
| Save/Publish | 2 buttons | disabled | None | Dead/disabled |
| Undo/Redo | 2 buttons | disabled | None | Dead/disabled |

Functional-control counting is expressed two ways to avoid a misleading number:

- **Property-control mappings:** 17 source properties have a binding.
- **Strict runtime PASS mappings:** 10.
- **PARTIAL mappings:** 7 Certificate default photo IDs.
- **UI action instances:** one dynamic upload + one dynamic remove control can address 17 targets (34 logical actions), but they still mutate only 17 properties.

Other Admin pages (Media, Maintenance, Messages, Dashboard) contain local/demo handlers, alerts, or maintenance/message UI; no traced mutation flows into Guest content/config.

## 6. Guest Admin mapping matrix

| Section | Entity | Property | Guest source | Admin control | Bound? | Functional? | Independent? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Portfolio | profile usage | image source | `defaultProfile.imageUrl` -> import map | none | No | FAIL | N/A |
| About | back frame | source | `photoAreaImages.frames[id].source` | photo-area upload/remove | Yes | PASS, session | PASS |
| About | main frame | source | same | photo-area upload/remove | Yes | PASS, session | PASS |
| College | back/front frames | source x2 | same | photo-area upload/remove | Yes | PASS, session | PASS |
| SHS | back/front frames | source x2 | same | photo-area upload/remove | Yes | PASS, session | PASS |
| Experience | 4 frame slots | source x4 | same, by `frameId` | photo-area upload/remove | Yes | PASS, session | PASS |
| Certificate | 7 default photo slots | source x7 | session override OR card source | photo-area upload/remove + IndexedDB | Yes | PARTIAL | IDs independent; async completion not observable |
| Contact | person image | source | `defaultContact.imageUrl` -> import map | none | No | FAIL | N/A |
| All sections | content text | text/data fields | defaults | none | No | FAIL | N/A |
| All sections | visual config | C/V paths | default config/CSS | shell labels only | No | FAIL | N/A |
| Navbar | brand/items | text/target/style | defaults + local runtime state | none | No | FAIL | N/A |

Critical cases:

- Case A/B: Admin labels for typography exist, but no state is read by Guest; Guest has hundreds of visual properties without a control. FAIL.
- Case D: shadow checkboxes mutate only Admin local visibility refs. FAIL for Guest.
- Case E: responsive `!important` rules override inline config in About and Experience. FAIL/source conflict.
- Certificate fast sequential mutation: test observed no changed key or the previous Certificate key changing while the selected operation was awaited only through a status that could already be true. PARTIAL/race/observability defect.

## 7. Missing Admin controls

**475 of 492 C/V properties have no mapped Admin control.** Major gaps:

- All Guest content text, URLs, order, visibility/active fields, and navigation labels/targets.
- Portfolio/About/Contact physical portrait source and identity.
- Every typography property: family, size, weight, line-height, letter-spacing, color, alignment, shadow, opacity, transform.
- Every editable geometry property: x/y, width/height, rotation, z-index, object position, frame background/border/radius/shadow.
- Certificate card content, record creation/deletion/order/active, dynamic DB media discovery, placeholder content, and behavior settings.
- Visual background and CTA properties.
- No Admin entity tree/selector exists for content or visual elements.

The Admin shell must not be counted as coverage.

## 8. Dead/unbound Admin controls

There are **28 unbound input/select controls** in FONT and IMAGE. They have no `v-model`/event mutation into a Guest store/config. The two shadow checkboxes are local UI state only. Save, Publish, Undo, and Redo are disabled. The preview canvas is a placeholder and never mounts the Guest renderer.

Certificate upload is not dead, but lacks operation state, target locking, queueing, or per-target save confirmation. A stale “Image selected” status can satisfy the runtime wait before the new async FileReader/IndexedDB operation has completed.

## 9. Shared controls

There are **0 functional shared Admin visual/content controls**. Shared renderer config exists, but is not Admin-controlled:

- Experience title/date/description typography is shared by four items.
- Experience frame factory provides the same schema but independent objects.
- Certificate info typography and card background are shared across cards.
- Navbar link typography is shared across four nav items.
- `PhotoArea` behavior is shared code; state remains keyed per ID.

Shared configuration must remain separate from shared mutable entity state. A future editor should mark whether a control edits a style token, an element instance, or an entire component type.

## 10. Stable identity map

| Entity | Stable ID/key available | Generated/stored | Render/Admin target | DB-safe? |
| --- | --- | --- | --- | --- |
| Section anchors | `main`, `about`, `education`, `college`, `experience`, `certificate`, `contact` | templates/navigation defaults | navbar/DOM | Yes if namespaced; SHS missing DOM id |
| College item | `college-1` | default data | renderer ignores ID because it uses `[0]` | Yes, but not fully used |
| SHS item | `shs-1` | default data | renderer ignores ID because it uses `[0]` | Yes, but not fully used |
| Experience items | `klinik-1..4` | default data | `:key=item.id` | Yes |
| Experience frames | `experience-frame-klinik-1..4` | data + photo registry | renderer/Admin | Yes |
| About frames | `about-frame-back-2`, `about-frame-main` | config/registry | renderer/Admin | Yes |
| College frames | `college-frame-back/front` | config/registry | renderer/Admin | Yes |
| SHS frames | `shs-frame-back/front` | config/registry | renderer/Admin | Yes |
| Certificate cards | `cert-a`, `cert-b`, dynamic DB string ID | defaults/DB | `:key`, data attribute | Yes after UUID/slug policy |
| Certificate photo areas | 7 default IDs; normalized `${certificateId}-...` fallbacks | defaults/store normalization | renderer/Admin only for fixed 7 | Yes, collision normalization exists but Admin discovery is incomplete |
| Navigation items | `main`, `about`, `activity`, `contact` keys | default data | `nav-${key}` | Yes, scoped key |

Missing persistent identity:

- Portfolio/project record, portfolio title element, profile record, and its image usage.
- About content record and both paragraph IDs.
- Education header/content record.
- About foreground portrait usage.
- Contact content and contact person image usage.
- Navbar brand record/style element.
- SHS DOM section anchor.
- Individual visual element IDs for most text/decorative elements.

Array index/DOM order is still used by College, SHS, Certificate slide-dot keys, and some fallback behavior. It is not safe persistent identity.

## 11. Image/media identity map

| Guest image/area | Physical source | Image/slot ID | Owner | Admin target | Storage key/DB field |
| --- | --- | --- | --- | --- | --- |
| Portfolio portrait | `gambar1.webp` | Missing | profile/Portfolio | none | needs media relation |
| About foreground portrait | same `gambar1.webp` | only `data-about-foreground="gambar1"`, not stable entity ID | About | none | needs distinct usage relation |
| Contact person | same `gambar1.webp` | Missing | Contact | none | needs distinct usage relation |
| About 2 frames | empty/default or data URL | 2 stable IDs | About | yes | session only; future media relation |
| College 2 frames | empty/default or data URL | 2 stable IDs | College item | yes | session only |
| SHS 2 frames | empty/default or data URL | 2 stable IDs | SHS item | yes | session only |
| Experience 4 frames | empty/default or data URL | 4 stable IDs | Experience items | yes | session only |
| Certificate thumbs/details | empty/default or data URL | 7 default + dynamic normalized IDs | Certificate card | fixed 7 only | data URL embedded in IndexedDB card |

The three `gambar1.webp` uses are separate semantic entities that happen to share one physical asset. They should be modeled as one `media_assets` row plus three `entity_media` usage rows unless design/product explicitly says edits must be shared. Current filename/key coincidence must not create coupled Admin state.

No current photo-area has a real storage key, MIME/size metadata, checksum, public URL, or lifecycle status. Certificate stores the full data URL in the record. This is unsuitable for PostgreSQL-scale media and should migrate to object storage references.

## 12. CSS source-of-truth map

Ideal chain is absent. Current chains include `default config + inline style + scoped CSS literal + media-query !important`.

Explicit conflicts:

- About: 18 distinct config paths are overridden at tablet/mobile by `!important`: section padding; container gap/min-height; content basis/padding; visual basis/height; frame back width/height/bottom/right; frame main width/height/top/left; portrait width/top/right. CSS also introduces responsive `top/right/left/bottom` values not represented as responsive config fields.
- Experience: four frame rotation instances are overridden by hover/mobile `transform !important`; shared card `paddingTop`/`paddingBottom` becomes a hardcoded mobile padding for four entities. That is 6 distinct paths and 12 entity-property instances.
- Certificate `max-height: 0 !important` is U/transition structure, not a persisted config conflict.

Total source conflict: **24 distinct config paths / 30 entity-property instances**.

Other duplicate-source examples without `!important`:

- About title/paragraph/frame/tape/scroll styles exist both in config-driven inline styles and matching CSS literals.
- Experience title/item/date/description styles are inline-configured and repeated in CSS.
- Certificate config declares hundreds of card/slide/button/layout fields, while the renderer consumes only 101 direct `vConfig.x.y` paths and CSS hardcodes card, thumbnail, action, slide, refresh, transition, and hover values.
- Portfolio defines `profileCard` and `decorativeLayer.opacity` but does not render/consume them.

## 13. Data/config source-of-truth map

| Domain | Default | Runtime current | Renderer | Admin mutation | Persistence |
| --- | --- | --- | --- | --- | --- |
| Standard content | `src/data/default/*.ts` | same module constants | direct imports | none | none |
| Standard visual | `visual/*.ts` | same module object | inline style + CSS | none | none |
| 10 non-cert photos | photo registry empty | Pinia `photo-area-images` | `PhotoArea` | upload/remove | memory only |
| Certificate records | two defaults | Certificate Pinia | `displayedCards` | no record editor | IndexedDB records |
| Certificate photos | card field plus session override | two Pinia sources | session source OR card source | fixed target upload/remove | IndexedDB data URL + memory override |
| Navbar runtime | defaults | component refs/computed | Navbar | none | U only |
| Experience motion | CSS/TS literals | RAF refs | transforms/dot | none | U/B |

Fields with data/config but no direct renderer consumer include Portfolio `profileCard.*` and `decorativeLayer.opacity`; About config frame `id`, `source`, and `objectFit` fields (renderer uses literal frame IDs and Pinia source); College/SHS config frame IDs/sources/objectFit and numerous unrendered decorative groups; and much of Certificate card/slide/button/layout config, which is replaced by CSS literals. The exact direct-use mechanical census found 468 declared two-level paths without a matching direct `vConfig.group.field` read, but nested aliases and structurally grouped objects mean this number is evidence of divergence, not a safe “468 dead fields” total.

Fields consumed without a proper data/config owner include About `LEARN MORE` text/href, many CSS layout/hover/animation values, Experience line/dot geometry, Certificate card/thumbnail/action/slide/refresh geometry and transitions, PhotoArea scale algorithm, and SVG path data.

## 14. Database table candidates

Evidence-derived candidate tables:

1. `site_sections`
2. `navigation_items`
3. `portfolio_content`
4. `profiles`
5. `about_content`
6. `about_paragraphs`
7. `education_entries` (typed College/SHS rows)
8. `experiences`
9. `certificates`
10. `certificate_media_slots`
11. `contact_content`
12. `media_assets`
13. `entity_media`
14. `visual_element_configs`
15. `behavior_configs` only for explicitly approved persistent B fields

Provider, auth, draft/publish, RLS, and storage vendor are `Belum ditentukan.`

## 15. Database column candidates

| Table | Evidence-derived columns |
| --- | --- |
| `site_sections` | `id uuid PK`, `section_key text UNIQUE`, `label text`, `order_index int`, `active boolean` |
| `navigation_items` | `id uuid PK`, `nav_key text UNIQUE`, `label text`, `target_section_id uuid FK`, `order_index int`, `dark_background boolean`, `active boolean` |
| `portfolio_content` | `id uuid PK`, `section_id uuid FK`, `title text`, `profile_id uuid FK` |
| `profiles` | `id uuid PK`, `name text`, `primary_media_id uuid FK nullable` |
| `about_content` | `id uuid PK`, `section_id uuid FK`, `title text`, `cta_text text`, `cta_href text`, `foreground_media_usage_id uuid FK nullable` |
| `about_paragraphs` | `id uuid PK`, `about_id uuid FK`, `body text`, `order_index int`, `active boolean` |
| `education_entries` | `id uuid PK`, `section_id uuid FK`, `entry_type text`, `label text`, `school text`, `period_text text`, `description text`, `order_index int`, `active boolean` |
| `experiences` | `id uuid PK`, `section_id uuid FK`, `title text`, `date_text text`, `description text`, `layout_key text`, `order_index int`, `active boolean` |
| `certificates` | `id uuid/text PK`, `section_id uuid FK`, `title text`, `date_text text`, `description text`, `order_index int`, `active boolean` |
| `certificate_media_slots` | `id uuid/text PK`, `certificate_id FK`, `role text`, `order_index int`, `media_asset_id uuid nullable`, `object_position text`, `placeholder_label text`, `placeholder_hint text`, `placeholder_color text`, `placeholder_opacity numeric` |
| `contact_content` | `id uuid PK`, `section_id uuid FK`, `line_1 text`, `line_2 text`, `cta_text text`, `cta_href text`, `person_media_usage_id uuid FK nullable` |
| `media_assets` | `id uuid PK`, `storage_key text UNIQUE`, `public_url text nullable`, `mime_type text`, `width int nullable`, `height int nullable`, `byte_size bigint nullable`, `alt_text text nullable`, `checksum text nullable` |
| `entity_media` | `id uuid PK`, `owner_type text`, `owner_id uuid/text`, `slot_key text`, `media_asset_id uuid FK`, `order_index int`, `object_position text`, `active boolean` |
| `visual_element_configs` | `id uuid PK`, `section_id uuid FK`, `owner_type text`, `owner_id uuid/text nullable`, `element_key text`, `viewport_key text`, `config jsonb`, `version int` |
| `behavior_configs` | `id uuid PK`, `section_id uuid FK`, `behavior_key text`, `config jsonb`, `active boolean` |

Dates remain `text` because current Guest data uses display strings such as `2025 - Now`, `Semester 1 - RSUD`, and ranges, not normalized dates. Converting them to `date_start/date_end` would be a new product decision.

## 16. Foreign-key/relation candidates

- Every content record belongs to `site_sections`.
- Navigation targets `site_sections.id`.
- `portfolio_content.profile_id -> profiles.id`.
- About paragraphs belong to `about_content`.
- Education entries and experiences belong to their section and are ordered children.
- Certificate media slots belong to a Certificate; thumbnail is role `thumbnail`, details role `detail` plus order.
- Media usages target `media_assets`; semantic usages must not be keyed by filename.
- Visual configs target an owner/entity and `element_key`, with `viewport_key` for responsive variants.
- Polymorphic `entity_media.owner_type/owner_id` is pragmatic but cannot have a native FK to many tables. If strong relational integrity is required, replace it with typed join tables. `Belum ditentukan.`

## 17. Default vs database rules

Source and runtime logic confirm:

| DB valid active count | Initial | After refresh/showAll |
| ---: | --- | --- |
| 0 | Default A + Default B | Default A + Default B |
| 1 | DB row + non-colliding default | same two-slot result |
| 2 | first two DB rows | both DB rows |
| 5 | first two DB rows | all five DB rows |

Records are normalized, inactive records filtered, duplicate Certificate IDs deduplicated, records ordered, missing IDs rejected, and default ID collisions excluded from fallback. Photo IDs are normalized and locally repaired when duplicated within the loaded DB set.

Hard locks still exist: initial count constant = 2; default fallback pool = 2; Admin registry knows only the seven default Certificate photo IDs. Dynamic DB card photo IDs render but are not discoverable/editable in Admin.

## 18. Certificate database/admin mapping

| Layer | ID/content | Images | Visual | Behavior |
| --- | --- | --- | --- | --- |
| Default | `cert-a`, `cert-b`, title/date/description | 7 stable empty slots | default visual config + CSS | two-slot fallback |
| IndexedDB | card `id`, order index | full data URL embedded in card | object position/placeholder travel with record | list/put/replace/clear |
| Store | normalized records, origin | `photoSource`, `updatePhotoAreaSource` | no visual persistence | `showAll`, loading, error |
| Guest | `:key=card.id` | thumbnail/details by ID | config/CSS | expand, slide, timer, refresh, download |
| Admin | no card CRUD/content | fixed 7 default IDs only | shell only | no refresh/order/active control |

U vs persistent:

- Persistent C: card ID/title/date/description/order/active, photo slot IDs/source/object position/placeholder metadata.
- U: expanded cards, current slide, interval handles, loading, initialized, error message, current visible origin.
- B candidate: autoplay enabled/interval, refresh policy. Current 3000 ms is TS hardcode.

Identity collision risk remains at the architecture boundary: store normalization repairs duplicate photo IDs in memory, but no uniqueness constraint exists in a remote schema and Admin's static ID registry cannot target dynamic repaired IDs. Default and DB records with the same card ID are filtered, not merged.

## 19. Frame mapping

| Section | Frame count | Guest-visible property count | Admin-controlled | Shared/common schema | Uncontrolled |
| --- | ---: | ---: | ---: | ---: | ---: |
| About | 2 | 36 | 2 source | PhotoArea behavior | 34 |
| College | 2 | 36 | 2 source | PhotoArea behavior | 34 |
| SHS | 2 | 36 | 2 source | PhotoArea behavior | 34 |
| Experience | 4 | 72 | 4 source | 18-field frame schema | 68 |
| Certificate | 7 photo areas | 42 core slot properties plus card CSS | 7 source PARTIAL | PhotoArea behavior | 35 core + CSS |
| **Total** | **17** | **222 core frame/slot property instances** | **17 source mappings** | shared renderer, independent state | **205** |

Core per standard frame: source, width, height/aspect, x/y placement, rotation, z-index, background, border, radius, shadow, padding/clipping, object position, placeholder color/opacity/border/font/offset. Experience has 18 explicit fields per frame. Certificate card dimensions/positions are ALLOWED hardcode; internal image slot identity and media metadata are not.

Runtime matrix:

- 17 expected/17 unique; no horizontal overflow at all three viewports.
- Intrinsic ratio delta <= 0.001; max scale <= 1.
- Large images clip; 100x100 and 100x50 retain whitespace and are not upscaled.
- Geometry stayed stable across fixtures.
- Mixed Certificate slide geometry remained 704.8125x498.34375; card widths remained 820 px at desktop.
- Sequential Certificate Admin isolation assertion failed despite geometry/render tests passing.

## 20. Typography mapping

| Visible text group | Guest source | Style source | Admin | Persistence readiness |
| --- | --- | --- | --- | --- |
| Portfolio title | default content | 7 config fields | shell only | content/config IDs missing |
| About title | default content | config + duplicate CSS | shell only | content ID missing |
| About paragraphs | array text | shared paragraph config + CSS | none | paragraph IDs missing |
| Education title | default content | config + responsive composition | none | element ID missing |
| College label/school/period/description | `items[0]` | independent config groups | none | item ID exists but renderer fixed to index 0 |
| SHS equivalent | `items[0]` | independent config groups | none | same issue |
| Experience section/item/date/description | item array | shared config + duplicate CSS | none | item IDs ready; style ownership unresolved |
| Certificate section/date/title/description | defaults/DB | config + CSS | none | card IDs ready; no editor |
| Contact line1/line2/CTA | default content | independent config groups | none | content/image ID missing |
| Navbar brand/links | defaults | navbar config + state CSS | none | keys available |

Desktop computed examples: Portfolio 184.86 px Inter 900; About title 85.32 px Georgia 700; College/SHS school 64 px Georgia 700; Experience title 71.1 px Georgia 700; Certificate title 88 px Inter 900 with two-part shadow; Contact line1 127.98 px Impact-family 900; Navbar link 14.4 px Inter 500. Mobile uses responsive computed sizes, but several headings are visibly clipped. No Admin typography control is functional.

## 21. Behavior mapping

| Behavior | Source | Persistent? | Admin | Classification |
| --- | --- | --- | --- | --- |
| Navbar anchor navigation | default targets + Lenis | No | None | B/S |
| Navbar active/hide/color | refs, observers, CSS | No | None | U/B |
| Education/College magnet | composable constants/state | No | None | B/U |
| Mobile touch | native, magnet bypass | No | None | S/B |
| Reduced motion | media query bypass | No | None | S/B |
| Experience progress | RAF + scroll geometry | No | None | B/U |
| Experience line/dot | CSS + computed top | No | None | ALLOWED H + U |
| Certificate expand/current slide | refs/reactive | No | None | U |
| Certificate autoplay 3000 ms | TS literal | Candidate only if approved | None | B hardcode |
| Certificate refresh/showAll | store | showAll U | Guest button only | B/U |
| Certificate active/order | DB data | Yes | None | C/B |
| Contact mailto | content href | Yes | None | C/B |

## 22. Responsive mapping

- Breakpoints observed in source include Portfolio 1023/767, About 1100/760, Experience 900/480, plus section-specific CSS. There is no repository responsive specification: `Tidak ditemukan dalam specification.`
- Desktop/tablet remain visually coherent in inspected screenshots.
- Mobile has no document overflow, but overflow clipping hides oversized Portfolio/Education title extents; Contact's text is below/outside the captured top composition while the portrait appears at the bottom.
- About responsive CSS overrides config using `!important`.
- Experience changes from 400vh sticky/translated cards to normal stacked cards at <=900 px and forces rotations to none.
- Certificate retains stable photo geometry in the runtime matrix.
- Navbar keeps four links in a single horizontal row; on 390 px, the Contact item is clipped/off-screen in captures even though the document width stays 390 px because the navbar/section clips content.
- Visual intent cannot be compared to design: `Tidak dapat dipastikan dari gambar.`

## 23. Hardcode registry

### ALLOWED

1. Certificate card dimensions.
2. Certificate card positions.
3. Experience center line.
4. Experience center dot.

### STRUCTURAL / INFO

- SVG paths/viewBoxes, flex/grid techniques, PhotoArea intrinsic ratio algorithm, clipping wrappers, transition mechanics, accessibility attributes, responsive technique, and DOM structure.
- Structural constants are not automatically violations.

### NEEDS CONFIG

- CSS-only non-allowed card/frame/button/hover/transition visual values where Admin editing is intended.
- Responsive variants currently encoded as `!important`.
- Certificate autoplay interval if behavior editing is approved.
- Visible typography/geometry/color properties represented by Admin shell labels.

### NEEDS DATA

- About CTA text/href, content IDs, paragraph IDs, Portfolio/profile IDs, Contact/person IDs, navigation records, and dynamic Certificate Admin discovery.

### NEEDS BACKEND

- All editable C/V values intended to survive session/device, all media metadata/storage references, publish/draft lifecycle, and remote Certificate records.

## 24. P0 findings

1. **P0 — Guest/Admin coverage is not an editor architecture.** 475/492 candidate C/V properties have no Admin mapping; 28 controls are shell/dead.
2. **P0 — Dynamic Certificate records are not Admin-discoverable.** Guest/store accept arbitrary DB IDs and photo IDs, while Admin enumerates 17 fixed registry IDs and only seven Certificate defaults.
3. **P0 — Persistence is split and non-remote.** Ten media sources live only in Pinia; Certificate uses browser-local IndexedDB/data URLs; all content/visual config is module-static.
4. **P0 — Owner identity is missing for core records/elements.** Portfolio/About paragraphs/Education/Contact/profile usages cannot be safely targeted by DB/editor records.
5. **P0 — Admin shell labels create false readiness.** Font/image fields do not mutate a source read by Guest.

## 25. P1 findings

1. Certificate async upload has no per-operation state/locking and fails strict sequential isolation observation for seven targets.
2. 24 distinct config paths compete with `!important` CSS; Admin values would not be authoritative at affected viewports/states.
3. The same physical `gambar1.webp` is used by three semantic entities without usage IDs.
4. Certificate media is embedded as data URL rather than storage relation.
5. Photo ID collision repair is in-memory normalization, not a durable uniqueness policy.
6. SHS root lacks the section ID advertised by navigation config.

## 26. P2 findings

1. College/SHS render `[0]`, silently locking entity count to one despite array data.
2. Experience CSS height is hardcoded 400vh while progress is based on `items.length`; adding/removing items breaks scroll budget.
3. Certificate default/admin registry locks a seven-slot default topology and initial two-card policy.
4. Visual config and CSS duplicate large portions of the same component model, especially Certificate.
5. No generic entity/element registry connects Guest owners, Admin targets, and persistence records.
6. Responsive variants are not modeled consistently in visual config.

## 27. P3 findings

1. Several config fields/groups appear unused or are superseded by CSS.
2. Certificate slide-dot `:key` uses index, acceptable for U rendering but not persistence identity.
3. Comments and placeholder copy still describe URL replacement/manual behavior despite repository/store integration.
4. Navigation section config uses `college-section`/`shs-section` while actual College root is `#college` and SHS has no id.
5. Admin label association in the runtime census is ambiguous for grid fields because labels lack IDs/`for`.

## 28. Guest property vs Admin control counts

| Section | Guest C/V properties | Mapped source properties | Strict PASS | PARTIAL | Missing controls | Dead controls allocated |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Portfolio | 32 | 0 | 0 | 0 | 32 | shared shell |
| About | 64 | 2 | 2 | 0 | 62 | shared shell |
| Education | 16 | 0 | 0 | 0 | 16 | shared shell |
| College | 59 | 2 | 2 | 0 | 57 | shared shell |
| SHS | 62 | 2 | 2 | 0 | 60 | shared shell |
| Experience | 111 | 4 | 4 | 0 | 107 | shared shell |
| Certificate | 82 | 7 | 0 | 7 | 75 | shared shell |
| Contact | 42 | 0 | 0 | 0 | 42 | shared shell |
| Navbar | 24 | 0 | 0 | 0 | 24 | shared shell |
| **Total** | **492** | **17** | **10** | **7** | **475** | **28 unique shell inputs** |

Mathematical summary:

- Guest candidate editable entities: 42 logical records/children.
- Admin-targetable Guest entities: 17 leaf photo areas, owned by 12 higher-level frame/card owners.
- Guest editable property instances: 492 C/V.
- Admin property-control mappings: 17.
- Strict mapped 1:1 PASS: 10.
- PARTIAL: 7.
- Shared functional Admin controls: 0 (one dynamic UI pair targets multiple IDs, but state is keyed).
- Missing mapped controls: 475.
- Strictly non-PASS properties: 482.
- Admin controls with no Guest consumer: 28 inputs.
- Explicit duplicate source paths: 24 distinct / 30 entity-property instances.

## 29. Database migration readiness

**Not ready.** Candidate schema is sufficiently clear for review, but migration implementation is blocked by P0 identity/editor/persistence problems. Directly serializing current config objects would preserve dead fields, CSS conflicts, static array-index ownership, and the fixed Certificate registry.

Ready to move behind a backend after minimal adapter work:

- Experience content rows and stable frame IDs.
- Certificate record fields, ordering/active, normalization, fallback algorithm, and repository interface.
- Navigation item keys/targets after section identity alignment.
- Media asset metadata model (new backend required).

Must refactor first:

- Guest element registry and stable owner IDs.
- Admin entity selection/binding/save/publish path.
- College/SHS array rendering.
- Dynamic Certificate media target discovery.
- CSS/config authority and responsive config model.
- Shared physical asset usage relations.
- Remote repository and object storage boundary.

## 30. Recommended backend architecture

Recommendation derived from current evidence:

```text
approved defaults
    -> repository fallback
    -> normalized runtime stores
    -> Guest renderer
    <-> Admin commands against the same store shape
    -> repository save/publish
    -> relational content + JSONB visual config + object storage media
```

- Normalize repeatable content rows: navigation, paragraphs, education entries, experiences, certificates, certificate media slots.
- Use relational media assets/usages; do not put binaries/data URLs in relational rows.
- Use JSONB for per-element visual property bags and responsive variants because fields differ greatly by element; keep owner/element/viewport identity relational.
- Do not put content, visual config, behavior, and U state into one JSON object.
- Keep U state entirely client-side.
- Keep system/decorative constants in source unless explicitly approved as editable.
- A provider/auth/RLS design requires a separate approved phase. `Belum ditentukan.`

## 31. Recommended implementation order

1. Freeze and approve the 42-entity identity model and section/element keys.
2. Create a canonical Guest element registry that includes content owner, visual config key, media slot, and persistence policy.
3. Refactor College/SHS to render stable-ID arrays and Experience height to derive from item count.
4. Make Certificate Admin discover loaded cards/photo slots dynamically and expose save progress/errors.
5. Choose one visual source of truth; move responsive variants out of competing `!important` literals where editing is required.
6. Bind Admin controls to the same stores consumed by Guest; add mutation proofs per property class.
7. Introduce repository interfaces for content/config/media; keep IndexedDB only as local adapter if desired.
8. Add relational schema/object storage after provider/auth/RLS approval.
9. Migrate defaults as seed/fallback records.
10. Run full Guest->Admin->DB->reload reverse tests and visual verification before enabling publish.

## 32. Final verdict

**CRITICAL BLOCKED.**

Answers to the 30 mandatory questions:

1. Admin can target 17 Guest leaf media entities (12 higher-level owners); only 10 are unqualified runtime PASS and seven Certificate targets are PARTIAL.
2. 492 C/V editable property instances were identified.
3. 17 have a real Admin binding; 10 strict PASS, seven PARTIAL.
4. 28 Admin inputs have no Guest consumer.
5. 475 Guest properties have no mapped Admin control.
6. 24 distinct config paths, 30 entity-property instances, have explicit duplicate/overriding sources.
7. Stable IDs exist for Experience items/frames, College/SHS item data, 17 default photo areas, Certificate cards/photo slots, navigation keys, and seven section anchors.
8. Portfolio/profile, About content/paragraphs/foreground, Education content, Contact/person, navbar brand, most text/visual elements, and SHS DOM root lack stable persistent identity.
9. The three semantic usages of `gambar1.webp` lack image/usage IDs. The 17 photo areas have IDs.
10. Unconsumed/superseded fields include Portfolio `profileCard`, config frame source/objectFit/id fields, many unrendered College/SHS decorations, and much of Certificate component config.
11. Renderer-only values include About CTA literals, many CSS layout/hover/animation constants, Experience line/dot and scroll geometry, Certificate CSS card/slide/button values, and PhotoArea algorithm constants.
12. CSS-only values are catalogued in Sections 12/23, notably non-allowed responsive layout, card/button/hover/transition, and Experience layout constants.
13. Vue/TS-only values include image import maps, Certificate 3000 ms timer, initial card count 2, normalization fallbacks, magnet parameters, and runtime state logic.
14. Only the four explicitly approved ALLOWED hardcodes may remain: Certificate card dimensions/positions and Experience center line/dot. Structural constants may remain when not intended editable.
15. No. Admin/Guest coverage is far from 1:1.
16. A candidate schema can be determined, but implementation should wait for pre-database refactor.
17. Fifteen candidate tables are listed in Section 14.
18. Candidate columns are listed in Section 15.
19. Candidate foreign keys are listed in Section 16.
20. Media needs `media_assets` plus semantic usage/slot relations and object storage keys.
21. JSONB is reasonable for visual element config and approved behavior config, keyed relationally by owner/element/viewport.
22. Content rows, navigation, ordered children, certificates, certificate media slots, and media assets should be normalized.
23. Identity registry, Admin binding, dynamic Certificate discovery, CSS/config authority, array rendering, and persistence adapters must be refactored first.
24. Experience content IDs and Certificate record/repository logic are closest to backend-ready; neither is ready for publish without Admin/remote adapters.
25. Yes: College/SHS `[0]`, Experience 400vh, Certificate initial/default two-card rules, and the fixed 17/7 photo registry lock counts/topology.
26. Yes: About/Experience `!important` rules can block Admin/config values.
27. Yes: 28 shell controls have no consumer; 475 Guest properties lack controls; Certificate sequential upload is PARTIAL.
28. Yes: dynamic photo IDs can collide before in-memory repair; remote uniqueness is absent; default/DB identity and static Admin discovery can diverge.
29. Yes: three semantic portrait uses share `gambar1.webp`; preserve a shared asset but split usage/entity relations.
30. No. The architecture is not sufficiently ready for backend/database integration without substantial pre-database refactor.

## 33. Exact evidence and line references

Key source evidence:

- Guest composition: `src/pages/guest/HomePage.vue:10-17`.
- Routes: `src/router/index.ts:10-48`.
- Photo rendering/identity/ratio: `src/components/PhotoArea.vue:3-8`, `18-34`, `64-83`, `86-109`.
- 17 fixed photo IDs: `src/data/default/photoAreas.ts:1-18`, `27-45`.
- Session photo store: `src/stores/photoAreaImages.ts:8-23`.
- Admin shell controls: `src/pages/admin/AdminEdit.vue:14-145`, `150-185`.
- Admin photo target UI: `src/pages/admin/AdminEdit.vue:188-231`.
- Admin mutations: `src/pages/admin/AdminEdit.vue:273-310`.
- Portfolio content/profile/media binding: `src/sections/portfolio/PortfolioSection.vue:5-13`, `57-96`.
- Portfolio unused config groups: `src/data/default/visual/portfolio.ts:17-25`, `46-48`, `148-178`.
- About data: `src/data/default/about.ts:1-12`.
- About frame bindings: `src/sections/about/AboutSection.vue:126-188`; foreground `209-220`.
- About responsive overrides: `src/sections/about/AboutSection.vue:667-740`.
- College fixed index content and frames: `src/sections/education/college/CollegeSection.vue:40-89`, `99-163`; data ID `src/data/default/college.ts:13-22`.
- SHS fixed index content and frames: `src/sections/education/shs/SHSSection.vue:49-106`, `141-194`; data ID `src/data/default/shs.ts:13-22`.
- Experience stable IDs: `src/data/default/experience.ts:21-56`.
- Experience frame/store mapping: `src/sections/experience/ExperienceSection.vue:206-233`.
- Experience RAF/item-count progress: `src/sections/experience/ExperienceSection.vue:241-288`.
- Experience 400vh and allowed line/dot: `src/sections/experience/ExperienceSection.vue:304-308`, `396-435`.
- Experience CSS conflicts/responsive: `src/sections/experience/ExperienceSection.vue:540-545`, `617-654`.
- Certificate model/default IDs: `src/data/default/certificates.ts:1-30`, `33-59`, `62-90`.
- Certificate normalization/collision/order: `src/stores/certificates.ts:21-80`.
- Certificate DB0/1/2/5 display rules: `src/stores/certificates.ts:83-107`.
- Certificate store state/refresh/persistence mutation: `src/stores/certificates.ts:121-186`.
- IndexedDB store/key/index: `src/repositories/certificateRepository.ts:3-30`, `48-75`.
- Certificate Guest source precedence/ephemeral state/timer: `src/sections/certificate/CertificateSection.vue:14-29`, `31-73`, `95-106`.
- Certificate keyed card/photo rendering: `src/sections/certificate/CertificateSection.vue:298-326`, `381-425`.
- Certificate refresh: `src/sections/certificate/CertificateSection.vue:443-463`.
- Certificate CSS card/thumbnail/button hardcodes: `src/sections/certificate/CertificateSection.vue:643-690`, `750-827`, `829-1016`.
- Contact content: `src/data/default/contact.ts:1-19`; renderer `src/sections/contact/ContactSection.vue:132-177`.
- Navigation keys/targets/section mismatch: `src/data/default/navigation.ts:20-37`; Guest keys `src/components/GuestNavbar.vue:31-58`, `345-378`.
- Shared physical profile source: `src/data/default/profile.ts:1-9`, `src/sections/portfolio/PortfolioSection.vue:8-13`, `src/data/default/visual/about.ts:1-2`, `src/sections/contact/ContactSection.vue:1-10`.
- Runtime matrix logic/evidence harness: `tests/frame-image-runtime.mjs:66-105`, `108-147`, `149-176`, `201-210`.
- Preservation runtime evidence harness: `tests/frame-image-preservation.mjs:1-80` and subsequent navigation/touch/refresh assertions.

Runtime measurements recorded during this audit:

- Desktop 1422x804: no horizontal overflow; section roots present; Experience 3216 px; Certificate cards `cert-a`, `cert-b`; 12 mounted photo areas collapsed; three rendered `gambar1.webp` usages.
- Tablet 1024x768: no horizontal overflow; Experience 3072 px; responsive visual screenshots inspected.
- Mobile 390x844: no horizontal overflow; all roots present; clipping observed in Portfolio/Education/Navbar and Contact top composition.
- Expanded/matrix state: 17 unique photo IDs; responsive fixtures all retained 17 unique IDs; runtime errors zero.
- Admin runtime: 30 inputs/selects, 17 photo options, one dynamic file input, one remove button; 28 shell inputs; Save/Publish/Undo/Redo disabled.
- Sequential mutation diagnostic: from fixture B onward, multiple Certificate operations produced `changed=[]` or changes to the immediately previous target before the selected async operation settled; strict isolation assertion failed. Non-Certificate geometry/state tests and the remaining visual matrix passed.

No design comparison is claimed. `Tidak dapat dipastikan dari gambar.` No production source, CSS, store, config, Admin, Guest, database, dependency, or implementation log was modified by this audit.
