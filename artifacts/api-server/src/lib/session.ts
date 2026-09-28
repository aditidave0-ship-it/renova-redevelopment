import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { Request, Response, RequestHandler } from "express";
import { and, eq, gt } from "drizzle-orm";
import { requireDb, authSessions, organizationMembers, organizations, users, type AppDb } from "@workspace/db";

export const SESSION_COOKIE = "renova_session";
const SESSION_DAYS = 14;

export type AuthContext = {
  userId: string;
  email: string;
  displayName: string;
  role: "SOCIETY" | "DEVELOPER" | "PMC" | "PROFESSIONAL" | "ADMIN";
  organizationId: string | null;
};

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, encoded: string): boolean {
  const [salt, stored] = encoded.split(":");
  if (!salt || !stored) return false;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(stored, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(database: AppDb, userId: string, response: Response): Promise<void> {
  const rawToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await database.insert(authSessions).values({ userId, tokenHash: hashToken(rawToken), expiresAt });
  response.cookie(SESSION_COOKIE, rawToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

export async function clearSession(request: Request, response: Response): Promise<void> {
  const rawToken = request.cookies?.[SESSION_COOKIE];
  if (rawToken) {
    const database = requireDb();
    await database.delete(authSessions).where(eq(authSessions.tokenHash, hashToken(rawToken)));
  }
  response.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
}

export async function readSession(request: Request): Promise<AuthContext | null> {
  const rawToken = request.cookies?.[SESSION_COOKIE];
  if (!rawToken) return null;
  const database = requireDb();
  const rows = await database
    .select({
      userId: users.id,
      email: users.email,
      displayName: users.displayName,
      role: users.role,
      organizationId: organizations.id,
    })
    .from(authSessions)
    .innerJoin(users, eq(users.id, authSessions.userId))
    .leftJoin(organizationMembers, eq(organizationMembers.userId, users.id))
    .leftJoin(organizations, eq(organizations.id, organizationMembers.organizationId))
    .where(and(eq(authSessions.tokenHash, hashToken(rawToken)), gt(authSessions.expiresAt, new Date()), eq(users.isActive, true)))
    .limit(1);
  return rows[0] ?? null;
}

export function requireAuth(): RequestHandler {
  return async (request, response, next) => {
    try {
      const auth = await readSession(request);
      if (!auth) return response.status(401).json({ error: "Authentication required" });
      request.auth = auth;
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

export function requireRole(...roles: AuthContext["role"][]): RequestHandler {
  return (request, response, next) => {
    if (!request.auth || !roles.includes(request.auth.role)) return response.status(403).json({ error: "You do not have permission for this action" });
    return next();
  };
}

export function getDb(): AppDb {
  return requireDb();
}

declare global {
  namespace Express {
    interface Request { auth?: AuthContext; }
  }
}
