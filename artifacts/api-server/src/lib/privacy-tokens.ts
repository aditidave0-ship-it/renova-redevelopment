import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

// NIRMAQ Phase B — privacy-request tokens.
//
// Two tokens, one request:
//   * verification token — proves the requester controls the email address.
//     Single-use, 1-hour expiry, 5 failed attempts. Issued at submission.
//   * status token — lets the requester check progress later without an
//     account. Issued when the verification token is consumed. 90-day
//     expiry, read-only, reveals only that request's own status/history.
//
// Only SHA-256 hashes are stored. A database read never reveals a token,
// and tokens are never written to logs.
export const PRIVACY_VERIFICATION_TTL_MS = 60 * 60 * 1000;
export const PRIVACY_VERIFICATION_MAX_ATTEMPTS = 5;
export const PRIVACY_STATUS_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000;

export function hashPrivacyToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function issuePrivacyToken(ttlMs: number, now = new Date()) {
  const token = randomBytes(32).toString("base64url");
  return {
    token,
    tokenHash: hashPrivacyToken(token),
    expiresAt: new Date(now.getTime() + ttlMs),
  };
}

export function verifyPrivacyTokenHash(
  token: string,
  expectedHash: string,
): boolean {
  let actual: Buffer;
  let expected: Buffer;
  try {
    actual = Buffer.from(hashPrivacyToken(token), "hex");
    expected = Buffer.from(expectedHash, "hex");
  } catch {
    return false;
  }
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function privacyReference(): string {
  return `PRV-${new Date().getUTCFullYear()}-${randomBytes(5).toString("hex").toUpperCase()}`;
}
