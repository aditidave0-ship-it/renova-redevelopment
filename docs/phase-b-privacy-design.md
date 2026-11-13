# NIRMAQ Phase B — Privacy Design

Phase B closes the Phase A gap: Phase A sent `consent: true` with enquiries
but the `enquiries` table had no consent fields and there was no consent
ledger — a checkbox is not a persistent record. This branch makes consent a
server-side, versioned, append-only record, adds data-subject request
workflows with identity verification, an Admin privacy queue, server-side
18+ attestation, and configurable retention with dry-run reporting only.

Brand: **NIRMAQ** for all new copy. No wholesale rebrand in this PR; the repo
name and production URL are unchanged.

## 1. Consent ledger + server-side enforcement

- Table `privacy_consent_events` (append-only; no `updated_at`). Columns:
  `subject_type` (`ENQUIRY` | `ACCOUNT`), `subject_id`, `email`, `purpose`,
  `consent_version`, `action` (`GIVEN` | `WITHDRAWN`), `actor`, `metadata`,
  `created_at`. A withdrawal is a new event; nothing updates or deletes an
  event.
- Version: `CONSENT_VERSION = "v1"` (`artifacts/api-server/src/lib/consent-policy.ts`).
  Purpose for enquiries: `ENQUIRY_RESPONSE`.
- Enforcement: `POST /enquiries` requires `consent: true` (zod literal) and
  writes the consent event in the **same transaction** as the enquiry insert
  — either both persist or neither does. There is no code path that accepts
  an enquiry without a consent record.
- Admin visibility: `GET /admin/enquiries/:id/consent` returns the enquiry's
  consent events (Admin only).

## 2. Privacy request APIs + identity verification

Tables: `privacy_requests` + `privacy_request_events` (append-only audit
trail; every submission, verification, status change, note, hold and
fulfilment is an event). Verification and status tokens are stored as
**SHA-256 hashes only**; raw tokens are never stored or logged.

Endpoints (`artifacts/api-server/src/routes/privacy.ts`):

| Endpoint | Auth | Behaviour |
| --- | --- | --- |
| `POST /privacy/requests` | public, rate-limited | Submit ACCESS / CORRECTION / DELETION. Unauthenticated → `IDENTITY_PENDING` + a 1-hour verification link by email (5 attempts). Authenticated + own email → verified by session, straight to `SUBMITTED`. Duplicate open request (same email + type) returns the existing reference; a pending identity check gets a fresh token instead of a second row. Returns 202. |
| `POST /privacy/requests/:reference/verify` | public, rate-limited | Consumes the emailed token, issues a 90-day status token, moves the request to `SUBMITTED`. Wrong token → 400 and the attempt is recorded. Already verified → 409. |
| `GET /privacy/requests/:reference/status?token=` | public (status token) | Request + subject-visible history only. Admin notes and hold bookkeeping are never exposed here. Missing/invalid token → 401. |
| `GET /privacy/requests/me` | session | The caller's own requests. |
| `GET /admin/privacy-requests` | ADMIN | Queue, filters (`status`, `type`, `search`), limit 250. Token hashes are never returned. |
| `GET /admin/privacy-requests/:id` | ADMIN | Detail + full audit history. |
| `PATCH /admin/privacy-requests/:id` | ADMIN | Status transitions, holds, notes — one transaction, audit event + `audit_logs` entry each. |
| `POST /admin/privacy-requests/:id/notes` | ADMIN | Admin note (audit event). |
| `POST /admin/privacy-requests/:id/verify` | ADMIN | Out-of-band verification when the verification email cannot be delivered (email is blocked in production until a sender domain is approved). The Admin must record **how** identity was verified; the note is part of the audit trail. Issues a status token for the requester. |

Status machine (`src/lib/privacy-policy.ts`):

```
IDENTITY_PENDING → SUBMITTED → IN_REVIEW ⇄ MORE_INFORMATION_REQUIRED
    → FULFILLED | REJECTED → CLOSED
```

Only the listed transitions are legal (`assertPrivacyStatusTransition`,
409 on an illegal move). `IDENTITY_PENDING` and `SUBMITTED` are system
states — an Admin cannot set them directly. **Fulfilment is a recorded Admin
decision, not automated deletion or erasure**: erasure happens out-of-band
until retention periods are approved.

Rate limits (`src/lib/auth-rate-limit.ts`, single source of truth
`AUTH_RATE_LIMIT_POLICIES`; `auth_rate_limits.action` is a varchar, so no
migration was needed): `PRIVACY_REQUEST` 5/hour per email (50/hour per IP),
`PRIVACY_VERIFY` 10/10 min per reference (100/10 min per IP).

## 3. Request history + Admin controls

- `privacy_request_events` is the complete privacy audit history for a
  request. It extends — not replaces — the existing `audit_logs` table: the
  Admin PATCH also writes an `audit_logs` entry (`PRIVACY_REQUEST_UPDATED`,
  `PRIVACY_REQUEST_VERIFIED`, `PRIVACY_REQUEST_NOTE_ADDED`), so privacy
  actions appear in the platform-wide audit trail too.
- Org isolation: the queue and detail endpoints are Admin-only
  (`requireAuth` + `requireRole("ADMIN")`); non-admin roles get 403,
  unauthenticated callers get 401. Requests are keyed by email + reference,
  never by organisation — a requester sees only their own request via their
  token or session.

## 4. Server-side 18+ attestation

- `registrationSchema` gains required `ageAttestation: z.literal(true)`.
  A registration without it is rejected (400). **No date of birth or ID
  documents are collected.**
- `user_attestations` row (`attestation_type: AGE_18_PLUS`,
  `attestation_version: v1`, `source: REGISTRATION`) is inserted in the
  **same transaction** as the user + organisation + verification token, so a
  user cannot exist without the attestation. Unique on
  (`user_id`, `attestation_type`).
- `GET /auth/attestations/me` returns the caller's attestations.
- Frontend (fixed in this branch, `artifacts/renova/src/platform/LiveWorkspace.tsx`):
  the registration form shows an 18+ attestation checkbox — "I confirm I am
  18 years of age or older and I am creating a NIRMAQ account." — and sends
  `ageAttestation: true` with the registration payload. The checkbox is
  `required`, so the browser blocks submission while it is unchecked; the
  server still rejects any payload without the field (400). Registration
  stays closed anyway (the fail-closed gate is untouched), so this only takes
  effect when public registration is opened.

## 5. Retention config + dry-run reporting

- Table `privacy_retention_policies`: one row per `data_category`
  (`ENQUIRY`, `AUTH_TOKEN`, `AUTH_SESSION`, `AUDIT_LOG`,
  `FEASIBILITY_DOCUMENT`, `PRIVACY_REQUEST`); `retention_days` null means
  "retain until manual review". Admin-only CRUD:
  `GET/POST/PATCH /admin/retention/policies`.
- `GET /admin/retention/dry-run` (Admin only) reports, per category, total
  rows, eligible rows (older than the active policy), and held rows.
  **`deletedRows` is always 0** — this endpoint never deletes anything.
  Deletion requires owner + legal approval of the retention periods and is a
  separate, explicitly approved change.
- Erasure safety: a request with a `holdReason` (legal / financial /
  security) is excluded from eligibility and **cannot be fulfilled**
  (`assertFulfillable`, 409) while the hold is active. Holds are applied and
  released by an Admin (`PATCH` with `holdReason` / `holdReleased: true`);
  both are audit events.

## 6. Email

- Two templates in `src/lib/email.ts`: `privacyRequestVerificationEmail`
  (link `${appUrl}/privacy?reference=…&token=…`, 1-hour expiry, token also
  in the text body) and `privacyRequestStatusEmail`. Both HTML-escaped.
- Sending is **best-effort everywhere**: a failed send is logged (reference
  only, never the address or a token) and never blocks the request or the
  status change. Brand flows from `getEmailBrand()` (env-driven product
  name) — no hardcoded brand strings in the templates.
- Note: email delivery is blocked in production until a sender domain is
  approved — that is why the out-of-band Admin verification endpoint exists.

## 7. Failure behaviour when the privacy schema is not migrated

If the Phase B tables are not yet applied (see
`docs/phase-b-migration-plan.md`), privacy endpoints and `POST /enquiries`
return **503 `PRIVACY_TEMPORARILY_UNAVAILABLE`** instead of a 500 with SQL
detail (`isPrivacySchemaUnavailable` in `src/lib/privacy-policy.ts`,
mirroring the safe-503 pattern used for OTP verification failures). The
enquiry transaction rolls back, so nothing is half-saved.

**Deployment blocker: do not deploy this branch's code to any environment
until migration `0010` is applied there.** The code and the migration land
together.

**Migration status: provisional.** Migration `0010` stays provisional — no
numbered migration file, no journal change, no finalisation, no deployment —
until PR #35's `0009` is merged and the migration journal is reconciled (see
`docs/phase-b-migration-plan.md` for the finalisation steps). No production
migration execution under any circumstances without the owner's explicit
approval for the concrete reviewed plan.

## 8. Testing

- Unit (`pnpm --filter @workspace/api-server test`): policy machine,
  fulfilment guards, token issue/verify, references — in
  `src/lib/privacy-policy.test.ts` and `src/lib/privacy-tokens.test.ts`.
- Privacy integration (`pnpm --filter @workspace/api-server test:privacy`):
  `tests/privacy.integration.ts` — fresh PGlite, journal migrations +
  provisional `0010`, journal guard (no `0010` entry), consent enforcement
  incl. the failure path, submit/duplicate/verify/status, Admin queue +
  transitions + holds, 18+ attestation, retention dry-run, RBAC negatives.
  Email is intercepted, never sent.
- Full integration (`test:integration`) and staging (`test:staging`) apply
  the provisional SQL as well, because the enquiry route now depends on the
  consent table; both are updated to stop applying it once `0010` is a real
  migration.

## 9. Security considerations

- **Consent — versioned, append-only, withdrawable.** `privacy_consent_events`
  is append-only (no `updated_at`); a withdrawal is a new `WITHDRAWN` event,
  never an edit or delete, so the full history survives withdrawal. Consent
  is versioned (`CONSENT_VERSION = "v1"`); a future version change is a new
  version string, not a rewrite. Enforcement is server-side: `POST /enquiries`
  requires `consent: true` and writes the consent event in the same
  transaction as the enquiry — there is no code path that processes an
  enquiry without a consent record. The frontend checkbox is presentation
  only; the ledger is the record.
- **Privacy tokens — hashed, short-lived, attempt-limited.** Verification and
  status tokens are stored as **SHA-256 hashes only** (`hashPrivacyToken`,
  `src/lib/privacy-tokens.ts`); raw tokens are never stored or logged, and a
  database read can never reveal one. Comparison uses `timingSafeEqual`.
  Verification tokens are single-use, expire after **1 hour**, and allow
  **5 failed attempts** before the request must be re-issued. Status tokens
  expire after **90 days** and grant read-only access to one request's status
  and subject-visible history only — Admin notes and hold bookkeeping are
  never exposed through them. A missing or invalid status token returns 401.
  Tokens are rate-limited (`PRIVACY_REQUEST` 5/hour per email,
  `PRIVACY_VERIFY` 10/10 min per reference). Email links carry the token in
  the URL only for the verification step; the token is never written to
  `audit_logs` or application logs (only the request reference is logged).
- **Admin access — ADMIN-only, session-checked, hashes never returned.**
  Every Admin privacy endpoint (`/admin/privacy-requests/*`,
  `/admin/retention/*`, `GET /admin/enquiries/:id/consent`) is behind
  `requireAuth()` + `requireRole("ADMIN")`; non-admin roles get 403 and
  unauthenticated callers get 401 (verified by RBAC-negative integration
  tests). Admin responses never include token hashes — the queue and detail
  endpoints return references, statuses and audit history only. Out-of-band
  verification (`POST /admin/privacy-requests/:id/verify`) exists because
  email delivery is blocked in production until a sender domain is approved;
  the Admin must record **how** identity was verified, and that note is part
  of the audit trail — it is not a silent bypass.
- **Audit logs — append-only, no sensitive data.** Every privacy-request
  event (submission, verification, status change, note, hold, fulfilment) is
  recorded in append-only `privacy_request_events`, and Admin actions also
  write a platform-wide `audit_logs` entry (`PRIVACY_REQUEST_UPDATED`,
  `PRIVACY_REQUEST_VERIFIED`, `PRIVACY_REQUEST_NOTE_ADDED`). Audit rows are
  never updated or deleted by application code. No passwords, OTPs, tokens,
  token hashes, ID documents or dates of birth are ever logged — the 18+
  attestation collects no DOB or ID documents at all, only the boolean
  declaration recorded in `user_attestations`. Fulfilment is a recorded Admin
  decision, not automated deletion: held requests (legal / financial /
  security) cannot be fulfilled while the hold is active, and the retention
  dry-run endpoint only counts rows (`deletedRows` is always 0).

## 10. Out of scope for this PR

Merging #31/#35/#37 (no merge authorisation); production preflight / Neon
verification; README doc-error fixes (10-minute OTP, localStorage claim);
`push-force` script removal; frontend Admin privacy UI; orval codegen
regeneration; the seven programme docs (filenames to be confirmed for the NIRMAQ era); PR #33's diff
(separate PR, not copied).
