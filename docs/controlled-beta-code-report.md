# Controlled beta code checkpoint — 6 October 2026

This change is **CODE VERIFIED**, not **PRODUCTION VERIFIED**. Public beta remains closed. No Vercel configuration, DNS, domain purchase, production database migration, real emails, or intro-video changes were made.

## Fixes and foundations

- Session credential versions: login saves the password snapshot's version. Password reset increments the user's version transactionally with token consumption and session deletion. Every authenticated request checks version equality. A session inserted after reset using stale credentials is unusable. Reset also consumes all outstanding reset links for the account.
- Society drafts: owner-only read/update endpoints; editing/publication use ownership and DRAFT predicates on the write. UI supports reload, edit/save, preview of the saved draft, and publishing. Published briefs expose an explicit public field projection; draft/private society data is not exposed.
- Society/Developer/PMC organization profiles and Society property profiles persist in PostgreSQL. Profile completion counts provided organization fields; it is not verification. Roles cannot be changed through profile payloads. Duplicate organization names do not establish common ownership.
- Workspace metrics and existing interest status come from persisted rows. Society incoming-interest review remains read-only; connection approval is outside scope. Public demo dashboards remain demo pages.
- Feasibility requests: Society ownership, supplied property facts, requirement, status, assessment notes and reviewer metadata. Admin review is authenticated, role-restricted and audit-logged. No FSI/TDR/height/cost/corpus/returns calculations or automatic regulatory conclusions.
- Founder: Aziz Parihar — Founder, RENOVA. No biography or additional Aditi role added.
- Email branding remains configurable via RENOVA_PRODUCT_NAME, RENOVA_EMAIL_FROM and RENOVA_APP_URL; production requires an explicit credential-free HTTPS origin and sender. No fixed RENOVA domain dependency. Provider calls have a timeout; forgot-password provider failures return the same neutral response. Sensitive server error objects are no longer logged.
- Enquiries retain frontend → API → PostgreSQL → ADMIN. Existing localStorage saved-directory preferences are unrelated to intake records.

## API additions

| Endpoint | Access |
| --- | --- |
| GET/PATCH /api/societies/me/opportunities/:id | Owning Society; PATCH only drafts |
| GET/PUT /api/organizations/me | Own organization; PUT Society/Developer/PMC/Professional |
| PUT /api/societies/me/profile | Own Society |
| GET /api/workspace/metrics | Authenticated organization |
| GET /api/organizations/me/interests | Own Developer/PMC |
| GET/POST /api/societies/me/feasibility | Own Society |
| GET /api/admin/feasibility | ADMIN |
| PATCH /api/admin/feasibility/:id | ADMIN; review audit log |

## Schema/deployment

Apply migrations 0002_credential_versions and 0003_feasibility_foundation before deploying the new API. Defaults preserve existing credential versions at zero; the first reset invalidates them. /api/readyz checks the new columns and feasibility table. Migration metadata includes the final schema snapshot for subsequent Drizzle generation. No credentials are committed.

## Verification status

| Check | Status | Evidence/limitation |
| --- | --- | --- |
| Auth unit tests | PASS | API package test command; tokens, hashing, release closed by default, email configuration |
| PostgreSQL-compatible integration | PASS | test:integration; isolated PGlite engine applies actual SQL migrations and invokes actual Express routers |
| Login/reset race | PASS | Concurrent requests plus deterministic stale credential read → reset → delayed session insert; old cookies rejected |
| Password/token security | PASS | Old password rejected, new password accepted, reuse/invalid/expired reset rejected, existing sessions invalidated |
| Society draft lifecycle | PASS | Create, owner reload, edit/save, publish; public draft 404; other Society 404; Developer/PMC 403 |
| Cross-role interests | PASS | Developer + PMC submit; owning Society receives both |
| Profiles/metrics | PASS | Persist/reload, organization isolation, Society role restrictions, persisted counts |
| Feasibility/admin | PASS | Submit, owner isolation, non-admin 403, admin review, persisted status |
| Enquiry persistence/admin | PASS | Stored row and admin retrieval; Developer 403 |
| Typechecks and production builds | PASS | Libraries, API and RENOVA frontend |
| Deployed migrations + Vercel checks | BLOCKED | Project access unavailable; not attempted through alternate credentials |
| Actual email receipt/link/delivery timing | BLOCKED | Final sender/domain and authorized test inbox pending |
| Desktop/mobile visual interaction QA | BLOCKED | Not performed for these changes; cannot infer from build success |

## Remaining release blockers

- P1: Apply migrations/deploy and repeat full Society/Developer/PMC flows against the deployed database.
- P1: Actual verification/resend/reset email delivery and link exercise, including timings.
- P1: Browser desktop and mobile journeys, including form validation, saved-draft preview and admin review.
- P1: Release readiness evidence must remain reviewed; keep both public-registration release flags disabled. This PR does not approve beta or change release settings.
- P2: Existing resend cooldown is not a complete per-IP spam limiter. Enquiry rate checks are not atomic across simultaneous requests. Harden before broader invitations.
- P2: Admin queues currently return a bounded recent list (250); pagination and request notification delivery are not part of this foundation.

No unresolved P0 is asserted from these code tests; this does not certify production security. Do not invite external beta users based only on this report.
