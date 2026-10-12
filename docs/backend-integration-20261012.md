# RENOVA controlled backend integration — 12 October 2026

**Keep PR #24 DRAFT. CODE VERIFIED; staging/production acceptance BLOCKED. Registration CLOSED, payments SANDBOX-only. No production writes or settings changed.**

## Integration strategy and branch audit

Audited all remote branches and ten open PRs. Current `main` is `fc5f454`, not the old base SHA shown on PR24 metadata. Recovery baseline `866469d` and the standing instructions at `17a3ad3` are preserved.

| PR/branch | Disposition |
|---|---|
| #24 controlled-beta foundations | Continue the existing draft; preserve credential-version reset/session protection, eligibility checks, transactional cooldowns, atomic enquiry quota and side-effect-free builds |
| #25 approved local intro, merged | Preserve local MP4 and intro component byte-for-byte against main; no replacement or animation changes |
| #26 UX consolidation | Reuse the existing homepage, navigation, cream/navy workspace and canonical route redirects. Adapt only account/profile/feasibility/opportunity API contracts; do not start another redesign |
| #28 secure OTP, based on Society feasibility | Reuse existing HMAC OTP infrastructure, canonical profiles, rich feasibility workflow and historical schema; add locking, eligibility and configuration-preflight regressions |
| #29 enquiry workflow | Reuse audited Admin filters, assignment/status/history and templates; add durable delivery jobs and protected retry/status endpoints |
| #30 opportunity lifecycle | Reuse publish/close/withdraw/review endpoints; restore Society-owned draft detail; prevent stale edit/publication/review races and return factual duplicate-interest 409 |
| #22 release control | Reuse reviewed readiness/evidence/approval/expiry policy. All current acceptance checks remain false; historical pre-verification API evidence cannot authorize release |
| #19 older dashboard theme | Leave separate; superseded by the canonical #26 application experience. Do not merge the obsolete demo dashboard implementation |
| #21 pre-verification API acceptance | Historical evidence only. Retire the obsolete 201-registration runner before it can write new production records or be mistaken for OTP/browser acceptance |
| #20/#27 regulatory updates | Keep separate review scope; do not overwrite their branches or merge regulatory content during backend stabilization |

External Codex branches remain unchanged/open. [Branch inventory](qa-evidence/branch-inventory-20261012.json). Imported #26 screenshots/reports remain historical and do not count as newly authenticated dashboard proof.

## Working code and remaining activation gates

| Backend module | Code | Staging/production | Next action |
|---|---|---|---|
| Shared registration/role routing | WORKING | BLOCKED | Approved isolated staging DB and actual inbox-verified controlled accounts; keep public gate closed |
| OTP generation/hash/expiry/attempt limits/resend | WORKING | BLOCKED | Configure approved staging sender/provider/origin and server token secret; exercise actual delivered OTP |
| Welcome and forgot/reset email templates/provider | WORKING | BLOCKED | Real delivery, inbox timings and link/reset acceptance; simulated provider is not delivery proof |
| Password reset/session invalidation | WORKING | BLOCKED | Deploy approved schema and verify with real staging sessions; stale credential-version sessions fail |
| Society/Developer/PMC/Professional profiles | WORKING | BLOCKED | Real verified browser sessions; profile visibility/private credentials checked in isolated API tests |
| Society feasibility/Admin assessment/status history | WORKING | BLOCKED | Pending canonical schema and an authorized verified Admin; private Blob upload additionally requires configured storage |
| Draft/edit/preview/publish/close opportunities | WORKING | BLOCKED | Authenticated staging browser and persistence checks |
| Developer/PMC interests and Society review | WORKING | BLOCKED | Authenticated staging multi-role browser acceptance; duplicate/withdrawn/stale operations tested server-side |
| Contact/enquiry persistence and Admin intake | WORKING | BLOCKED | Apply reviewed schema, verify real staging submissions/Admin receipt; forms never substitute localStorage |
| Enquiry acknowledgement/Admin notifications/retries | WORKING | BLOCKED | Real email credentials/approved Admin destination; protected Admin processor handles due jobs. Scheduled retry runner NOT STARTED/configured |
| Sandbox catalogue/checkout/orders | WORKING | BLOCKED | Explicit approved sandbox prices and authorized Razorpay Test credentials. Catalogue starts empty; no business prices invented |
| Sandbox signed webhooks/receipts | WORKING | BLOCKED | Configure a Test-mode provider webhook and exercise real sandbox transaction/replay. Receipts are test-only, not tax invoices |
| Production migration activation | BLOCKED | BLOCKED | Verify recovery access, repeat preflight and obtain explicit approval of the six pending migrations |
| Live payments/public beta | NOT STARTED | BLOCKED | Explicitly outside this release |

Enquiry creation, audit and two delivery jobs commit together. Missing sender configuration or provider failures do not undo a saved enquiry. Jobs retain queue/retry/acceptance/manual-review status and provider IDs; no OTP/reset secrets are stored in this outbox. Resend idempotency keys remain stable across retries. After bounded retries/provider retention, manual review prevents silent duplicate sending. ACCEPTED means provider acceptance, not inbox delivery.

Sandbox order amounts/currency come exclusively from the Admin-configured database catalogue and are snapshotted at creation. Checkout is idempotent; uncertain provider creation requires reconciliation rather than blind retries. Webhooks validate original bytes, deduplicate event IDs/digests, validate order/amount/currency and fetch the payment through Test credentials before marking paid. Client callbacks cannot mark paid. The module rejects live keys and Vercel Production. No live provider account, purchase or actual transaction was created.

## Production observations and exact blockers

Read-only Vercel/Neon inspection worked through the already approved browser. Connector project access remains limited; this is not a blanket browser-access failure.

- Canonical 0000–0002 production schema/ledger/indexes/enums match. Six pending migrations 0003–0008 are additive, preserve existing fields and pass isolated upgrade/rollback rehearsal. [Exact impact/recovery plan](migration-reconciliation.md).
- API database is connected to **Production only**. RENOVA frontend storage shows Preview/Production, but this is not proof of an isolated API staging DB.
- Frontend `/api/*` still rewrites to the production API. A frontend preview therefore cannot prove this branch's new backend. Route an authorized staging frontend to its corresponding isolated staging API before end-to-end testing.
- Neon console asks for email verification to link the Vercel Marketplace identity. Recovery availability, branch capacity and isolated staging provisioning remain unverified; no paid upgrade or branch deletion was attempted.
- Production has **zero active verified accounts and zero active verified Admins**. Existing users/organizations were not modified or activated. New verification-enforcing code will reject unverified legacy sessions until the owners legitimately verify their email. Do not fabricate verified production users.
- Environment **names inspected only**: database variables plus `RENOVA_REGISTRATION_OPEN` and `RENOVA_REGISTRATION_TEST_TOKEN`; the sender/provider/OTP and sandbox configuration below is absent. No values revealed or changed.

Required secure staging configuration (names only): `DATABASE_URL`, `RENOVA_AUTH_TOKEN_SECRET`, `RENOVA_EMAIL_PROVIDER`, `RESEND_API_KEY`, `RENOVA_PRODUCT_NAME`, `RENOVA_APP_URL`, `RENOVA_EMAIL_FROM`, `RENOVA_ADMIN_ENQUIRY_EMAIL`. Sender/origin and controlled inbox must be approved; no final domain/DNS dependency is hardcoded and no domain was purchased. Sandbox additionally needs `RENOVA_PAYMENTS_MODE=sandbox`, `RAZORPAY_TEST_KEY_ID`, `RAZORPAY_TEST_KEY_SECRET`, `RAZORPAY_TEST_WEBHOOK_SECRET`; never supply live keys. Keep registration release flags/attestation closed.

Owner actions/approvals still needed: complete Neon email verification; authorize any new legal/billing/account-link commitment if presented; approve the final reviewed production migration plan only after recovery/preflight; identify an existing approved staging sender/provider route and controlled inbox; explicitly authorize the verified Admin identity/role setup; provide sandbox provider credentials securely if gateway acceptance is wanted. Never paste secrets or inbox passwords into chat.

## Verification scope

Frozen install (pnpm 11.25.0), 43 API unit tests, 4 frontend contract tests, 6 release-policy tests, 300-assertion isolated PostgreSQL/PGlite security/integration suite, production-baseline migration comparison/full replay/upgrade/preservation/forced rollback, workspace typechecks and frontend/API builds pass. API build with Production labels and `DATABASE_URL` unset performs no migration. The post-merge hook likewise no longer pushes schema. Existing tooltip sourcemap and API bundle-size warnings remain non-blocking.

The integration suite exercises eight signup participants with the real server/database and a simulated external provider, secure reset/session races, Society/Developer/PMC/Professional profiles, credential visibility, draft/publish/interest/withdrawal/ownership, feasibility/Admin/history, enquiry quotas/persistence/retries and sandbox callbacks/receipts. Synthetic fixtures are labelled TEST ONLY and never written to production. A successful isolated provider simulation is not an actual email/gateway test.

Approved intro SHA-256: `c69721da150630c3a4295583c2883ccd14ed51cc0891474486b301e209837745`. Component matches main exactly; active frontend has no CloudFront/Clideo URL. Production browser observed local video source, muted autoplay/no controls, natural completion and Skip Intro. Latest-preview responsive/intro evidence and deployment checks are recorded separately after publishing. Desktop-browser frames are layout checks, not physical-device tests.

No known P0 reproduced in tested code paths. P1 release blockers remain: schema/staging activation, real delivery/verification/recovery, legitimate verified/Admin sessions and complete authenticated desktop/mobile acceptance. No merge, production activation or beta-readiness claim.

Provider implementation references: [Razorpay order creation](https://razorpay.com/docs/api/orders/create/), [raw webhook signatures/replay/order handling](https://razorpay.com/docs/webhooks/validate-test/), [Test-key payment lookup](https://razorpay.com/docs/api/payments/fetch-with-id/), [Resend idempotency](https://resend.com/changelog/idempotency-keys).
