# RENOVA backend implementation checklist

Updated: 10 October 2026 (Asia/Calcutta)

Status meanings:

- **DONE** — implemented and covered by an automated or direct verification check.
- **PARTIAL** — a real implementation exists, but part of the workflow or production evidence is missing.
- **MISSING** — no production implementation exists yet.
- **BLOCKED** — implementation or verification depends on an approval or external configuration.

## Safety and release controls

| Area                         | Status  | Evidence / next action                                                                                                                                                                                                                                                                     |
| ---------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Dedicated backend branch     | DONE    | Active branch: `codex/backend-integration`.                                                                                                                                                                                                                                                |
| Public registration closed   | DONE    | API requires both `RENOVA_REGISTRATION_OPEN=true` and `RENOVA_BETA_RELEASE_APPROVED=true`; neither is changed by this work.                                                                                                                                                                |
| Live payments disabled       | DONE    | No payment provider or live credentials are configured.                                                                                                                                                                                                                                    |
| Production migration safety  | BLOCKED | Production's third Drizzle ledger hash matches the historical profile migration from commit `06718de`, while the active branch has diverged migration history. Do not deploy a build that automatically runs migrations until the ledger and exact schema are re-inspected and reconciled. |
| Private document storage     | BLOCKED | Feasibility routes require private Vercel Blob configuration. No public fallback is permitted.                                                                                                                                                                                             |
| Transactional email delivery | BLOCKED | Provider abstraction exists, but production sender/domain configuration is intentionally unavailable.                                                                                                                                                                                      |

## Platform modules

| Module                       | Backend | Frontend connected | Tested                  | Production ready                                                                                                                                                         |
| ---------------------------- | ------- | ------------------ | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Registration                 | PARTIAL | PARTIAL            | LOCAL PASS              | NO — closed and email-dependent                                                                                                                                          |
| Email verification           | PARTIAL | DONE               | OTP/TEMPLATE/ROUTE PASS | NO — six-digit, 10-minute, single-use OTPs with persistent attempt limits and rate limits are implemented; proof of inbox delivery is blocked by the final sender/domain |
| Login / logout / sessions    | DONE    | DONE               | LOCAL PASS              | NEEDS controlled deployed-account acceptance                                                                                                                             |
| Password reset               | PARTIAL | DONE               | LOCAL PASS              | NO — delivery blocked                                                                                                                                                    |
| Contact submission           | DONE    | DONE               | LOCAL PASS              | Database save is transactional with an audit record; deployed persistence and actual acknowledgement inbox evidence remain                                               |
| Enquiry management           | PARTIAL | PARTIAL            | ROUTE/TEMPLATE PASS     | Protected filtering, assignment, status updates, close/reopen timestamps and audit history are implemented; Admin UI controls and deployed acceptance remain             |
| Society profile              | PARTIAL | DONE               | POLICY/ROUTE PASS       | NEEDS deployed authenticated acceptance and document support                                                                                                             |
| Feasibility                  | PARTIAL | DONE               | POLICY/ROUTE PASS       | NO — schema activation and private storage blocked                                                                                                                       |
| Opportunities                | DONE    | DONE               | POLICY/ROUTE PASS       | Draft editing, explicit publication, closure, ownership checks and audit records are implemented; deployed acceptance remains                                            |
| Developer interests          | DONE    | PARTIAL            | POLICY/ROUTE PASS       | Submit, track, withdraw and Society review are implemented with audit records; withdrawal UI, notifications and deployed acceptance remain                               |
| PMC interests                | DONE    | PARTIAL            | POLICY/ROUTE PASS       | Submit, track, withdraw and Society review are implemented with audit records; withdrawal UI, notifications and deployed acceptance remain                               |
| Professional profiles        | DONE    | PARTIAL            | LOCAL PASS              | NEEDS deployed authenticated acceptance                                                                                                                                  |
| Document management          | PARTIAL | PARTIAL            | SIGNATURE POLICY PASS   | NO — private Blob and malware-scanning gate blocked                                                                                                                      |
| Email notifications / outbox | MISSING | N/A                | NO                      | NO                                                                                                                                                                       |
| Admin workspace              | PARTIAL | PARTIAL            | ROLE/ROUTE PASS         | NO — broader controls, audit views and production acceptance remain                                                                                                      |
| Checkout / payments          | MISSING | MISSING            | NO                      | NO — requires catalogue decisions and provider approval                                                                                                                  |
| Payment webhooks             | MISSING | N/A                | NO                      | NO — provider approval required before implementation can be verified                                                                                                    |

## Existing backend architecture

- Express/TypeScript API in `artifacts/api-server`, deployed separately from the Vite frontend.
- Same-origin frontend `/api/*` rewrite targets `https://api-server-delta-teal.vercel.app/api/*`.
- PostgreSQL with Drizzle schema and versioned migrations in `lib/db/drizzle`.
- HTTP-only, Secure-in-production, SameSite=Lax server sessions.
- Role guards for Society, Developer, PMC, Professional and Admin; Admin is not publicly registrable.
- Real PostgreSQL persistence for accounts, organizations, profiles, enquiries, opportunities, interests and feasibility records.
- Private document routes are fail-closed when Vercel Blob is not configured.

## Migration reconciliation boundary

The production migration ledger must be treated as evidence, not rewritten:

1. The historical production hash `17fee26d154b470f9a62ae6250575eb14cc6d70c84431c4b072049cd1320ae10` matches the historical `0002_glossy_veda.sql` from commit `06718de`.
2. The repository currently contains journal entries `0000` through `0004`; `0003` introduces feasibility tables and `0004` introduces professional profiles.
3. The API production build currently calls `migrateProduction()` automatically whenever `VERCEL_ENV=production`.
4. A fresh, read-only production schema/ledger comparison and upgrade rehearsal are required before any production build containing pending migrations is promoted.
5. Never drop tables, reset the database, rewrite ledger rows, mark unapplied migrations as applied, or run `drizzle-kit push --force` against production.

## Required environment-variable names

Values must remain secret and environment-scoped where applicable.

- `DATABASE_URL`
- `DATABASE_URL_UNPOOLED` (migration connection only)
- `CORS_ORIGINS`
- `RENOVA_REGISTRATION_OPEN`
- `RENOVA_BETA_RELEASE_APPROVED`
- `RENOVA_REGISTRATION_TEST_TOKEN`
- `RENOVA_AUTH_TOKEN_SECRET` (minimum 32 characters; never expose it to the frontend)
- `RENOVA_EMAIL_PROVIDER`
- `RESEND_API_KEY`
- `RENOVA_EMAIL_FROM`
- `RENOVA_ADMIN_ENQUIRY_EMAIL`
- `RENOVA_PRODUCT_NAME`
- `RENOVA_APP_URL`
- `BLOB_STORE_ID` or `BLOB_READ_WRITE_TOKEN`
- Frontend-only flags: `VITE_RENOVA_LIVE_WORKSPACE`, `VITE_RENOVA_CONTACT_EMAIL`

## Immediate safe implementation sequence

1. Complete the opportunity/interest lifecycle and audit logging without changing the schema.
2. Reconcile and rehearse migrations against the historical production baseline before applying migration `0005`, which adds OTP attempt counters and database-backed rate-limit buckets.
3. Configure a verified sender plus staging-only email credentials, then run the controlled OTP acceptance test against a real inbox.
4. Add email outbox/delivery records, enquiry workflow tables and payment/order tables as separate reviewed migrations.
5. Keep registration and payments closed until their complete end-to-end acceptance suites pass.
