import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { authRateLimits, type AppDb } from "@workspace/db";

export type AuthRateLimitAction =
  | "REGISTER"
  | "VERIFY_EMAIL"
  | "RESEND_VERIFICATION"
  | "FORGOT_PASSWORD"
  | "LOGIN"
  | "PRIVACY_REQUEST"
  | "PRIVACY_VERIFY";

export type AuthRateLimitPolicy = {
  limit: number;
  windowMs: number;
};

// Single source of truth for every rate-limited action, including the
// Phase B privacy endpoints. authRateLimits.action is a varchar, so adding
// an action here needs no migration.
export const AUTH_RATE_LIMIT_POLICIES: Record<
  AuthRateLimitAction,
  AuthRateLimitPolicy
> = {
  REGISTER: { limit: 5, windowMs: 60 * 60 * 1000 },
  VERIFY_EMAIL: { limit: 10, windowMs: 10 * 60 * 1000 },
  RESEND_VERIFICATION: { limit: 3, windowMs: 60 * 60 * 1000 },
  FORGOT_PASSWORD: { limit: 5, windowMs: 60 * 60 * 1000 },
  LOGIN: { limit: 10, windowMs: 15 * 60 * 1000 },
  PRIVACY_REQUEST: { limit: 5, windowMs: 60 * 60 * 1000 },
  PRIVACY_VERIFY: { limit: 10, windowMs: 10 * 60 * 1000 },
};

export function authRateLimitSubject(ip: string, email: string): string {
  return createHash("sha256")
    .update(`${ip.trim().toLowerCase()}|${email.trim().toLowerCase()}`)
    .digest("hex");
}

export function rateLimitWindowStart(now: Date, windowMs: number): Date {
  return new Date(Math.floor(now.getTime() / windowMs) * windowMs);
}

export async function enforceAuthRateLimit(
  database: AppDb,
  action: AuthRateLimitAction,
  subjectHash: string,
  policy: AuthRateLimitPolicy,
  now = new Date(),
): Promise<void> {
  const [bucket] = await database
    .insert(authRateLimits)
    .values({
      action,
      subjectHash,
      windowStartedAt: rateLimitWindowStart(now, policy.windowMs),
      requestCount: 1,
    })
    .onConflictDoUpdate({
      target: [
        authRateLimits.action,
        authRateLimits.subjectHash,
        authRateLimits.windowStartedAt,
      ],
      set: {
        requestCount: sql`${authRateLimits.requestCount} + 1`,
        updatedAt: now,
      },
    })
    .returning({ requestCount: authRateLimits.requestCount });

  if ((bucket?.requestCount ?? policy.limit + 1) > policy.limit) {
    const error = new Error("Too many requests. Please try again later.");
    Object.assign(error, { status: 429, code: "RATE_LIMITED" });
    throw error;
  }
}
