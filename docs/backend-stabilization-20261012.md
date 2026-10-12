# RENOVA backend stabilization — PR #24

12 October 2026. Continues the existing draft `fix/controlled-beta-foundations` from `ae3d30d15bfe53c982098e62eee839eca640a03f`. No new backend architecture, frontend redesign or production activation.

## Changes and reproduced defects

- **P1 — account reactivation through verification:** an unused verification token for a previously verified but disabled account returned 200 and reactivated it. The regression failed before the fix. Verification now locks/rechecks the user, rejects previously verified accounts and never reactivates them. Resend excludes verified accounts. Password reset also rejects disabled/unverified accounts.
- **P1 — feasibility response disappears from Admin queue:** saving additional information while `MORE_INFORMATION_REQUIRED` changed the status to `DRAFT`. The regression failed before the fix. A save retains the current editable status; explicit resubmission moves it to `SUBMITTED`. Data and history remain transactionally persisted and organization-scoped.
- **Authentication cooldown race hardening:** user row locking puts eligibility, cooldown and token replacement in one transaction. Verification/reset use the same user-first lock order. This avoids competing email links and user/token lock-order inversion. Token expiry is rechecked at consumption after obtaining the lock. Hashes, expiry, single-use and credential-version session invalidation remain intact.
- **Account enumeration / partial creation:** resend provider failures now return the same neutral response as unknown addresses. Sender/origin validation happens before registration writes, so invalid configuration does not leave a newly created account behind. No delivery success is claimed by these changes.
- **Enquiry race hardening:** the existing fingerprint/hour limit is checked and inserted under a PostgreSQL transaction-scoped advisory lock. Eight concurrent local submissions produce five stored enquiries and three 429 responses. The original single-engine stress run also passed, so this is an inspection-found race-hardening change, not a reproduced multi-instance production incident. It retains the existing email-plus-IP fingerprint policy and is not a general bot-protection system.
- **P1 — implicit production migration authority:** `build.mjs` previously invoked the migrator whenever `VERCEL_ENV=production`. That invocation is removed. A build can no longer authorize database writes based on its environment alone. The existing migration helper remains for a separate explicitly approved operation; no migration was run against production.

## Validation

| Check | Result | Evidence / scope |
| --- | --- | --- |
| Frozen install | PASS | `pnpm install --frozen-lockfile`; no dependency or lockfile change. |
| API unit tests | PASS | 8 unit/API-surface tests. |
| Database-backed security/workflow suite | PASS | Latest run: 199 assertions through real local HTTP routes and isolated PostgreSQL/PGlite. Count can vary by one because concurrent old-password login may finish before or after reset; either permissible outcome is checked. |
| Controlled registration → verification → login | PASS | Society, Developer, PMC, Professional; no session before verification; reused token rejected; role follows server record. All accounts labelled TEST ONLY in isolated memory. |
| Email provider integration | PASS | Only external provider delivery is simulated in-process; authentication/database responses are real. Six concurrent resends/reset requests send one template; cooldown expiry permits replacement; replaced verification link fails. Known/unknown and provider-error responses stay neutral. No external email or real provider credential used. |
| Reset/session security | PASS | Existing multi-session and stale-credential/concurrent-login tests preserved; disabled account reset/verification rejected. |
| Society draft/interest/ownership | PASS | Existing draft save/reload/edit/publish, Developer/PMC interests, Society receipt and cross-organization tests pass locally. |
| Feasibility response/review/history | PASS | Response save stays visible in Admin queue; resubmission and owner-only status history pass. |
| Enquiry persistence/Admin authorization/quota | PASS | Local API → database → Admin read, unauthorized Admin read rejection and concurrent quota checks. |
| Migration 0004 regression | PASS | Isolated legacy-schema rehearsal preserves unrelated records; unknown status causes full rollback. This is not ledger reconciliation or permission to apply production migrations. |
| API/frontend typechecks and builds | PASS | Both pass; existing bundle-size and tooltip source-map warnings remain non-blocking. |
| Production-labelled local API build | PASS | `env -u DATABASE_URL VERCEL_ENV=production pnpm --filter @workspace/api-server build` passes without importing/running a migration. This is a local build, not a production deployment. |
| Production health/routing probes | PASS | 12 October: healthz 200, readyz 200; safe raw evidence linked below. Readiness only covers the already deployed schema. |
| Public production registration closed | PASS | Fresh empty registration request returns 503. No successful public/test registration performed in production. Existing release flags unchanged. |
| Production organization/feasibility activation | BLOCKED | Fresh endpoints return JSON 404. PR #24 remains draft; history/schema reconciliation and approved migration execution are pending. |
| Production email verification/reset delivery | BLOCKED | Fresh forgot-password request returns 503 “Email delivery is not configured yet.” Final brand/origin/sender/provider and real inbox acceptance are pending. |
| Authenticated production/browser/mobile acceptance | BLOCKED | No legitimate verified controlled role sessions available; no production verification bypass introduced. |

## Remaining release gates

The current connection still exposes no linked Vercel projects. It cannot freshly inspect production database credentials/schema/ledger or project settings. The earlier ledger mismatch was identified in `docs/migration-reconciliation.md` as a historical profile migration; its schema and branch compatibility still require reconciliation and upgrade rehearsal. Migrations 0002–0004 are not approved for production. No migration files, schema definitions or ledger entries changed in this pass.

The fresh GitHub check also reports PR #24 as not mergeable against current main (`26a9d6b2aad140fd56d513ae8c87161bd62f7d5e`). Branch reconciliation must preserve main's existing profile schema/API, approved intro and website work. This pass appends focused backend fixes to the existing head; it does not overwrite main or resolve those wider conflicts speculatively.

The existing two-flag public registration gate was not replaced or opened in this pass. Reviewed readiness-policy integration remains a separate release gate; successful local controlled registration must not be interpreted as approval for public signup.

Next: obtain authorized read access, refresh schema/ledger evidence, reconcile historical profile schema and migration history, prepare the concrete recovery/impact plan and request explicit approval before production changes. Then deploy the reviewed backend, configure authorized email delivery and run actual delivered verification/reset plus multi-role desktop/mobile acceptance.

No frontend/intro files, production authentication settings, environment configuration, domain/DNS, paid infrastructure or production records were modified. Keep PR #24 draft and public registration closed. No beta/production readiness claim.

Fresh safe production probes: [backend-production-probes-20261012.json](qa-evidence/backend-production-probes-20261012.json). HTTP bodies are limited to status/error/message; no credentials, cookies or tokens are included.
