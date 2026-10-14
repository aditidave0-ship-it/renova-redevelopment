# Domain-independent milestone — code checkpoint

Public registration remains closed. Email verification is mandatory. No domain/DNS, intro, payments, chat or proposals changed.

## Migrations

Production ledger has not been inspected; pending migration status must be confirmed against the deployed database before running anything.

| Migration | Classification | Effect |
| --- | --- | --- |
| 0002 credential versions | Additive, authentication-affecting | Adds session/user credential versions; requires coordinated API deployment |
| 0003 feasibility foundation | Additive | Creates private requests, ownership foreign keys and indexes |
| 0004 participant feasibility | Additive plus data-affecting normalization/constraint | Adds optional profile/property fields; maps NEEDS_INFORMATION to MORE_INFORMATION_REQUIRED and ASSESSED to ASSESSMENT_READY; constrains status values |

No drops, truncations or record deletion. 0004 may fail if unrecognized legacy statuses exist; inspect status counts first. Take provider snapshot/backup and apply in a transaction through authorized migration tooling. Never remove the constraint or delete records just to force migration success. All four migrations are exercised in isolated PostgreSQL-compatible integration tests; production application remains BLOCKED/unperformed.

## Implemented

Eight public participant labels map to four existing server roles. Professional specialization is organization-scoped metadata; it grants no extra permissions. ADMIN remains absent from signup and rejected by the existing registration schema. One email/password/session system remains; authenticated role determines the existing workspace. Organization membership schema remains compatible with future multi-organization selection; selection is not implemented.

Profiles support self-reported services, credentials and portfolio text. Professional users remain in their own profile/workspace, not Developer/PMC/Society views. These claims are not verified credentials.

Feasibility supports saved incomplete DRAFTs, reload/edit/review, validated submission, admin review, more-information requests, resubmission, assessment-ready and closed status. Owner/status predicates enforce writes atomically. Admin queue excludes private drafts. Document upload/storage is NOT supported and the UI says so. No feasibility calculations or regulatory conclusions are generated.

Existing opportunity draft/publish and interest tests remain in the suite. Existing founder text is Aziz Parihar — Founder, RENOVA; no additional biography or Aditi role.

## Remaining gates

Validation: 8 unit tests and 88 database-backed integration assertions PASS. Full workspace typecheck/build PASS. All 10 incremental GitHub blobs matched the tested checkout. Vercel frontend preview reached Ready. Desktop browser navigation confirmed eight role options (no ADMIN), Continue to account details, shared Sign in and Forgot password states. This is limited unauthenticated desktop UI evidence, not full authenticated/mobile QA.

- BLOCKED: Production ledger/migrations and deployed multi-role testing.
- BLOCKED: Real email delivery and link exercise, waiting for final brand/domain/sender plus an authorized test inbox.
- CODE IMPLEMENTED: Separate role-selection/account-details steps, then existing email-verification flow and role-specific profile onboarding. Browser acceptance remains pending.
- NOT COMPLETE: Full desktop/mobile visual and interaction QA; builds/typechecks are not browser evidence.
- NOT COMPLETE: Document uploads and richer portfolio document verification.

This checkpoint is not beta approval. Product/sender/origin configuration remains independent of final domain. Do not merge/deploy until migration coordination and review; do not enable release flags.
