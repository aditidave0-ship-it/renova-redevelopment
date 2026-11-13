# NIRMAQ Phase B — Migration Plan (provisional)

Status: **provisional**. This plan, and the SQL it points to, must be finalised
before any environment runs the Phase B code against a real database.

## The rule

Main has migrations `0000`–`0008`. PR #35 (Email OTP, open, draft) adds
`0009_email_login_otp`. Phase B **must not** create a numbered migration that
collides with `0009`, and must not touch the migration journal or any
historical migration hash.

**Decision: option (b) from the Phase B brief.** No numbered Phase B migration
file exists in this branch and the journal is unchanged. The Phase B schema
ships as a clearly-marked **provisional** file plus Drizzle schema definitions,
and is documented here with the exact steps to finalise it.

## What is in this branch

| Item | Path | Purpose |
| --- | --- | --- |
| Drizzle schema | `lib/db/src/schema/index.ts` (`privacyConsentEvents`, `privacyRequests`, `privacyRequestEvents`, `userAttestations`, `privacyRetentionPolicies` + 4 enums) | Source of truth for the new tables; the provisional SQL was diffed against `drizzle-kit generate` output and is statement-identical (25 statements). |
| Provisional SQL | `lib/db/drizzle/provisional/0010_privacy_phase_b.sql` | The exact SQL that becomes migration `0010` once `0009` lands. 4 `CREATE TYPE` + 5 `CREATE TABLE` + 7 FK `ALTER`s + 9 indexes, in Drizzle `--> statement-breakpoint` format. |
| Journal guard | `artifacts/api-server/tests/privacy.integration.ts` | Asserts the journal contains **no** `0010` entry before applying the journal + the provisional file. |

## Finalisation steps (do these in order, in a separate change)

1. **Resolve PR #31** (database recovery) and **PR #35** (`0009`) first, and
   agree the migration baseline with the owner. Do not finalise Phase B
   migrations before that baseline is agreed.
2. Once `0009` is merged on main, generate the real migration:
   `pnpm --filter @workspace/db db:generate` (or the repo's equivalent
   drizzle-kit command). Confirm the generated file is `0010_*` and that its
   statements match `lib/db/drizzle/provisional/0010_privacy_phase_b.sql`
   (same 25 statements; only the tag/filename may differ).
3. Move the generated file into `lib/db/drizzle/` (the journal gains the
   `0010` entry through the normal generate flow) and **delete**
   `lib/db/drizzle/provisional/0010_privacy_phase_b.sql`.
4. Update the three test harnesses that currently apply the provisional file
   (`artifacts/api-server/tests/privacy.integration.ts`,
   `artifacts/api-server/tests/security.integration.ts`,
   `artifacts/api-server/tests/staging.ts`) to stop applying it — the journal
   will then apply `0010` like any other migration. Remove the journal guard
   assertion from the privacy integration test (or invert it: assert `0010`
   **is** present).
5. Rehearse the upgrade in a fresh isolated PostgreSQL/PGlite database first
   (the integration suites already do this), then in staging. **No production
   migration without the owner's explicit approval for the concrete reviewed
   plan** (repo standing rule).

## Deployment dependency — read this before deploying this branch

The enquiry route now writes a consent event in the same transaction as the
enquiry. That is the Phase B contract: **no consent record = no processing**.
Until migration `0010` is applied to an environment:

- `POST /enquiries` returns **503 `PRIVACY_TEMPORARILY_UNAVAILABLE`** (the
  transaction rolls back; nothing is half-saved).
- Every `/privacy/*` and `/admin/privacy-requests/*` endpoint returns the
  same **503** instead of a 500 with SQL detail.

So **do not deploy this branch's code to any environment until `0010` is
applied there**. The code and the migration land together; neither is safe
alone. This is stated in the PR body as a deployment blocker.

## What this plan does not do

- No production database changes, no production migration, no edits to
  migration history or hashes.
- No change to the production baseline (last verified `0000`–`0002`) — that
  is PR #31's work, by the authorised operator, not this branch.
- No automated deletion: the retention dry-run endpoint only counts rows.
  Deletion requires owner + legal approval of the retention periods and is a
  separate, explicitly approved change.
