import { Router, type IRouter } from "express";
import { timingSafeEqual } from "node:crypto";
import { z } from "@workspace/api-zod";
import { and, eq } from "drizzle-orm";
import { getDb, clearSession, createSession, hashPassword, readSession, verifyPassword } from "../lib/session";
import { requireDb } from "@workspace/db";
import { organizationMembers, organizations, societies, users } from "@workspace/db";

import { isPublicRegistrationOpen } from "../lib/registration-release";

const router: IRouter = Router();
const roleSchema = z.enum(["SOCIETY", "DEVELOPER", "PMC", "PROFESSIONAL"]);
const registrationSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(8).max(128),
  displayName: z.string().trim().min(2).max(160),
  role: roleSchema,
  organizationName: z.string().trim().min(2).max(220),
  location: z.string().trim().max(160).optional(),
});
const loginSchema = z.object({ email: z.string().trim().email(), password: z.string().min(1).max(128) });

function publicUser(user: { id: string; email: string; displayName: string; role: string }, organizationId: string | null = null) {
  return { id: user.id, email: user.email, displayName: user.displayName, role: user.role, organizationId };
}

function hasRegistrationTestAccess(request: { get(name: string): string | undefined }): boolean {
  const expected = process.env.RENOVA_REGISTRATION_TEST_TOKEN;
  const provided = request.get("x-renova-registration-test");
  if (!expected || !provided) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(provided);
  return left.length === right.length && timingSafeEqual(left, right);
}

router.post("/auth/register", async (request, response, next) => {
  try {
    if (!isPublicRegistrationOpen(process.env) && !hasRegistrationTestAccess(request)) {
      return response.status(503).json({ error: "Registration is not open yet" });
    }
    const input = registrationSchema.parse(request.body);
    const database = getDb();
    const existing = await database.select({ id: users.id }).from(users).where(eq(users.email, input.email.toLowerCase())).limit(1);
    if (existing.length) return response.status(409).json({ error: "An account with this email already exists" });
    const result = await database.transaction(async (tx) => {
      const [user] = await tx.insert(users).values({
        email: input.email.toLowerCase(), passwordHash: hashPassword(input.password), displayName: input.displayName, role: input.role,
      }).returning({ id: users.id, email: users.email, displayName: users.displayName, role: users.role });
      const [organization] = await tx.insert(organizations).values({ name: input.organizationName, kind: input.role, location: input.location ?? null }).returning({ id: organizations.id });
      await tx.insert(organizationMembers).values({ organizationId: organization.id, userId: user.id });
      if (input.role === "SOCIETY") await tx.insert(societies).values({ organizationId: organization.id });
      return { user, organizationId: organization.id };
    });
    await createSession(database, result.user.id, response);
    return response.status(201).json({ user: publicUser(result.user, result.organizationId) });
  } catch (error) { return next(error); }
});

router.post("/auth/login", async (request, response, next) => {
  try {
    const input = loginSchema.parse(request.body);
    const database = requireDb();
    const rows = await database.select({ user: users, organizationId: organizations.id }).from(users)
      .leftJoin(organizationMembers, eq(organizationMembers.userId, users.id))
      .leftJoin(organizations, eq(organizations.id, organizationMembers.organizationId))
      .where(and(eq(users.email, input.email.toLowerCase()), eq(users.isActive, true))).limit(1);
    const row = rows[0];
    if (!row || !verifyPassword(input.password, row.user.passwordHash)) return response.status(401).json({ error: "Email or password is incorrect" });
    await createSession(database, row.user.id, response);
    return response.json({ user: publicUser(row.user, row.organizationId) });
  } catch (error) { return next(error); }
});

router.post("/auth/logout", async (request, response, next) => {
  try { await clearSession(request, response); return response.status(204).send(); } catch (error) { return next(error); }
});

router.get("/auth/me", async (request, response, next) => {
  try {
    const auth = await readSession(request);
    if (!auth) return response.status(401).json({ error: "Authentication required" });
    return response.json({ user: auth });
  } catch (error) { return next(error); }
});

export default router;
