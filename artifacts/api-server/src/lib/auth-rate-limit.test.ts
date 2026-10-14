import assert from "node:assert/strict";
import test from "node:test";
import { authRateLimitSubject, rateLimitWindowStart } from "./auth-rate-limit";

test("auth rate-limit subjects do not persist raw IP or email values", () => {
  const subject = authRateLimitSubject("203.0.113.9", "Person@Example.com");
  assert.match(subject, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(subject, /Person|Example|203/);
  assert.equal(
    subject,
    authRateLimitSubject("203.0.113.9", "person@example.com"),
  );
});

test("rate-limit windows are stable time buckets", () => {
  const start = rateLimitWindowStart(
    new Date("2026-01-01T00:14:59.999Z"),
    15 * 60 * 1000,
  );
  assert.equal(start.toISOString(), "2026-01-01T00:00:00.000Z");
});
