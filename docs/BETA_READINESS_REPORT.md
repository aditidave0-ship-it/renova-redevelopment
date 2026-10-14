# RENOVA beta readiness report

Updated: 6 October 2026 (Asia/Calcutta)

## Release decision

**NOT READY FOR EXTERNAL BETA**

Public registration is fail-closed. The private registration-test token does not bypass verification or activation. External users must not be invited until every P0/P1 item below passes with production evidence.

## Evidence baseline

| Boundary | Status | Evidence |
| --- | --- | --- |
| Production website | PASS | `https://renova-lovat-mu.vercel.app/` serves the current RENOVA release. |
| Same-origin API routing | PASS | `/api/healthz`, `/api/readyz`, and `/api/opportunities` return the same production API responses as the direct API deployment. |
| PostgreSQL connectivity | PASS | `/api/readyz` returns `200 {"status":"ready"}` after executing `select 1`. |
| Database schema | PASS | The production opportunities query returns schema-backed data; production API builds run the checked-in Drizzle migration. |
| Public registration release gate | PASS | `/api/auth/register` returns `503 Registration is not open yet` unless the private test-token path is used. Public release additionally requires `RENOVA_BETA_RELEASE_APPROVED=true`. |
| Email verification | IMPLEMENTED / DELIVERY BLOCKED | Hashed 24-hour single-use tokens, send/resend API, browser verification flow, and provider abstraction are implemented. External delivery is waiting for an approved final sender domain. |
| Forgot/reset password | IMPLEMENTED / DELIVERY BLOCKED | Hashed one-hour single-use reset tokens, UI/API flow, password update, and all-session invalidation are implemented. External delivery is waiting for the sender. |
| Public enquiry storage | IMPLEMENTED / DEPLOYMENT PENDING | The form posts to a validated, rate-protected API, persists in PostgreSQL, and is available only to an authenticated ADMIN. |

## Workflow matrix

| Workflow | Status | Notes |
| --- | --- | --- |
| Registration validation | BLOCKED | Resume after verification lifecycle exists; public registration remains closed. |
| Production verification email | BLOCKED | Requires a transactional email provider, sender identity, and real test inbox. |
| Resend / expired / invalid / reused verification link | LOCAL PASS / PRODUCTION BLOCKED | Token lifecycle and unit tests pass; real delivery and browser evidence require the final sender. |
| Forgot/reset password | LOCAL PASS / PRODUCTION BLOCKED | Reset lifecycle and session invalidation are implemented; real inbox delivery is pending. |
| Enquiry/contact | LOCAL PASS / DEPLOYMENT PENDING | Server persistence and ADMIN authorization are implemented and require production migration verification. |
| Society end-to-end | BLOCKED | Must begin with verified registration. |
| Developer end-to-end | BLOCKED | Must begin with verified registration. |
| PMC end-to-end | BLOCKED | Must begin with verified registration; PMC-specific experience also requires review. |
| Cross-account persistence | BLOCKED | Run with clearly labelled accounts after account verification is available. |
| Authorization/security | BLOCKED | Existing API acceptance covers key boundaries, but the new verification/reset surfaces must be included before sign-off. |
| Desktop QA | BLOCKED | Repeat the complete verified-account journey after P1 fixes. |
| Mobile QA | BLOCKED | Repeat the complete verified-account journey after P1 fixes. |

## Required P1 work before controlled beta

1. Approve and verify the final sender domain, then configure the provider without exposing its API key.
2. Deploy the new migration and verify enquiry persistence plus ADMIN isolation in production.
3. Run the private multi-role acceptance suite with clearly labelled, email-verified test records, then remove those records after approval.
4. Repeat the browser journey on desktop and mobile using a real inbox, recording delivery time and every required negative case.

## External dependency blocker

**BLOCKED — WAITING FOR FINAL DOMAIN.** Production email cannot be truthfully verified until the product has an approved sender address/domain and a real inbox controlled by the tester. No domain purchase, DNS change, or permanent sender configuration is part of this release. Do not mark email, registration, or beta readiness as PASS before an actual production message arrives and its link succeeds.
