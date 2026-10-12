# Production migration reconciliation — 12 October 2026

**CODE VERIFIED. Production execution is not approved and has not occurred.**

The apparent unmatched ledger entry is the original `0002_glossy_veda.sql`, hash `17fee26d154b470f9a62ae6250575eb14cc6d70c84431c4b072049cd1320ae10`, timestamp `1791227498511`. Restoring the canonical Codex migration lineage resolves the repository divergence. **No production ledger edits, renumbering or marking unapplied migrations as applied are needed.**

The active history now preserves canonical migrations 0000–0006. Credential versions append as 0007; sandbox billing and enquiry delivery jobs append as 0008. The divergent, never-applied PR24 credential/generic feasibility migrations are archived under `tests/fixtures/legacy-pr24` and excluded from the active Drizzle journal. Do not run those fixture SQL files against production.

Read-only production evidence:

- [Schema/ledger export](qa-evidence/production-schema-ledger-20261012.json), checked 09:52 UTC.
- [Indexes, enums and aggregate counts](qa-evidence/production-schema-impact-20261012.json), checked 10:45 UTC.
- All three ledger hashes/timestamps, 12 existing tables, columns/types/defaults/nullability, indexes, enums and foreign-key/unique constraints match the canonical 0000–0002 baseline. PostgreSQL-version-specific NOT NULL constraint catalogue entries are compared through column nullability.
- Aggregate production counts: 11 users, 11 organizations, 7 societies, 5 opportunities, 4 interests, 10 sessions, zero auth tokens, enquiries, developer profiles and PMC profiles. No personal rows, password hashes, session values or credentials were retrieved.
- Production has no feasibility tables, professional profiles, OTP rate buckets or credential-version columns.

## Exact pending impact

| Migration | Change | Existing data impact |
|---|---|---|
| 0003_remarkable_stephen_strange | Six feasibility tables, status/document enums, ownership/history/assessment foreign keys and indexes | New objects; no existing feasibility rows to transform |
| 0004_bouncy_cerise | Professional profiles and specialization enum; nullable membership role | Additive; existing membership roles remain NULL, with current account-role fallback; no status normalization |
| 0005_concerned_tattoo | OTP attempt/last-attempt fields; persisted quota buckets/indexes | Adds defaults/nullable columns; zero existing auth-token rows at audit |
| 0006_familiar_jack_murdock | Enquiry Admin assignment/closure fields, FK/index | Additive; zero existing enquiries at audit |
| 0007_nifty_cloak | Credential-version columns on users and sessions | Adds default-zero values to 11 users/10 sessions; preserves every existing field; subsequent password reset increments the version and invalidates stale sessions |
| 0008_spotty_morg | Enquiry email jobs; sandbox catalogue, orders, webhook events and receipts | Five new tables only; catalogue starts empty; no prices seeded; live/production payments remain blocked |

There are no DROP, TRUNCATE, DELETE, UPDATE, INSERT/backfill or status-remapping statements in the pending migrations. Foreign-key ON DELETE clauses describe future constraints, not deletion performed by migration. Full SQL hashes are in the rehearsal evidence.

## Rehearsal and preservation

`node artifacts/api-server/tests/migration-reconciliation.mjs` passes in isolated PostgreSQL/PGlite:

- Production schema/ledger/index/enum comparison against canonical historical replay.
- Synthetic rows in every existing table, including profiles, enquiries, sessions, tokens, interests and audit history, retain all existing field values after upgrade.
- Forced failure after pending DDL rolls the full transaction back to the original baseline.
- A clean full replay yields the same schema as the baseline upgrade.
- New credential versions default to zero.

[Rehearsal evidence](qa-evidence/migration-rehearsal-20261012.json). This is not production migration verification or proof of Neon recovery availability.

## Execution and recovery boundary

Before any production execution: confirm the final reviewed commit/migration hashes; repeat the read-only preflight; verify Neon recovery/backup/restore-branch availability; obtain explicit owner approval for the six pending migrations. Stop on schema drift, an unexpected ledger/hash or unexpected existing feasibility objects. Do not change the ledger to suppress a mismatch.

Use the existing Drizzle migration runner against the approved production target with server-side credentials. Existing ledger entries must remain intact. Verify transaction semantics and recovery before starting. After execution, compare the ledger, all schema objects and aggregate counts, run readiness/auth/authorization acceptance, and keep registration closed throughout. After commit, prefer reviewed forward correction or verified provider recovery to blind reverse migrations that could drop new data.

Neon console currently requests email verification to link the Vercel Marketplace identity, so recovery capacity and isolated staging-branch setup remain BLOCKED. Vercel access works through the approved browser; the API database connection is Production-only. No production migrations, environment/authentication changes, DNS changes, purchases or billing commitments were made.
