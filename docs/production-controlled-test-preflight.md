# Controlled-test preflight — 7 October 2026

## Production inspection (read-only)
Vercel Storage confirms Neon `neon-amber-feather` is connected to api-server Production. Read-only SQL in its Vercel Query editor returned:
- `to_regclass('public.feasibility_requests')`: ABSENT.
- credential_version columns on users/auth_sessions: 0.
- Ledger timestamps: 1790664611534, 1791224612177, 1791227498511.
- First two hashes match repository migrations 0000 and 0001.
- Third hash `17fee26d154b470f9a62ae6250575eb14cc6d70c84431c4b072049cd1320ae10` does not match any PR24 migration. Reconcile its provenance before running a production migrator. Do not rewrite/delete ledger records to hide this discrepancy.

No production writes, migration execution, credential retrieval, or release-setting changes were performed.

## Exact 0004 impact
Adds four nullable organization columns and two nullable feasibility columns. Maps ONLY NEEDS_INFORMATION to MORE_INFORMATION_REQUIRED and ASSESSED to ASSESSMENT_READY. Adds a six-status constraint. Contains no DELETE/DROP/TRUNCATE and no writes to users, sessions, tokens, societies, opportunities, interests or enquiries.
Given the observed absent feasibility table, applying 0003 then 0004 would normalize ZERO pre-existing feasibility rows. This must be rechecked immediately before execution. No live feasibility-row status query was attempted because the table is absent.
0002 and 0003 are pending based on column/table absence; 0004 is also pending. These changes are not automatically production-approved by this report.

## Non-production evidence and recovery
`node tests/migration-0004.mjs` executes real 0000–0004 SQL on isolated PGlite/PostgreSQL. Six seeded lifecycle states retain IDs, ownership, timestamps, requirements and assessment notes; only the two expected legacy statuses change. Unrelated fixture records stay intact, and additional columns are null. An unknown legacy status fails the constraint and an enclosing transaction rolls back ALL 0004 changes, including added columns.
Run production changes transactionally with an established Neon recovery point/backup. Verify recovery availability before execution. After commit, do not blindly reverse statuses: newly created ASSESSMENT_READY/MORE_INFORMATION_REQUIRED rows cannot be distinguished from normalized rows without a pre-migration ID/status inventory. Prefer forward correction or a reviewed recovery operation. Never drop populated tables/columns as an automatic rollback.

## Feasibility history fix
Creation, Society saves/submissions and Admin reviews now persist status events transactionally in audit_logs. Society history API checks organization ownership and returns only status/date fields, without exposing actor identity. Society can view history. Automated flow: SUBMITTED → IN_REVIEW → MORE_INFORMATION_REQUIRED → owner resubmission → ASSESSMENT_READY → owner reads result. Foreign Society history access returns 404.

## Remaining demonstration data
/platform/live uses API/PostgreSQL for organization/society profiles, completion, metrics, draft/published opportunities, interests and feasibility.
/dashboard/* and other /platform/* preview routes still use PlatformApp demo fixtures, visibly labelled demo data. OpportunityBuilder preparation drafts still use browser localStorage and are labelled browser-only/unpublished. These are NOT production account dashboards or persisted marketplace data. Connections and proposals are not implemented in the live workspace. No new proposal/chat/payment module was added.

## Validation
- 8 unit tests PASS.
- 96 database-backed integration assertions PASS.
- Two migration normalization/transactional failure cases PASS.
- Full workspace typechecks/frontend/API builds PASS.
- git diff --check PASS.
- Authenticated browser QA BLOCKED: preview API depends on missing production schema and verified-account/email setup. No verification bypass used.
- 375px/390px/tablet/mobile browser QA BLOCKED: current supported browser API has no viewport-resize/emulation capability. CSS has 800px and 500px responsive breakpoints; source inspection is not browser acceptance.
- External delivered verification/reset emails and links BLOCKED: final brand/domain/sender not configured. Brand/sender/application URL remain configurable.

Remaining P1 release gates: migration-ledger reconciliation and production migration/readiness; full authenticated desktop/mobile acceptance; real delivered verification/reset links. No new P0 demonstrated in these tests; this is not comprehensive production security acceptance. Public registration remains closed. Intro/founder unchanged (Aziz Parihar — Founder). Not beta-ready.
