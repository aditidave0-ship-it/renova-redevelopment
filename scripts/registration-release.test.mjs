import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPublicRegistrationOpen, requiredChecks } from '../artifacts/api-server/src/lib/registration-release.ts';
const now = Date.parse('2026-10-05T00:00:00Z');
const env = { RENOVA_REGISTRATION_OPEN: 'true', RENOVA_REGISTRATION_APPROVAL_ID: 'reviewed-trial-1' };
const ready = () => ({ approvalId: 'reviewed-trial-1', expiresAt: '2026-10-12T00:00:00Z', checks: Object.fromEntries(requiredChecks.map(k => [k, { passed: true, evidence: 'https://github.com/example/project/pull/1' }])) });
test('production record stays closed even with open environment flag', () => assert.equal(isPublicRegistrationOpen(env), false));
test('requires explicit flag and matching reviewed approval', () => {
 for (const e of [{}, { ...env, RENOVA_REGISTRATION_OPEN: 'false' }, { ...env, RENOVA_REGISTRATION_APPROVAL_ID: 'other' }]) assert.equal(isPublicRegistrationOpen(e, ready(), now), false);
});
test('every required gate must pass and have evidence', () => {
 for (const k of requiredChecks) {
  const r = ready(); r.checks[k].passed = false; assert.equal(isPublicRegistrationOpen(env, r, now), false);
  r.checks[k].passed = true; r.checks[k].evidence = ''; assert.equal(isPublicRegistrationOpen(env, r, now), false);
  delete r.checks[k]; assert.equal(isPublicRegistrationOpen(env, r, now), false);
 }
});
test('invalid or expired approval closes registration', () => {
 for (const expiresAt of ['', 'invalid', '2026-10-05T00:00:00Z']) assert.equal(isPublicRegistrationOpen(env, { ...ready(), expiresAt }, now), false);
});
test('rejects insecure evidence URLs', () => {
 for (const evidence of ['http://example.com', 'https://secret@example.com']) {
  const r=ready(); r.checks.emailVerification.evidence=evidence; assert.equal(isPublicRegistrationOpen(env,r,now),false);
 }
});
test('complete reviewed evidence permits deliberate activation', () => assert.equal(isPublicRegistrationOpen(env,ready(),now),true));
