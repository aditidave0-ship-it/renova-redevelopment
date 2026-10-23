# Controlled staging acceptance — 12 October 2026

This is **isolated local acceptance staging**, using a private filesystem-backed PostgreSQL/PGlite database. It is not the production database, a managed Neon branch, an externally reachable beta environment, or proof of production email delivery.

## Run

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm --filter @workspace/renova build
pnpm --filter @workspace/api-server test:staging
```

The runner creates a private temporary directory, applies the canonical migrations through the Drizzle migrator (including its ledger), runs actual HTTP routes, reopens the database to verify persisted records, writes sanitized evidence, and removes the temporary database/credentials on exit. PR #35 adds migration 0009, so its acceptance run expects ten migration-ledger entries. No production migration runs. Set neither `DATABASE_URL` nor `VERCEL_ENV=production`; either configuration makes the runner refuse before creating staging files or a database.

For an authorized operator's **local** browser:

```sh
pnpm --filter @workspace/api-server staging:local
```

This starts the actual built frontend and actual API on the same loopback origin. The console reports the loopback URL and the path of a private, mode-0600 fixture credentials file. Read that file locally; never paste its values into chat, logs or screenshots. Open `/platform/live?mode=login` and use the appropriate fixture. Public Create Account remains disabled. Stop with Ctrl+C to remove this disposable environment. Nothing is exposed to the Internet. This local browser procedure is documented but **was not performed by the cloud browser**.

## Verification mechanism

Society A/B, Developer, PMC and Architect/Professional fixtures are labelled `TEST ONLY`, with `example.invalid` emails and randomly generated passwords. Account creation uses the existing controlled-registration admission header; it does not open public registration or skip verification.

For every fixture, the runner:

1. Calls the actual registration endpoint.
2. Confirms login fails before verification.
3. Captures the external Resend transport response in private process memory, without sending any email.
4. Extracts its generated OTP privately and submits it to the actual verify-email endpoint.
5. Supplies the password, receives a separate sign-in OTP, and verifies that code through the real endpoint before a session is created.

No fixture is activated by writing `emailVerifiedAt`. The isolated Admin fixture also completes this flow, then receives its fixture-only role through isolated provisioning; its old session is invalidated before fresh login. ADMIN remains unavailable in public role selection. This role provisioning code lives only in the test runner and is absent from both production API bundles.

The test process refuses external database configuration, uses private generated OTP/admission secrets, removes ambient Blob/payment credentials and rejects outbound fetches except loopback API calls and captured sandbox provider calls. No production users are read, edited or activated by this runner. The external provider adapters are exercised with simulated transport, not real provider credentials.

## Actual results

Evidence: [isolated-staging-20261012.json](qa-evidence/isolated-staging-20261012.json).

| Journey                                                                             | API acceptance | Authenticated cloud browser | Managed/production acceptance |
| ----------------------------------------------------------------------------------- | -------------- | --------------------------- | ----------------------------- |
| Closed public registration; all four role sessions/profile APIs                     | PASS           | BLOCKED                     | BLOCKED                       |
| OTP generation, wrong/expired/reused codes, resend limits, verification             | PASS           | BLOCKED                     | BLOCKED                       |
| Reset token recovery, old password/session rejection                                | PASS           | BLOCKED                     | BLOCKED                       |
| Society feasibility save/reload/submit; Admin review/assessment; Society result     | PASS           | BLOCKED                     | BLOCKED                       |
| Society opportunity publication; Developer/PMC discovery/interests; Society receipt | PASS           | BLOCKED                     | BLOCKED                       |
| Contact enquiry persistence; Admin processing; acknowledgement/notification retries | PASS           | BLOCKED                     | BLOCKED                       |
| Sandbox order idempotency, signed webhook/replay checks, receipt ownership          | PASS           | BLOCKED                     | BLOCKED                       |
| Database file close/reopen preserves verified accounts and both interests           | PASS           | BLOCKED                     | BLOCKED                       |

The staging run passed **280 assertions** (91 journey/persistence + 148 auth delivery + 41 sandbox/enquiry delivery). These overlap deliberately with security acceptance; do not present their sum with the separate 332-assertion suite as unique coverage. The production/refusal guards separately passed with production environment and external database configuration. No external email or actual payment-provider transaction occurred.

## PR #35 OTP validation update — 24 October 2026

The 12 October evidence below is historical. After PR #35 introduced a second login factor, its controlled staging fixtures were updated so they no longer treat password-only login as session creation. The current isolated run also checks no session before OTP, wrong/expired/reused OTP rejection, the five-attempt cap, login rate limiting, refusal to mint OTPs through resend without a password-authenticated pending challenge, pending-code resend/cooldown, logout, password-reset session and pending-OTP invalidation, and the ten-entry migration ledger.

Latest evidence: [isolated-staging-20261024.json](qa-evidence/isolated-staging-20261024.json). The run passed 112 journey checks, 254 authentication/email-delivery checks, and 41 sandbox/enquiry-delivery checks; categories overlap and are not unique assertion totals. It used fresh local PGlite and an intercepted provider transport: **zero external emails, zero production writes, and no real gateway transactions**. It is not managed-staging, real-inbox, browser, or production evidence.

On the Windows test host, staging initially failed before running because a directory symlink to its temporary `node_modules` was not permitted. The runner now uses a Windows junction for that local test-only link; this does not change production code or deployment behavior.

## Why cloud browser acceptance remains blocked

Vercel Sandbox creation for the existing `api-server` project/team returned **403: permission to create the Vercel sandbox denied**. No local authenticated Vercel CLI is available as a scoped fallback. The local loopback server is not exposed to the separate cloud-browser environment. The existing Vercel frontend preview still routes `/api/*` to the production API, so using that preview with these fixtures would be invalid.

Managed Neon staging is also blocked at the Marketplace identity email-verification/link step. No branch, billing commitment, database deletion, production settings change or authentication bypass was used as a workaround.

## Needed next

- Grant scoped sandbox access for `api-server`, or complete the Neon identity-verification/link step and provide an authorized isolated staging branch. Then configure a staging frontend/API on the same origin and perform the four-role desktop/mobile browser acceptance.
- For external email acceptance, configure an approved staging sender and provider secrets securely: `RENOVA_AUTH_TOKEN_SECRET`, `RENOVA_EMAIL_PROVIDER`, `RESEND_API_KEY`, `RENOVA_APP_URL`, `RENOVA_PRODUCT_NAME`, `RENOVA_EMAIL_FROM`, `RENOVA_ADMIN_ENQUIRY_EMAIL`. Sandbox capture does not need a final brand/domain; actual delivered email still needs an authorized sender/inbox and explicit live-email approval.
- For actual gateway sandbox acceptance, configure `RENOVA_PAYMENTS_MODE=sandbox`, `RAZORPAY_TEST_KEY_ID`, `RAZORPAY_TEST_KEY_SECRET`, `RAZORPAY_TEST_WEBHOOK_SECRET` and explicitly approved test catalogue entries. No business price was invented.
- Production migrations remain separately approval-gated under [migration-reconciliation.md](migration-reconciliation.md), after recovery availability and repeat preflight. Keep PR #24 draft, public registration closed, and live payments disabled.
