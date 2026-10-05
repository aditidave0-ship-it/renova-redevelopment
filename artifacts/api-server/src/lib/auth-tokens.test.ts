import assert from "node:assert/strict";
import test from "node:test";
import {
  hashAuthToken,
  isUsableAuthToken,
  issueAuthToken,
} from "./auth-tokens";

test("email verification tokens are opaque, hashed, and expire after 24 hours", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  const issued = issueAuthToken("EMAIL_VERIFICATION", now);
  assert.notEqual(issued.token, issued.tokenHash);
  assert.equal(issued.tokenHash, hashAuthToken(issued.token));
  assert.equal(issued.expiresAt.toISOString(), "2026-01-02T00:00:00.000Z");
  assert.equal(
    isUsableAuthToken(
      {
        purpose: "EMAIL_VERIFICATION",
        expiresAt: issued.expiresAt,
        usedAt: null,
      },
      "EMAIL_VERIFICATION",
      now,
    ),
    true,
  );
});

test("password reset tokens expire after one hour and cannot be reused", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  const issued = issueAuthToken("PASSWORD_RESET", now);
  assert.equal(issued.expiresAt.toISOString(), "2026-01-01T01:00:00.000Z");
  assert.equal(
    isUsableAuthToken(
      { purpose: "PASSWORD_RESET", expiresAt: issued.expiresAt, usedAt: now },
      "PASSWORD_RESET",
      now,
    ),
    false,
  );
  assert.equal(
    isUsableAuthToken(
      { purpose: "PASSWORD_RESET", expiresAt: issued.expiresAt, usedAt: null },
      "PASSWORD_RESET",
      issued.expiresAt,
    ),
    false,
  );
  assert.equal(
    isUsableAuthToken(
      { purpose: "PASSWORD_RESET", expiresAt: issued.expiresAt, usedAt: null },
      "EMAIL_VERIFICATION",
      now,
    ),
    false,
  );
});
