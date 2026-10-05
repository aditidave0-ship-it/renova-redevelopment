# Public registration release control

Public registration requires all of the following:

1. `RENOVA_REGISTRATION_OPEN=true` (operational kill switch).
2. A reviewed `registrationRelease` record in `artifacts/api-server/src/lib/registration-release.ts`, with every required check passed and an HTTPS evidence link.
3. `RENOVA_REGISTRATION_APPROVAL_ID` matching that record's non-empty approval ID.
4. An unexpired approval.

The initial record deliberately remains incomplete. Deploying this change closes public signup even if the old environment flag is still true. Existing login, logout and sessions continue; the existing server-side private registration test token remains available for controlled acceptance testing. Never expose that token to frontend code.

This record is a human-reviewed release attestation, not an automated browser/email test result. Evidence must identify the tested frontend/API revisions and production environment. Re-test and replace approval whenever relevant code, routing or email configuration changes. Never mark a gate passed merely to deploy. Protect main and require review of this file through repository branch rules.

After all checks pass, submit a focused release PR containing evidence, a unique approval ID and bounded expiration. Configure the matching non-secret approval ID in the API production environment, redeploy and test public registration. To close registration immediately, set the flag false and redeploy. Expired approvals fail closed until a newly reviewed approval is deployed.

Run policy tests with `node --test scripts/registration-release.test.mjs` (Node with TypeScript stripping support).
