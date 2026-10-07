import { Router, type IRouter } from "express";
import { timingSafeEqual } from "node:crypto";
import { z } from "@workspace/api-zod";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import {
  getDb,
  clearSession,
  createSession,
  hashPassword,
  readSession,
  verifyPassword,
} from "../lib/session";
import {
  hashAuthToken,
  isUsableAuthToken,
  issueAuthToken,
  type AuthTokenPurpose,
} from "../lib/auth-tokens";
import {
  getEmailBrand,
  getEmailProvider,
  passwordResetEmail,
  verificationEmail,
} from "../lib/email";
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
const tokenSchema = z.object({ token: z.string().min(32).max(256) });
const resetPasswordSchema = tokenSchema.extend({ password: passwordSchema });

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
    process.env.RENOVA_REGISTRATION_OPEN === "true" &&
    process.env.RENOVA_BETA_RELEASE_APPROVED === "true"
  );
}

function ensureEmailDeliveryConfigured(): void {
  if (
    process.env.RENOVA_EMAIL_PROVIDER?.toLowerCase() !== "resend" ||
    !process.env.RESEND_API_KEY
  ) {
    const error = new Error(
      "Email delivery is waiting for sender configuration",
    );
    Object.assign(error, { status: 503, code: "EMAIL_DELIVERY_UNAVAILABLE" });
    throw error;
  }
}

async function replaceAuthToken(
  database: ReturnType<typeof getDb>,
  userId: string,
  purpose: AuthTokenPurpose,
  cooldownMs = 0,
) {
  if (cooldownMs > 0) {
    const [latest] = await database
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
  await database.transaction(async (tx) => {
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
  });
  return issued.token;
}

router.post("/auth/register", async (request, response, next) => {
  try {
    const controlledTest = hasRegistrationTestAccess(request);
    if (!isPublicRegistrationOpen() && !controlledTest)
      return response
        .status(503)
        .json({ error: "Registration is not open yet" });
    ensureEmailDeliveryConfigured();
    const input = registrationSchema.parse(request.body);
    const identity = registrationIdentity(input.participantType);
    const database = getDb();
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
          email: input.email,
          passwordHash: hashPassword(input.password),
          displayName: input.displayName,
          role: identity.role,
          isActive: false,
          emailVerifiedAt: null,
        })
        .returning({
          id: users.id,
          email: users.email,
          displayName: users.displayName,
          role: users.role,
        });
      const [organization] = await tx
        .insert(organizations)
        .values({
          name: input.organizationName,
          kind: identity.role,
          location: input.location ?? null,
        })
        .returning({ id: organizations.id });
      await tx
        .insert(organizationMembers)
        .values({
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
      return { user, organizationId: organization.id };
    });
    const token = await replaceAuthToken(
      database,
      result.user.id,
      "EMAIL_VERIFICATION",
    );
    if (!token) throw new Error("Unable to create verification token");
    const brand = getEmailBrand();
    await getEmailProvider(brand).send({
      to: result.user.email,
      ...verificationEmail(brand, token),
    });
    return response
      .status(202)
      .json({ message: "Check your email to verify your account" });
  } catch (error) {
    return next(error);
  }
});

router.post("/auth/verify-email", async (request, response, next) => {
  try {
    const input = tokenSchema.parse(request.body);
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
    if (!record || !isUsableAuthToken(record, "EMAIL_VERIFICATION", now))
      return response
        .status(400)
        .json({ error: "Verification link is invalid or expired" });
    const consumed = await database.transaction(async (tx) => {
      const updated = await tx
        .update(authTokens)
        .set({ usedAt: now })
        .where(
          and(
            eq(authTokens.id, record.id),
            isNull(authTokens.usedAt),
            gt(authTokens.expiresAt, now),
          ),
        )
        .returning({ id: authTokens.id });
      if (!updated.length) return false;
      await tx
        .update(users)
        .set({ isActive: true, emailVerifiedAt: now, updatedAt: now })
        .where(eq(users.id, record.userId));
      return true;
    });
    if (!consumed)
      return response
        .status(400)
        .json({ error: "Verification link is invalid or expired" });
    return response.json({ message: "Email verified. You can now sign in." });
  } catch (error) {
    return next(error);
  }
});

router.post("/auth/resend-verification", async (request, response, next) => {
  try {
    ensureEmailDeliveryConfigured();
    const input = emailRequestSchema.parse(request.body);
    const database = requireDb();
    const [user] = await database
      .select({
        id: users.id,
        email: users.email,
        isActive: users.isActive,
        emailVerifiedAt: users.emailVerifiedAt,
      })
      .from(users)
      .where(eq(users.email, input.email))
      .limit(1);
    if (user && (!user.isActive || !user.emailVerifiedAt)) {
      const token = await replaceAuthToken(
        database,
        user.id,
        "EMAIL_VERIFICATION",
        60_000,
      );
      if (token) {
        const brand = getEmailBrand();
        await getEmailProvider(brand).send({
          to: user.email,
          ...verificationEmail(brand, token),
        });
      }
    }
    return response.status(202).json({
      message:
        "If an unverified account exists, a new verification email has been sent",
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/auth/forgot-password", async (request, response, next) => {
  try {
    ensureEmailDeliveryConfigured();
    const input = emailRequestSchema.parse(request.body);
    const database = requireDb();
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
        const brand = getEmailBrand();
        await getEmailProvider(brand).send({
          to: user.email,
          ...passwordResetEmail(brand, token),
        });
      }
    }
    return response.status(202).json({
      message: "If the account exists, a password reset email has been sent",
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
      const updated = await tx
        .update(authTokens)
        .set({ usedAt: now })
        .where(
          and(
            eq(authTokens.id, record.id),
            isNull(authTokens.usedAt),
            gt(authTokens.expiresAt, now),
          ),
        )
        .returning({ id: authTokens.id });
      if (!updated.length) return false;
      await tx
        .update(users)
        .set({ passwordHash: hashPassword(input.password), updatedAt: now })
        .where(eq(users.id, record.userId));
      await tx
        .delete(authSessions)
        .where(eq(authSessions.userId, record.userId));
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
    await createSession(database, row.user.id, response);
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
