# Production migration reconciliation

The previously unmatched ledger hash 17fee26d154b470f9a62ae6250575eb14cc6d70c84431c4b072049cd1320ae10 exactly matches lib/db/drizzle/0002_glossy_veda.sql at repository commit 06718dedd8558058b1b5a83ccdfa6017ebe58fe9. Its production ledger timestamp is 1791227498511. This is repository-history divergence, not an unknown SQL operation.

## Current production baseline
Read-only inspection on 7 October: 0000 and 0001 ledger hashes match; third entry matches the historical profile migration. Feasibility table and credential-version columns are absent. Detailed profile-table/column/constraint inspection still required to confirm complete historical migration application.

## Historical migration
Creates developer_profiles and pmc_profiles, adds opportunity_interests.review_status and ten Society profile fields, adds profile organization foreign keys. Its hash must be preserved. These profile tables/data must not be dropped or replaced by generic organization fields.

## Proposed reconciliation
Recover the original SQL and journal/snapshot from 06718ded; reconcile PR24 with the repository branch containing that migration and its profile schema/UI. Preserve the existing production ledger. Append pending credential-version, feasibility foundation and participant-feasibility migrations after the historical profile migration, with unique journal identifiers. Validate a full replay and an upgrade from the historical production baseline before execution. Do not merely renumber ledger rows or mark pending changes applied.

## Data impact
No production change executed. Pending 0002 credential-version adds two default-zero columns; 0003 creates feasibility_requests; current 0004 adds six nullable fields and maps two legacy statuses. Current production has no feasibility rows/table, so zero pre-existing statuses would change after foundation creation, subject to immediate preflight recheck. Historical profile data must remain intact.

## Recovery
Verify Neon recovery/backup availability first. Use transactional migration execution. Capture schema, ledger, row counts and affected feasibility IDs/statuses before execution. Fail safely on unexpected statuses or duplicate columns. No automatic DROP/reset/recreate or production history editing. Post-commit reverse status normalization is ambiguous for newly created rows; prefer reviewed forward correction/recovery.

## Release
Production migration is not yet approved/safe to execute: historical schema comparison, branch reconciliation and upgrade rehearsal remain. Request explicit approval only after those gates and concrete impact report are complete. Registration remains closed.
