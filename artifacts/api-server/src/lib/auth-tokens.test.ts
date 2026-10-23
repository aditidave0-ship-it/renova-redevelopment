import assert from "node:assert/strict";
import test from "node:test";
import {
  EMAIL_OTP_MAX_ATTEMPTS,
  hashEmailOtp,
  hashAuthToken,
  issueEmailOtp,
  isUsableAuthToken,
  issueAuthToken,
  verifyEmailOtpHash,
  issueLoginOtp,
  verifyLoginOtpHash,
} from "./auth-tokens";

test("email verification OTPs are six digits, HMAC protected, and expire after 10 minutes", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  const issued = issueEmailOtp("user-123", now, "test-secret");
  assert.match(issued.otp, /^\\d{6}$/);
  assert.notEqual(issued.otp, issued.tokenHash);
  assert.equal(
    issued.tokenHash,
    hashEmailOtp("user-123", issued.otp, "test-secret"),
  );
  assert.equal(issued.expiresAt.toISOString(), "2026-01-01T00:10:00.000Z");
  assert.equal(
    verifyEmailOtpHash("user-123", issued.otp, issued.tokenHash, "test-secret"),
    true,
  );
  assert.equal(
    verifyEmailOtpHash(
      "other-user",
      issued.otp,
      issued.tokenHash,
      "test-secret",
    ),
    false,
  );
  assert.equal(
    isUsableAuthToken(
      {
        purpose: "EMAIL_VERIFICATION",
        expiresAt: issued.expiresAt,
        usedAt: null,
        failedAttempts: EMAIL_OTP_MAX_ATTEMPTS - 1,
      },
      "EMAIL_VERIFICATION",
      now,
    ),
    true,
  );
  assert.equal(
    isUsableAuthToken(
      {
        purpose: "EMAIL_VERIFICATION",
        expiresAt: issued.expiresAt,
        usedAt: null,
        failedAttempts: EMAIL_OTP_MAX_ATTEMPTS,
      },
      "EMAIL_VERIFICATION",
      now,
    ),
    false,
  );
});

test("login OTPs are six digits, purpose-bound, and expire after five minutes", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  const issued = issueLoginOtp("user-456", now, "test-secret");
  assert.match(issued.otp, /^\\d{6}$/);
  assert.equal(issued.expiresAt.toISOString(), "2026-01-01T00:05:00.000Z");
  assert.equal(verifyLoginOtpHash("user-456", issued.otp, issued.tokenHash, "test-secret"), true);
  assert.equal(verifyLoginOtpHash("other-user", issued.otp, issued.tokenHash, "test-secret"), false);
  assert.equal(isUsableAuthToken({ purpose: "LOGIN_OTP", expiresAt: issued.expiresAt, usedAt: null, failedAttempts: 4 }, "LOGIN_OTP", now), true);
  assert.equal(isUsableAuthToken({ purpose: "LOGIN_OTP", expiresAt: issued.expiresAt, usedAt: null, failedAttempts: 5 }, "LOGIN_OTP", now), false);
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
