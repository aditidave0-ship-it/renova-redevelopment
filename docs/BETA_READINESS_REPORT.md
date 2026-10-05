# RENOVA beta readiness report

Updated: 5 October 2026 (Asia/Calcutta)

## Release decision

**NOT READY FOR EXTERNAL BETA**

Public registration is fail-closed. Controlled acceptance can continue through the private registration-test token, but external users must not be invited until every P0/P1 item below passes with production evidence.

## Evidence baseline

| Boundary | Status | Evidence |
| --- | --- | --- |
| Production website | PASS | `https://renova-lovat-mu.vercel.app/` serves the current RENOVA release. |
| Same-origin API routing | PASS | `/api/healthz`, `/api/readyz`, and `/api/opportunities` return the same production API responses as the direct API deployment. |
| PostgreSQL connectivity | PASS | `/api/readyz` returns `200 {"status":"ready"}` after executing `select 1`. |
| Database schema | PASS | The production opportunities query returns schema-backed data; production API builds run the checked-in Drizzle migration. |
| Public registration release gate | PASS | `/api/auth/register` returns `503 Registration is not open yet` unless the private test-token path is used. Public release additionally requires `RENOVA_BETA_RELEASE_APPROVED=true`. |
| Email verification | FAIL (P1) | No verification-token schema, send/resend endpoint, verification endpoint, or production delivery integration exists. Registration previously activated and signed in users immediately. |
| Forgot/reset password | FAIL (P1) | No forgot-password, reset-token, or reset-password endpoint/UI exists. |
| Public enquiry storage | FAIL (P1) | The contact/network form stores submissions only in browser `localStorage`; RENOVA administrators cannot reliably receive or review them. |

## Workflow matrix

| Workflow | Status | Notes |
| --- | --- | --- |
| Registration validation | BLOCKED | Resume after verification lifecycle exists; public registration remains closed. |
| Production verification email | BLOCKED | Requires a transactional email provider, sender identity, and real test inbox. |
| Resend / expired / invalid / reused verification link | BLOCKED | Token lifecycle is not implemented. |
| Forgot/reset password | FAIL (P1) | Missing implementation. |
| Enquiry/contact | FAIL (P1) | Current success state is local-only and can be mistaken for server acceptance. |
| Society end-to-end | BLOCKED | Must begin with verified registration. |
| Developer end-to-end | BLOCKED | Must begin with verified registration. |
| PMC end-to-end | BLOCKED | Must begin with verified registration; PMC-specific experience also requires review. |
| Cross-account persistence | BLOCKED | Run with clearly labelled accounts after account verification is available. |
| Authorization/security | BLOCKED | Existing API acceptance covers key boundaries, but the new verification/reset surfaces must be included before sign-off. |
| Desktop QA | BLOCKED | Repeat the complete verified-account journey after P1 fixes. |
| Mobile QA | BLOCKED | Repeat the complete verified-account journey after P1 fixes. |

## Required P1 work before controlled beta

1. Provision a transactional email provider and verified sender (or an explicitly approved test sender).
2. Add hashed, expiring, single-use email-verification and password-reset tokens.
3. Prevent unverified accounts from authenticating; implement verification, resend, forgot-password, and reset-password UI/API flows.
4. Store enquiries in PostgreSQL, add server-side validation and rate protection, and expose them only to RENOVA administrators.
5. Run the private multi-role acceptance suite with clearly labelled test records, then remove those records after approval.
6. Repeat the browser journey on desktop and mobile using a real inbox, recording delivery time and every required negative case.

## External dependency blocker

Production email cannot be truthfully verified until RENOVA has an approved transactional email provider configuration, sender address/domain, and a real inbox controlled by the tester. Do not mark email, registration, or beta readiness as PASS before an actual production message arrives and its link succeeds.
