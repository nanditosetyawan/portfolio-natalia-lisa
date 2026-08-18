# PHASE ENTITY-ADMIN-SOURCE-OF-TRUTH-REMEDIATION-011 TODO

Status: implementation and verification completed on 2026-08-19. The repository has no `md/` or `design/` directory, so comparison against external specifications/design images was not available; runtime preservation evidence is used instead.

- [x] Canonical entity identity model
- [x] Portfolio entity model/renderer
- [x] About content owner + paragraph entities
- [x] About foreground portrait media identity
- [x] College collection renderer
- [x] SHS collection renderer + section anchor
- [x] Experience dynamic count/frame architecture
- [x] Experience dynamic scroll budget
- [x] Certificate dynamic photo-area registry
- [x] Certificate persistent media IDs
- [x] Certificate DB/default collision enforcement
- [x] Certificate single image source of truth
- [x] Contact entity/media identity
- [x] Dynamic Admin entity discovery
- [x] Admin content binding
- [x] Admin visual binding
- [x] Admin media binding
- [x] Admin property schema
- [x] Canonical runtime store
- [x] Repository abstraction
- [x] CSS/config source-of-truth cleanup
- [x] Navigation canonical mapping
- [x] Runtime mutation tests
- [x] Entity isolation tests
- [x] Responsive regression tests
- [x] Typecheck
- [x] Build
- [x] Diff check
- [x] Final implementation report
- [x] Database phase readiness audit

## Deliberately deferred

- Remote backend/database/provider selection, migrations, authentication, and storage buckets are outside this phase.
- The static repository keeps an in-memory draft boundary only; only Certificate retains IndexedDB through its repository adapter.
- The Admin schema covers the canonical, evidence-backed editable subset, not every one of the 492 Audit #010 C/V candidates. Structural and decorative CSS are not exposed as database fields.
- Existing mobile composition limitations remain where remediation would require unavailable design evidence. No horizontal document overflow or runtime error remains.
