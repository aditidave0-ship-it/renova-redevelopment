import { Router, type IRouter } from "express";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { isPublicRegistrationOpen as reviewedRegistrationOpen } from "../lib/registration-release";
import { z } from "@workspace/api-zod";
import { and, desc, eq, gt, isNull, lt, sql } from "drizzle-orm";
import {
  getDb,
  clearSession,
  createSession,
  hashPassword,
  readSession,
  verifyPassword,
} from "../lib/session";
import {
  EMAIL_OTP_MAX_ATTEMPTS,
  ensureEmailOtpConfigured,
  hashAuthToken,
  issueEmailOtp,
  isUsableAuthToken,
  issueAuthToken,
  type AuthTokenPurpose,
  verifyEmailOtpHash,
} from "../lib/auth-tokens";
import {
  getEmailBrand,
  getEmailProvider,
  passwordResetEmail,
  verificationEmail,
  welcomeEmail,
} from "../lib/email";
import {
  authRateLimitSubject,
  enforceAuthRateLimit,
  type AuthRateLimitAction,
  type AuthRateLimitPolicy,
} from "../lib/auth-rate-limit";
import { logger } from "../lib/logger";
import { requireDb } from "@workspace/db";
import {
  authSessions,
  authTokens,
  organizationMembers,
  organizations,
  professionalProfiles,
  societies,
  users,
} from "@workspace/db";
import {
  dashboardPath,
  REGISTRATION_PARTICIPANTS,
  registrationIdentity,
} from "../lib/role-policy";

const router: IRouter = Router();
const participantSchema = z.enum(REGISTRATION_PARTICIPANTS);
const emailSchema = z
  .string()
  .trim()
  .email()
  .max(320)
  .transform((email) => email.toLowerCase());
const passwordSchema = z.string().min(8).max(128);
const registrationSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: z.string().trim().min(2).max(160),
  participantType: participantSchema,
  organizationName: z.string().trim().min(2).max(220),
  location: z.string().trim().max(160).optional(),
});
const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});
const emailRequestSchema = z.object({ email: emailSchema });
const verificationOtpSchema = z.object({
  email: emailSchema,
  otp: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the six-digit code"),
});
const tokenSchema = z.object({ token: z.string().min(32).max(256) });
const resetPasswordSchema = tokenSchema.extend({ password: passwordSchema });

const AUTH_RATE_LIMITS: Record<AuthRateLimitAction, AuthRateLimitPolicy> = {
  REGISTER: { limit: 5, windowMs: 60 * 60 * 1000 },
  VERIFY_EMAIL: { limit: 10, windowMs: 10 * 60 * 1000 },
  RESEND_VERIFICATION: { limit: 3, windowMs: 60 * 60 * 1000 },
  FORGOT_PASSWORD: { limit: 5, windowMs: 60 * 60 * 1000 },
  LOGIN: { limit: 10, windowMs: 15 * 60 * 1000 },
};

function publicUser(
  user: { id: string; email: string; displayName: string; role: string },
  organizationId: string | null = null,
) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    organizationId,
    dashboardPath: dashboardPath(
      user.role as "SOCIETY" | "DEVELOPER" | "PMC" | "PROFESSIONAL" | "ADMIN",
    ),
  };
}

function hasRegistrationTestAccess(request: {
  get(name: string): string | undefined;
}): boolean {
  const expected = process.env.RENOVA_REGISTRATION_TEST_TOKEN;
  const provided = request.get("x-renova-registration-test");
  if (!expected || !provided) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(provided);
  return left.length === right.length && timingSafeEqual(left, right);
}

function isPublicRegistrationOpen(): boolean {
  return (
    reviewedRegistrationOpen(process.env) &&
    process.env.RENOVA_BETA_RELEASE_APPROVED === "true"
  );
}

function ensureEmailDeliveryConfigured(): void {
  if (
    process.env.RENOVA_EMAIL_PROVIDER?.trim().toLowerCase() !== "resend" ||
    !process.env.RESEND_API_KEY
  ) {
    const error = new Error(
      "Email delivery is waiting for sender configuration",
    );
    Object.assign(error, { status: 503, code: "EMAIL_DELIVERY_UNAVAILABLE" });
    throw error;
  }
}

async function rateLimitAuthRequest(
  database: ReturnType<typeof getDb>,
  request: { ip?: string },
  email: string,
  action: AuthRateLimitAction,
) {
  await enforceAuthRateLimit(
    database,
    action,
    authRateLimitSubject(request.ip || "unknown", "*"),
    { ...AUTH_RATE_LIMITS[action], limit: AUTH_RATE_LIMITS[action].limit * 10 },
  );
  await enforceAuthRateLimit(
    database,
    action,
    authRateLimitSubject("account", email),
    AUTH_RATE_LIMITS[action],
  );
}

async function replaceVerificationOtp(
  database: ReturnType<typeof getDb>,
  userId: string,
  cooldownMs = 0,
) {
  return database.transaction(async (tx) => {
    const [user] = await tx
      .select({ emailVerifiedAt: users.emailVerifiedAt })
      .from(users)
      .where(eq(users.id, userId))
      .for("update");
    if (!user || user.emailVerifiedAt !== null) return null;
    if (cooldownMs > 0) {
      const [latest] = await tx
        .select({ createdAt: authTokens.createdAt })
        .from(authTokens)
        .where(
          and(
            eq(authTokens.userId, userId),
            eq(authTokens.purpose, "EMAIL_VERIFICATION"),
          ),
        )
        .orderBy(desc(authTokens.createdAt))
        .limit(1);
      if (latest && latest.createdAt.getTime() > Date.now() - cooldownMs)
        return null;
    }
    const issued = issueEmailOtp(userId);
    await tx
      .delete(authTokens)
      .where(
        and(
          eq(authTokens.userId, userId),
          eq(authTokens.purpose, "EMAIL_VERIFICATION"),
          isNull(authTokens.usedAt),
        ),
      );
    await tx.insert(authTokens).values({
      userId,
      purpose: "EMAIL_VERIFICATION",
      tokenHash: issued.tokenHash,
      expiresAt: issued.expiresAt,
      failedAttempts: 0,
    });
    return issued.otp;
  });
}

async function replaceAuthToken(
  database: ReturnType<typeof getDb>,
  userId: string,
  purpose: AuthTokenPurpose,
  cooldownMs = 0,
) {
  return database.transaction(async (tx) => {
    // All credential/token mutations lock the user first. This serializes the
    // cooldown across instances and avoids user/token lock-order deadlocks.
    const [user] = await tx
      .select({
        id: users.id,
        isActive: users.isActive,
        emailVerifiedAt: users.emailVerifiedAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .for("update");
    if (
      !user ||
      (purpose === "EMAIL_VERIFICATION"
        ? user.emailVerifiedAt !== null
        : !user.isActive || user.emailVerifiedAt === null)
    )
      return null;
    if (cooldownMs > 0) {
      const [latest] = await tx
        .select({ createdAt: authTokens.createdAt })
        .from(authTokens)
        .where(
          and(eq(authTokens.userId, userId), eq(authTokens.purpose, purpose)),
        )
        .orderBy(desc(authTokens.createdAt))
        .limit(1);
      if (latest && latest.createdAt.getTime() > Date.now() - cooldownMs)
        return null;
    }
    const issued = issueAuthToken(purpose);
    await tx
      .delete(authTokens)
      .where(
        and(
          eq(authTokens.userId, userId),
          eq(authTokens.purpose, purpose),
          isNull(authTokens.usedAt),
        ),
      );
    await tx.insert(authTokens).values({
      userId,
      purpose,
      tokenHash: issued.tokenHash,
      expiresAt: issued.expiresAt,
    });
    return issued.token;
  });
}

router.post("/auth/register", async (request, response, next) => {
  try {
    const controlledTest = hasRegistrationTestAccess(request);
    if (!isPublicRegistrationOpen() && !controlledTest)
      return response
        .status(503)
        .json({ error: "Registration is not open yet" });
    ensureEmailDeliveryConfigured();
    const brand = getEmailBrand();
    const userId = randomUUID();
    const verification = issueEmailOtp(userId);
    const input = registrationSchema.parse(request.body);
    const identity = registrationIdentity(input.participantType);
    const database = getDb();
    await rateLimitAuthRequest(database, request, input.email, "REGISTER");
    const existing = await database
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, input.email))
      .limit(1);
    if (existing.length)
      return response
        .status(409)
        .json({ error: "An account with this email already exists" });
    const result = await database.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({
          id: userId,
          email: input.email,
          passwordHash: hashPassword(input.password),
          displayName: input.displayName,
          role: identity.role,
          isActive: false,
          emailVerifiedAt: null,
        })
        .onConflictDoNothing({ target: users.email })
        .returning({
          id: users.id,
          email: users.email,
          displayName: users.displayName,
          role: users.role,
        });
      if (!user) return null;
      const [organization] = await tx
        .insert(organizations)
        .values({
          name: input.organizationName,
          kind: identity.role,
          location: input.location ?? null,
        })
        .returning({ id: organizations.id });
      await tx.insert(organizationMembers).values({
        organizationId: organization.id,
        userId: user.id,
        role: identity.role,
      });
      if (identity.role === "SOCIETY")
        await tx.insert(societies).values({ organizationId: organization.id });
      if (identity.role === "PROFESSIONAL" && identity.professionalType)
        await tx.insert(professionalProfiles).values({
          organizationId: organization.id,
          specialization: identity.professionalType,
        });
      await tx.insert(authTokens).values({
        userId: user.id,
        purpose: "EMAIL_VERIFICATION",
        tokenHash: verification.tokenHash,
        expiresAt: verification.expiresAt,
        failedAttempts: 0,
      });
      return { user, organizationId: organization.id };
    });
    if (!result)
      return response
        .status(409)
        .json({ error: "An account with this email already exists" });
    await getEmailProvider(brand).send({
      to: result.user.email,
      ...verificationEmail(brand, verification.otp),
    });
    return response.status(202).json({
      message: "Enter the six-digit code sent to your email",
      email: result.user.email,
      verificationRequired: true,
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/auth/verify-email", async (request, response, next) => {
  try {
    const input = verificationOtpSchema.parse(request.body);
    ensureEmailOtpConfigured();
    const database = requireDb();
    await rateLimitAuthRequest(database, request, input.email, "VERIFY_EMAIL");
    const verified = await database.transaction(async (tx) => {
      // Issuance, verification and reset all acquire the user before token locks.
      const [user] = await tx
        .select({
          id: users.id,
          email: users.email,
          emailVerifiedAt: users.emailVerifiedAt,
        })
        .from(users)
        .where(eq(users.email, input.email))
        .for("update");
      if (!user || user.emailVerifiedAt !== null) return null;
      const [record] = await tx
        .select()
        .from(authTokens)
        .where(
          and(
            eq(authTokens.userId, user.id),
            eq(authTokens.purpose, "EMAIL_VERIFICATION"),
            isNull(authTokens.usedAt),
          ),
        )
        .orderBy(desc(authTokens.createdAt))
        .limit(1)
        .for("update");
      const now = new Date();
      if (!record || !isUsableAuthToken(record, "EMAIL_VERIFICATION", now))
        return null;
      if (!verifyEmailOtpHash(user.id, input.otp, record.tokenHash)) {
        await tx
          .update(authTokens)
          .set({
            failedAttempts: sql`${authTokens.failedAttempts} + 1`,
            lastAttemptAt: now,
          })
          .where(eq(authTokens.id, record.id));
        return null;
      }
      const [consumed] = await tx
        .update(authTokens)
        .set({ usedAt: now, lastAttemptAt: now })
        .where(
          and(
            eq(authTokens.id, record.id),
            isNull(authTokens.usedAt),
            gt(authTokens.expiresAt, now),
            lt(authTokens.failedAttempts, EMAIL_OTP_MAX_ATTEMPTS),
          ),
        )
        .returning({ id: authTokens.id });
      if (!consumed) return null;
      await tx
        .update(users)
        .set({
          isActive: true,
          emailVerifiedAt: now,
          updatedAt: now,
          credentialVersion: sql`${users.credentialVersion} + 1`,
        })
        .where(eq(users.id, user.id));
      // Legacy pre-verification sessions must not spring back into validity
      // when the account owner verifies. Activation requires a fresh login.
      await tx.delete(authSessions).where(eq(authSessions.userId, user.id));
      return user;
    });
    if (!verified)
      return response
        .status(400)
        .json({ error: "Verification code is incorrect or expired" });
    try {
      const brand = getEmailBrand();
      await getEmailProvider(brand).send({
        to: verified.email,
        ...welcomeEmail(brand),
      });
    } catch {
      logger.warn(
        { statusCode: 503 },
        "Welcome email was not accepted after verification",
      );
    }
    return response.json({
      message: "Email verified. Your account is active; you can now sign in.",
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/auth/resend-verification", async (request, response, next) => {
  try {
    ensureEmailDeliveryConfigured();
    ensureEmailOtpConfigured();
    const brand = getEmailBrand();
    const input = emailRequestSchema.parse(request.body);
    const database = requireDb();
    await rateLimitAuthRequest(
      database,
      request,
      input.email,
      "RESEND_VERIFICATION",
    );
    const [user] = await database
      .select({
        id: users.id,
        email: users.email,
        isActive: users.isActive,
        emailVerifiedAt: users.emailVerifiedAt,
      })
      .from(users)
      .where(and(eq(users.email, input.email), isNull(users.emailVerifiedAt)))
      .limit(1);
    if (user) {
      const otp = await replaceVerificationOtp(database, user.id, 60_000);
      if (otp) {
        try {
          await getEmailProvider(brand).send({
            to: user.email,
            ...verificationEmail(brand, otp),
          });
        } catch {
          /* Neutral response, no account enumeration or token logging. */
        }
      }
    }
    return response.status(202).json({
      message:
        "If an eligible unverified account exists, you will receive a verification email",
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/auth/forgot-password", async (request, response, next) => {
  try {
    ensureEmailDeliveryConfigured();
    const brand = getEmailBrand();
    const input = emailRequestSchema.parse(request.body);
    const database = requireDb();
    await rateLimitAuthRequest(
      database,
      request,
      input.email,
      "FORGOT_PASSWORD",
    );
    const [user] = await database
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(
        and(
          eq(users.email, input.email),
          eq(users.isActive, true),
          gt(users.emailVerifiedAt, new Date(0)),
        ),
      )
      .limit(1);
    if (user) {
      const token = await replaceAuthToken(
        database,
        user.id,
        "PASSWORD_RESET",
        60_000,
      );
      if (token) {
        try {
          await getEmailProvider(brand).send({
            to: user.email,
            ...passwordResetEmail(brand, token),
          });
        } catch {
          // Delivery failure must not distinguish an eligible account from an
          // unknown email. Persisted cooldown/expiry still govern later retries.
          logger.warn(
            { statusCode: 503 },
            "Password reset email was not accepted",
          );
        }
      }
    }
    return response.status(202).json({
      message:
        "If an eligible account exists, you will receive a password reset email",
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/auth/reset-password", async (request, response, next) => {
  try {
    const input = resetPasswordSchema.parse(request.body);
    const database = requireDb();
    const now = new Date();
    const [record] = await database
      .select({
        id: authTokens.id,
        userId: authTokens.userId,
        purpose: authTokens.purpose,
        expiresAt: authTokens.expiresAt,
        usedAt: authTokens.usedAt,
      })
      .from(authTokens)
      .where(eq(authTokens.tokenHash, hashAuthToken(input.token)))
      .limit(1);
    if (!record || !isUsableAuthToken(record, "PASSWORD_RESET", now))
      return response
        .status(400)
        .json({ error: "Password reset link is invalid or expired" });
    const changed = await database.transaction(async (tx) => {
      const [user] = await tx
        .select({
          isActive: users.isActive,
          emailVerifiedAt: users.emailVerifiedAt,
        })
        .from(users)
        .where(eq(users.id, record.userId))
        .for("update");
      if (!user || !user.isActive || !user.emailVerifiedAt) return false;
      const changedAt = new Date();
      const updated = await tx
        .update(authTokens)
        .set({ usedAt: changedAt })
        .where(
          and(
            eq(authTokens.id, record.id),
            isNull(authTokens.usedAt),
            gt(authTokens.expiresAt, changedAt),
          ),
        )
        .returning({ id: authTokens.id });
      if (!updated.length) return false;
      await tx
        .update(users)
        .set({
          passwordHash: hashPassword(input.password),
          credentialVersion: sql`${users.credentialVersion} + 1`,
          updatedAt: changedAt,
        })
        .where(eq(users.id, record.userId));
      await tx
        .delete(authSessions)
        .where(eq(authSessions.userId, record.userId));
      await tx
        .update(authTokens)
        .set({ usedAt: changedAt })
        .where(
          and(
            eq(authTokens.userId, record.userId),
            eq(authTokens.purpose, "PASSWORD_RESET"),
            isNull(authTokens.usedAt),
          ),
        );
      return true;
    });
    if (!changed)
      return response
        .status(400)
        .json({ error: "Password reset link is invalid or expired" });
    response.clearCookie("renova_session", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
    return response.json({
      message: "Password changed. Sign in with your new password.",
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/auth/login", async (request, response, next) => {
  try {
    const input = loginSchema.parse(request.body);
    const database = requireDb();
    await rateLimitAuthRequest(database, request, input.email, "LOGIN");
    const rows = await database
      .select({
        user: users,
        organizationId: organizations.id,
      })
      .from(users)
      .leftJoin(organizationMembers, eq(organizationMembers.userId, users.id))
      .leftJoin(
        organizations,
        eq(organizations.id, organizationMembers.organizationId),
      )
      .where(
        and(
          eq(users.email, input.email),
          eq(users.isActive, true),
          gt(users.emailVerifiedAt, new Date(0)),
        ),
      )
      .limit(1);
    const row = rows[0];
    if (!row || !verifyPassword(input.password, row.user.passwordHash))
      return response
        .status(401)
        .json({ error: "Email or password is incorrect" });
    await createSession(
      database,
      row.user.id,
      response,
      row.user.credentialVersion,
    );
    return response.json({ user: publicUser(row.user, row.organizationId) });
  } catch (error) {
    return next(error);
  }
});

router.post("/auth/logout", async (request, response, next) => {
  try {
    await clearSession(request, response);
    return response.status(204).send();
  } catch (error) {
    return next(error);
  }
});

router.get("/auth/me", async (request, response, next) => {
  try {
    const auth = await readSession(request);
    if (!auth)
      return response.status(401).json({ error: "Authentication required" });
    return response.json({
      user: { ...auth, dashboardPath: dashboardPath(auth.role) },
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
