import assert from "node:assert/strict";
import test from "node:test";
import {
  PRIVACY_STATUS_TOKEN_TTL_MS,
  PRIVACY_VERIFICATION_TTL_MS,
  hashPrivacyToken,
  issuePrivacyToken,
  privacyReference,
  verifyPrivacyTokenHash,
} from "./privacy-tokens";

test("issuing a privacy token returns a token, its hash and an expiry", () => {
  const now = new Date("2026-11-09T12:00:00.000Z");
  const issued = issuePrivacyToken(PRIVACY_VERIFICATION_TTL_MS, now);
  assert.equal(typeof issued.token, "string");
  assert.ok(issued.token.length >= 32);
  assert.equal(issued.tokenHash, hashPrivacyToken(issued.token));
  assert.equal(
    issued.expiresAt.getTime(),
    now.getTime() + PRIVACY_VERIFICATION_TTL_MS,
  );
});

test("a status token expires later than a verification token", () => {
  assert.ok(PRIVACY_STATUS_TOKEN_TTL_MS > PRIVACY_VERIFICATION_TTL_MS);
});

test("token verification accepts the issued token and rejects anything else", () => {
  const { token, tokenHash } = issuePrivacyToken(PRIVACY_VERIFICATION_TTL_MS);
  assert.equal(verifyPrivacyTokenHash(token, tokenHash), true);
  assert.equal(verifyPrivacyTokenHash("not-the-token", tokenHash), false);
  assert.equal(verifyPrivacyTokenHash(token, "0".repeat(64)), false);
  assert.equal(verifyPrivacyTokenHash(token, "not-a-hash"), false);
});

test("privacy references are unique and carry the PRV prefix", () => {
  const first = privacyReference();
  const second = privacyReference();
  assert.match(first, /^PRV-\d{4}-[0-9A-F]{10}$/);
  assert.notEqual(first, second);
});
