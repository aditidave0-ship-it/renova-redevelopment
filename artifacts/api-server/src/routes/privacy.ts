import { Router, type IRouter } from "express";
import { z } from "@workspace/api-zod";
import {
  and,
  count,
  desc,
  eq,
  ilike,
  isNull,
  lt,
  or,
  sql,
} from "drizzle-orm";
import {
  auditLogs,
  authSessions,
  authTokens,
  enquiries,
  feasibilityDocuments,
  privacyRequestEvents,
  privacyRequests,
  privacyRetentionPolicies,
  requireDb,
} from "@workspace/db";
import { readSession, requireAuth, requireRole } from "../lib/session";
import {
  enforceAuthRateLimit,
  authRateLimitSubject,
  AUTH_RATE_LIMIT_POLICIES,
  type AuthRateLimitAction,
} from "../lib/auth-rate-limit";
import {
  ADMIN_SETTABLE_STATUSES,
  PRIVACY_REQUEST_STATUSES,
  PRIVACY_REQUEST_TYPES,
  PRIVACY_TERMINAL_STATUSES,
  RETENTION_CATEGORIES,
  assertFulfillable,
  assertPrivacyStatusTransition,
  isPrivacySchemaUnavailable,
  type PrivacyRequestStatus,
  type RetentionCategory,
} from "../lib/privacy-policy";
import {
  PRIVACY_STATUS_TOKEN_TTL_MS,
  PRIVACY_VERIFICATION_MAX_ATTEMPTS,
  PRIVACY_VERIFICATION_TTL_MS,
  hashPrivacyToken,
  issuePrivacyToken,
  privacyReference,
  verifyPrivacyTokenHash,
} from "../lib/privacy-tokens";
import {
  getEmailBrand,
  getEmailProvider,
  privacyRequestStatusEmail,
  privacyRequestVerificationEmail,
} from "../lib/email";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------
const privacyRequestSubmitSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .max(320)
    .transform((value) => value.toLowerCase()),
  type: z.enum(PRIVACY_REQUEST_TYPES),
  details: z.string().trim().min(2).max(2000).optional(),
});
const privacyVerifySchema = z.object({
  token: z.string().min(32).max(256),
});
const privacyStatusQuerySchema = z.object({
  // Optional here on purpose: a missing token is an authentication failure
  // (401), not a validation failure (400).
  token: z.string().min(32).max(256).optional(),
});
const adminPrivacyRequestQuerySchema = z.object({
  status: z.enum(PRIVACY_REQUEST_STATUSES).optional(),
  type: z.enum(PRIVACY_REQUEST_TYPES).optional(),
  search: z.string().trim().min(1).max(160).optional(),
});
const adminPrivacyRequestUpdateSchema = z
  .object({
    status: z.enum(ADMIN_SETTABLE_STATUSES).optional(),
    note: z.string().trim().min(2).max(2000).optional(),
    holdReason: z.string().trim().min(2).max(500).optional(),
    holdReleased: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.status !== undefined ||
      value.note !== undefined ||
      value.holdReason !== undefined ||
      value.holdReleased !== undefined,
    "Provide at least one privacy request update",
  )
  .refine(
    (value) => !(value.holdReason !== undefined && value.holdReleased),
    "Set a hold reason or release the hold, not both",
  );
const adminPrivacyNoteSchema = z.object({
  note: z.string().trim().min(2).max(2000),
});
const adminPrivacyVerifySchema = z.object({
  note: z.string().trim().min(2).max(2000),
});
const retentionPolicyCreateSchema = z.object({
  dataCategory: z.enum(RETENTION_CATEGORIES),
  retentionDays: z.number().int().min(0).max(36500).nullable(),
  description: z.string().trim().min(2).max(2000).optional(),
  legalBasis: z.string().trim().min(2).max(2000).optional(),
});
const retentionPolicyUpdateSchema = z
  .object({
    retentionDays: z.number().int().min(0).max(36500).nullable().optional(),
    description: z.string().trim().min(2).max(2000).nullable().optional(),
    legalBasis: z.string().trim().min(2).max(2000).nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.retentionDays !== undefined ||
      value.description !== undefined ||
      value.legalBasis !== undefined ||
      value.isActive !== undefined,
    "Provide at least one retention policy update",
  );

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function rateLimitPrivacyRequest(
  database: ReturnType<typeof requireDb>,
  request: { ip?: string },
  subject: string,
  action: "PRIVACY_REQUEST" | "PRIVACY_VERIFY",
) {
  const policy = AUTH_RATE_LIMIT_POLICIES[action];
  await enforceAuthRateLimit(
    database,
    action,
    authRateLimitSubject(request.ip || "unknown", "*"),
    { ...policy, limit: policy.limit * 10 },
  );
  await enforceAuthRateLimit(
    database,
    action,
    authRateLimitSubject("account", subject),
    policy,
  );
}

type PrivacyRequestRow = typeof privacyRequests.$inferSelect;
type PrivacyRequestEventRow = typeof privacyRequestEvents.$inferSelect;

function publicRequestView(row: PrivacyRequestRow) {
  return {
    id: row.id,
    reference: row.reference,
    email: row.email,
    type: row.type,
    status: row.status,
    details: row.details,
    underHold: row.holdReason !== null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    resolvedAt: row.resolvedAt,
    closedAt: row.closedAt,
  };
}

function adminRequestView(row: PrivacyRequestRow) {
  const now = new Date();
  const verificationStatus =
    row.verificationUsedAt !== null
      ? "VERIFIED"
      : row.verificationExpiresAt !== null &&
          row.verificationExpiresAt.getTime() <= now.getTime()
        ? "EXPIRED"
        : row.verificationTokenHash !== null
          ? "PENDING"
          : "NONE";
  return {
    ...publicRequestView(row),
    requesterUserId: row.requesterUserId,
    verificationStatus,
    verificationAttempts: row.verificationAttempts,
    holdReason: row.holdReason,
    holdByUserId: row.holdByUserId,
    resolvedByUserId: row.resolvedByUserId,
  };
}

// Events the requester may see. Admin notes and hold bookkeeping stay
// admin-only; the requester sees the lifecycle of their own request.
const SUBJECT_VISIBLE_ACTIONS = new Set([
  "SUBMITTED",
  "VERIFICATION_SENT",
  "VERIFIED",
  "STATUS_CHANGED",
  "FULFILLED",
  "REJECTED",
  "CLOSED",
  "MORE_INFORMATION_REQUIRED",
]);

function subjectEventView(event: PrivacyRequestEventRow) {
  return {
    id: event.id,
    action: event.action,
    createdAt: event.createdAt,
  };
}

function adminEventView(event: PrivacyRequestEventRow) {
  return {
    id: event.id,
    actorUserId: event.actorUserId,
    actorType: event.actorType,
    action: event.action,
    note: event.note,
    metadata: event.metadata,
    createdAt: event.createdAt,
  };
}

async function recordRequestEvent(
  tx: Parameters<
    Parameters<ReturnType<typeof requireDb>["transaction"]>[0]
  >[0],
  event: {
    requestId: string;
    actorUserId?: string | null;
    actorType: "SUBJECT" | "ADMIN" | "SYSTEM";
    action: string;
    note?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  const [row] = await tx
    .insert(privacyRequestEvents)
    .values({
      requestId: event.requestId,
      actorUserId: event.actorUserId ?? null,
      actorType: event.actorType,
      action: event.action,
      note: event.note ?? null,
      metadata: event.metadata ?? {},
    })
    .returning({ id: privacyRequestEvents.id });
  return row;
}

async function recordAudit(
  tx: Parameters<
    Parameters<ReturnType<typeof requireDb>["transaction"]>[0]
  >[0],
  entry: {
    actorUserId?: string | null;
    action: string;
    entityId: string;
    metadata: Record<string, unknown>;
  },
) {
  await tx.insert(auditLogs).values({
    actorUserId: entry.actorUserId ?? null,
    action: entry.action,
    entityType: "PRIVACY_REQUEST",
    entityId: entry.entityId,
    metadata: JSON.stringify(entry.metadata),
  });
}

// Email is best-effort everywhere in this module: a failed send is logged
// (without the address or any token) and never blocks the request itself.
async function sendVerificationEmail(
  email: string,
  reference: string,
  token: string,
): Promise<boolean> {
  try {
    const brand = getEmailBrand();
    await getEmailProvider(brand).send({
      to: email,
      ...privacyRequestVerificationEmail(brand, reference, token),
    });
    return true;
  } catch {
    logger.warn(
      { reference },
      "Privacy verification email was not accepted",
    );
    return false;
  }
}

async function sendStatusEmail(
  email: string,
  reference: string,
  status: string,
): Promise<boolean> {
  try {
    const brand = getEmailBrand();
    await getEmailProvider(brand).send({
      to: email,
      ...privacyRequestStatusEmail(brand, reference, status),
    });
    return true;
  } catch {
    logger.warn({ reference }, "Privacy status email was not accepted");
    return false;
  }
}

// ---------------------------------------------------------------------------
// Public: submit a privacy request
// ---------------------------------------------------------------------------
router.post("/privacy/requests", async (request, response, next) => {
  try {
    const input = privacyRequestSubmitSchema.parse(request.body);
    const database = requireDb();
    await rateLimitPrivacyRequest(
      database,
      request,
      input.email,
      "PRIVACY_REQUEST",
    );
    // An authenticated requester asking about their own account is already
    // identified by their session — no email round-trip is needed.
    let session: Awaited<ReturnType<typeof readSession>> = null;
    try {
      session = await readSession(request);
    } catch {
      session = null;
    }
    const selfRequest =
      session !== null &&
      session.email.toLowerCase() === input.email.toLowerCase();

    const result = await database.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(privacyRequests)
        .where(
          and(
            eq(privacyRequests.email, input.email),
            eq(privacyRequests.type, input.type),
            sql`${privacyRequests.status} NOT IN (${sql.join(
              PRIVACY_TERMINAL_STATUSES.map((status) => sql`${status}`),
              sql`, `,
            )})`,
          ),
        )
        .orderBy(desc(privacyRequests.createdAt))
        .limit(1);
      if (existing) {
        // Duplicate protection: one open request per email + type. A pending
        // identity check gets a fresh verification token instead of a
        // second row; any other open request is returned as-is.
        if (existing.status === "IDENTITY_PENDING") {
          const issued = issuePrivacyToken(PRIVACY_VERIFICATION_TTL_MS);
          const [refreshed] = await tx
            .update(privacyRequests)
            .set({
              verificationTokenHash: issued.tokenHash,
              verificationExpiresAt: issued.expiresAt,
              verificationUsedAt: null,
              verificationAttempts: 0,
              updatedAt: new Date(),
            })
            .where(eq(privacyRequests.id, existing.id))
            .returning();
          await recordRequestEvent(tx, {
            requestId: existing.id,
            actorType: "SYSTEM",
            action: "VERIFICATION_SENT",
            metadata: { reason: "duplicate-submission" },
          });
          return {
            request: refreshed,
            verificationToken: issued.token,
            resend: true,
          };
        }
        return { request: existing, verificationToken: null, resend: false };
      }

      const reference = privacyReference();
      if (selfRequest && session) {
        const [created] = await tx
          .insert(privacyRequests)
          .values({
            reference,
            requesterUserId: session.userId,
            email: input.email,
            type: input.type,
            status: "SUBMITTED",
            details: input.details ?? null,
          })
          .returning();
        await recordRequestEvent(tx, {
          requestId: created.id,
          actorUserId: session.userId,
          actorType: "SUBJECT",
          action: "SUBMITTED",
          metadata: { type: input.type },
        });
        await recordRequestEvent(tx, {
          requestId: created.id,
          actorUserId: session.userId,
          actorType: "SUBJECT",
          action: "VERIFIED",
          metadata: { method: "session" },
        });
        return { request: created, verificationToken: null, resend: false };
      }

      const issued = issuePrivacyToken(PRIVACY_VERIFICATION_TTL_MS);
      const [created] = await tx
        .insert(privacyRequests)
        .values({
          reference,
          email: input.email,
          type: input.type,
          status: "IDENTITY_PENDING",
          details: input.details ?? null,
          verificationTokenHash: issued.tokenHash,
          verificationExpiresAt: issued.expiresAt,
          verificationAttempts: 0,
        })
        .returning();
      await recordRequestEvent(tx, {
        requestId: created.id,
        actorType: "SUBJECT",
        action: "SUBMITTED",
        metadata: { type: input.type },
      });
      await recordRequestEvent(tx, {
        requestId: created.id,
        actorType: "SYSTEM",
        action: "VERIFICATION_SENT",
        metadata: {},
      });
      return {
        request: created,
        verificationToken: issued.token,
        resend: false,
      };
    });

    if (result.verificationToken) {
      await sendVerificationEmail(
        result.request.email,
        result.request.reference,
        result.verificationToken,
      );
    }
    return response.status(202).json({
      reference: result.request.reference,
      status: result.request.status,
      message:
        result.request.status === "IDENTITY_PENDING"
          ? "Check your email to verify this request"
          : "Your request has been submitted",
    });
  } catch (error) {
    if (isPrivacySchemaUnavailable(error))
      return response.status(503).json({
        error: "Privacy features are temporarily unavailable",
        code: "PRIVACY_TEMPORARILY_UNAVAILABLE",
      });
    return next(error);
  }
});

// ---------------------------------------------------------------------------
// Public: verify a request with the emailed token
// ---------------------------------------------------------------------------
router.post(
  "/privacy/requests/:reference/verify",
  async (request, response, next) => {
    try {
      const reference = z.string().min(1).max(40).parse(request.params.reference);
      const input = privacyVerifySchema.parse(request.body);
      const database = requireDb();
      await rateLimitPrivacyRequest(
        database,
        request,
        reference,
        "PRIVACY_VERIFY",
      );
      const verified = await database.transaction(async (tx) => {
        const [row] = await tx
          .select()
          .from(privacyRequests)
          .where(eq(privacyRequests.reference, reference))
          .limit(1)
          .for("update");
        if (!row) return { outcome: "NOT_FOUND" as const };
        if (row.status !== "IDENTITY_PENDING")
          return { outcome: "ALREADY_VERIFIED" as const };
        const now = new Date();
        if (
          row.verificationAttempts >= PRIVACY_VERIFICATION_MAX_ATTEMPTS ||
          !row.verificationTokenHash ||
          !row.verificationExpiresAt ||
          row.verificationExpiresAt.getTime() <= now.getTime()
        )
          return { outcome: "EXPIRED" as const };
        if (!verifyPrivacyTokenHash(input.token, row.verificationTokenHash)) {
          const attempts = row.verificationAttempts + 1;
          await tx
            .update(privacyRequests)
            .set({ verificationAttempts: attempts, updatedAt: now })
            .where(eq(privacyRequests.id, row.id));
          await recordRequestEvent(tx, {
            requestId: row.id,
            actorType: "SYSTEM",
            action: "VERIFICATION_FAILED",
            metadata: { attempts },
          });
          return { outcome: "INVALID" as const };
        }
        const statusToken = issuePrivacyToken(PRIVACY_STATUS_TOKEN_TTL_MS, now);
        const [updated] = await tx
          .update(privacyRequests)
          .set({
            verificationUsedAt: now,
            status: "SUBMITTED",
            statusTokenHash: statusToken.tokenHash,
            statusTokenExpiresAt: statusToken.expiresAt,
            updatedAt: now,
          })
          .where(eq(privacyRequests.id, row.id))
          .returning();
        await recordRequestEvent(tx, {
          requestId: row.id,
          actorType: "SUBJECT",
          action: "VERIFIED",
          metadata: { method: "email-token" },
        });
        const history = await tx
          .select()
          .from(privacyRequestEvents)
          .where(eq(privacyRequestEvents.requestId, row.id))
          .orderBy(desc(privacyRequestEvents.createdAt));
        return {
          outcome: "VERIFIED" as const,
          request: updated,
          statusToken: statusToken.token,
          history: history
            .filter((event) => SUBJECT_VISIBLE_ACTIONS.has(event.action))
            .map(subjectEventView),
        };
      });
      if (verified.outcome === "NOT_FOUND")
        return response.status(404).json({ error: "Privacy request not found" });
      if (verified.outcome === "ALREADY_VERIFIED")
        return response
          .status(409)
          .json({ error: "This request has already been verified" });
      if (verified.outcome === "EXPIRED")
        return response.status(400).json({
          error:
            "This verification link is invalid or expired. Submit the request again to receive a new link.",
        });
      if (verified.outcome === "INVALID")
        return response
          .status(400)
          .json({ error: "Verification code is incorrect or expired" });
      return response.json({
        reference: verified.request.reference,
        status: verified.request.status,
        statusToken: verified.statusToken,
        history: verified.history,
      });
    } catch (error) {
      if (isPrivacySchemaUnavailable(error))
        return response.status(503).json({
          error: "Privacy features are temporarily unavailable",
          code: "PRIVACY_TEMPORARILY_UNAVAILABLE",
        });
      return next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// Public: check a request's status with its status token
// ---------------------------------------------------------------------------
router.get(
  "/privacy/requests/:reference/status",
  async (request, response, next) => {
    try {
      const reference = z.string().min(1).max(40).parse(request.params.reference);
      const query = privacyStatusQuerySchema.parse(request.query);
      const database = requireDb();
      const [row] = await database
        .select()
        .from(privacyRequests)
        .where(eq(privacyRequests.reference, reference))
        .limit(1);
      if (!row)
        return response.status(404).json({ error: "Privacy request not found" });
      const now = new Date();
      if (
        !query.token ||
        !row.statusTokenHash ||
        !row.statusTokenExpiresAt ||
        row.statusTokenExpiresAt.getTime() <= now.getTime() ||
        !verifyPrivacyTokenHash(query.token, row.statusTokenHash)
      )
        return response
          .status(401)
          .json({ error: "A valid status token is required" });
      const history = await database
        .select()
        .from(privacyRequestEvents)
        .where(eq(privacyRequestEvents.requestId, row.id))
        .orderBy(desc(privacyRequestEvents.createdAt));
      return response.json({
        request: publicRequestView(row),
        history: history
          .filter((event) => SUBJECT_VISIBLE_ACTIONS.has(event.action))
          .map(subjectEventView),
      });
    } catch (error) {
      if (isPrivacySchemaUnavailable(error))
        return response.status(503).json({
          error: "Privacy features are temporarily unavailable",
          code: "PRIVACY_TEMPORARILY_UNAVAILABLE",
        });
      return next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// Authenticated: my own privacy requests
// ---------------------------------------------------------------------------
router.get(
  "/privacy/requests/me",
  requireAuth(),
  async (request, response, next) => {
    try {
      const database = requireDb();
      const rows = await database
        .select()
        .from(privacyRequests)
        .where(
          or(
            eq(privacyRequests.requesterUserId, request.auth!.userId),
            eq(privacyRequests.email, request.auth!.email.toLowerCase()),
          ),
        )
        .orderBy(desc(privacyRequests.createdAt))
        .limit(100);
      return response.json({ requests: rows.map(publicRequestView) });
    } catch (error) {
      if (isPrivacySchemaUnavailable(error))
        return response.status(503).json({
          error: "Privacy features are temporarily unavailable",
          code: "PRIVACY_TEMPORARILY_UNAVAILABLE",
        });
      return next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// Admin: privacy queue
// ---------------------------------------------------------------------------
router.get(
  "/admin/privacy-requests",
  requireAuth(),
  requireRole("ADMIN"),
  async (request, response, next) => {
    try {
      const query = adminPrivacyRequestQuerySchema.parse(request.query);
      const database = requireDb();
      const filters = [];
      if (query.status) filters.push(eq(privacyRequests.status, query.status));
      if (query.type) filters.push(eq(privacyRequests.type, query.type));
      if (query.search) {
        const pattern = `%${query.search.replace(/[\\%_]/g, "\\$&")}%`;
        const searchFilter = or(
          ilike(privacyRequests.reference, pattern),
          ilike(privacyRequests.email, pattern),
        );
        if (searchFilter) filters.push(searchFilter);
      }
      const rows = await database
        .select()
        .from(privacyRequests)
        .where(filters.length ? and(...filters) : undefined)
        .orderBy(desc(privacyRequests.createdAt))
        .limit(250);
      return response.json({ requests: rows.map(adminRequestView) });
    } catch (error) {
      if (isPrivacySchemaUnavailable(error))
        return response.status(503).json({
          error: "Privacy features are temporarily unavailable",
          code: "PRIVACY_TEMPORARILY_UNAVAILABLE",
        });
      return next(error);
    }
  },
);

router.get(
  "/admin/privacy-requests/:id",
  requireAuth(),
  requireRole("ADMIN"),
  async (request, response, next) => {
    try {
      const requestId = z.string().uuid().parse(request.params.id);
      const database = requireDb();
      const [row] = await database
        .select()
        .from(privacyRequests)
        .where(eq(privacyRequests.id, requestId))
        .limit(1);
      if (!row)
        return response.status(404).json({ error: "Privacy request not found" });
      const history = await database
        .select()
        .from(privacyRequestEvents)
        .where(eq(privacyRequestEvents.requestId, row.id))
        .orderBy(desc(privacyRequestEvents.createdAt));
      return response.json({
        request: adminRequestView(row),
        history: history.map(adminEventView),
      });
    } catch (error) {
      if (isPrivacySchemaUnavailable(error))
        return response.status(503).json({
          error: "Privacy features are temporarily unavailable",
          code: "PRIVACY_TEMPORARILY_UNAVAILABLE",
        });
      return next(error);
    }
  },
);

router.patch(
  "/admin/privacy-requests/:id",
  requireAuth(),
  requireRole("ADMIN"),
  async (request, response, next) => {
    try {
      const requestId = z.string().uuid().parse(request.params.id);
      const input = adminPrivacyRequestUpdateSchema.parse(request.body);
      const database = requireDb();
      const updated = await database.transaction(async (tx) => {
        const [row] = await tx
          .select()
          .from(privacyRequests)
          .where(eq(privacyRequests.id, requestId))
          .limit(1)
          .for("update");
        if (!row) return null;
        const now = new Date();
        const patch: Partial<PrivacyRequestRow> & { updatedAt: Date } = {
          updatedAt: now,
        };
        const events: Array<{
          action: string;
          note?: string | null;
          metadata?: Record<string, unknown>;
        }> = [];
        if (input.status !== undefined) {
          assertPrivacyStatusTransition(
            row.status as PrivacyRequestStatus,
            input.status,
          );
          if (input.status === "FULFILLED")
            assertFulfillable({
              status: row.status as PrivacyRequestStatus,
              holdReason: row.holdReason,
            });
          patch.status = input.status;
          if (input.status === "FULFILLED" || input.status === "REJECTED") {
            patch.resolvedByUserId = request.auth!.userId;
            patch.resolvedAt = now;
          }
          if (input.status === "CLOSED") patch.closedAt = now;
          events.push({
            action:
              input.status === "MORE_INFORMATION_REQUIRED"
                ? "MORE_INFORMATION_REQUIRED"
                : "STATUS_CHANGED",
            note: input.note ?? null,
            metadata: { from: row.status, to: input.status },
          });
        }
        if (input.holdReason !== undefined) {
          patch.holdReason = input.holdReason;
          patch.holdByUserId = request.auth!.userId;
          events.push({
            action: "HOLD_APPLIED",
            metadata: { reason: input.holdReason },
          });
        }
        if (input.holdReleased) {
          patch.holdReason = null;
          patch.holdByUserId = null;
          events.push({ action: "HOLD_RELEASED", metadata: {} });
        }
        if (input.note !== undefined && input.status === undefined) {
          events.push({
            action: "NOTE_ADDED",
            note: input.note,
            metadata: {},
          });
        }
        const [next] = await tx
          .update(privacyRequests)
          .set(patch)
          .where(eq(privacyRequests.id, requestId))
          .returning();
        for (const event of events) {
          await recordRequestEvent(tx, {
            requestId,
            actorUserId: request.auth!.userId,
            actorType: "ADMIN",
            action: event.action,
            note: event.note ?? null,
            metadata: event.metadata ?? {},
          });
        }
        await recordAudit(tx, {
          actorUserId: request.auth!.userId,
          action: "PRIVACY_REQUEST_UPDATED",
          entityId: requestId,
          metadata: {
            status: input.status,
            holdApplied: input.holdReason !== undefined,
            holdReleased: input.holdReleased === true,
            note: input.note ?? null,
          },
        });
        return next;
      });
      if (!updated)
        return response.status(404).json({ error: "Privacy request not found" });
      // Status changes are worth an email; a failed send never rolls the
      // change back.
      if (
        input.status === "FULFILLED" ||
        input.status === "REJECTED" ||
        input.status === "MORE_INFORMATION_REQUIRED"
      ) {
        await sendStatusEmail(updated.email, updated.reference, updated.status);
      }
      return response.json({ request: adminRequestView(updated) });
    } catch (error) {
      if (isPrivacySchemaUnavailable(error))
        return response.status(503).json({
          error: "Privacy features are temporarily unavailable",
          code: "PRIVACY_TEMPORARILY_UNAVAILABLE",
        });
      return next(error);
    }
  },
);

router.post(
  "/admin/privacy-requests/:id/notes",
  requireAuth(),
  requireRole("ADMIN"),
  async (request, response, next) => {
    try {
      const requestId = z.string().uuid().parse(request.params.id);
      const input = adminPrivacyNoteSchema.parse(request.body);
      const database = requireDb();
      const event = await database.transaction(async (tx) => {
        const [row] = await tx
          .select({ id: privacyRequests.id })
          .from(privacyRequests)
          .where(eq(privacyRequests.id, requestId))
          .limit(1);
        if (!row) return null;
        const created = await recordRequestEvent(tx, {
          requestId,
          actorUserId: request.auth!.userId,
          actorType: "ADMIN",
          action: "NOTE_ADDED",
          note: input.note,
          metadata: {},
        });
        await recordAudit(tx, {
          actorUserId: request.auth!.userId,
          action: "PRIVACY_REQUEST_NOTE_ADDED",
          entityId: requestId,
          metadata: { note: input.note },
        });
        return created;
      });
      if (!event)
        return response.status(404).json({ error: "Privacy request not found" });
      return response.status(201).json({
        event: {
          id: event.id,
          action: "NOTE_ADDED",
          note: input.note,
        },
      });
    } catch (error) {
      if (isPrivacySchemaUnavailable(error))
        return response.status(503).json({
          error: "Privacy features are temporarily unavailable",
          code: "PRIVACY_TEMPORARILY_UNAVAILABLE",
        });
      return next(error);
    }
  },
);

// Out-of-band identity verification, for when the verification email cannot
// be delivered (email is blocked in production until a sender domain is
// approved). The Admin must record HOW identity was verified; the note is
// part of the audit trail.
router.post(
  "/admin/privacy-requests/:id/verify",
  requireAuth(),
  requireRole("ADMIN"),
  async (request, response, next) => {
    try {
      const requestId = z.string().uuid().parse(request.params.id);
      const input = adminPrivacyVerifySchema.parse(request.body);
      const database = requireDb();
      const verified = await database.transaction(async (tx) => {
        const [row] = await tx
          .select()
          .from(privacyRequests)
          .where(eq(privacyRequests.id, requestId))
          .limit(1)
          .for("update");
        if (!row) return { outcome: "NOT_FOUND" as const };
        if (row.status !== "IDENTITY_PENDING")
          return { outcome: "ALREADY_VERIFIED" as const };
        const now = new Date();
        const statusToken = issuePrivacyToken(PRIVACY_STATUS_TOKEN_TTL_MS, now);
        const [updated] = await tx
          .update(privacyRequests)
          .set({
            verificationUsedAt: now,
            status: "SUBMITTED",
            statusTokenHash: statusToken.tokenHash,
            statusTokenExpiresAt: statusToken.expiresAt,
            updatedAt: now,
          })
          .where(eq(privacyRequests.id, requestId))
          .returning();
        await recordRequestEvent(tx, {
          requestId,
          actorUserId: request.auth!.userId,
          actorType: "ADMIN",
          action: "VERIFIED",
          note: input.note,
          metadata: { method: "out-of-band" },
        });
        await recordAudit(tx, {
          actorUserId: request.auth!.userId,
          action: "PRIVACY_REQUEST_VERIFIED",
          entityId: requestId,
          metadata: { method: "out-of-band", note: input.note },
        });
        return {
          outcome: "VERIFIED" as const,
          request: updated,
          statusToken: statusToken.token,
        };
      });
      if (verified.outcome === "NOT_FOUND")
        return response.status(404).json({ error: "Privacy request not found" });
      if (verified.outcome === "ALREADY_VERIFIED")
        return response
          .status(409)
          .json({ error: "This request has already been verified" });
      return response.json({
        reference: verified.request.reference,
        status: verified.request.status,
        statusToken: verified.statusToken,
      });
    } catch (error) {
      if (isPrivacySchemaUnavailable(error))
        return response.status(503).json({
          error: "Privacy features are temporarily unavailable",
          code: "PRIVACY_TEMPORARILY_UNAVAILABLE",
        });
      return next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// Admin: retention policies + dry-run reporting (read-only — never deletes)
// ---------------------------------------------------------------------------
router.get(
  "/admin/retention/policies",
  requireAuth(),
  requireRole("ADMIN"),
  async (request, response, next) => {
    try {
      const database = requireDb();
      const rows = await database
        .select()
        .from(privacyRetentionPolicies)
        .orderBy(privacyRetentionPolicies.dataCategory);
      return response.json({ policies: rows });
    } catch (error) {
      if (isPrivacySchemaUnavailable(error))
        return response.status(503).json({
          error: "Privacy features are temporarily unavailable",
          code: "PRIVACY_TEMPORARILY_UNAVAILABLE",
        });
      return next(error);
    }
  },
);

router.post(
  "/admin/retention/policies",
  requireAuth(),
  requireRole("ADMIN"),
  async (request, response, next) => {
    try {
      const input = retentionPolicyCreateSchema.parse(request.body);
      const database = requireDb();
      const [existing] = await database
        .select({ id: privacyRetentionPolicies.id })
        .from(privacyRetentionPolicies)
        .where(
          eq(privacyRetentionPolicies.dataCategory, input.dataCategory),
        )
        .limit(1);
      if (existing)
        return response.status(409).json({
          error: `A retention policy already exists for ${input.dataCategory}`,
        });
      const [created] = await database
        .insert(privacyRetentionPolicies)
        .values({
          dataCategory: input.dataCategory,
          retentionDays: input.retentionDays,
          description: input.description ?? null,
          legalBasis: input.legalBasis ?? null,
          createdByUserId: request.auth!.userId,
        })
        .returning();
      return response.status(201).json({ policy: created });
    } catch (error) {
      if (isPrivacySchemaUnavailable(error))
        return response.status(503).json({
          error: "Privacy features are temporarily unavailable",
          code: "PRIVACY_TEMPORARILY_UNAVAILABLE",
        });
      return next(error);
    }
  },
);

router.patch(
  "/admin/retention/policies/:id",
  requireAuth(),
  requireRole("ADMIN"),
  async (request, response, next) => {
    try {
      const policyId = z.string().uuid().parse(request.params.id);
      const input = retentionPolicyUpdateSchema.parse(request.body);
      const database = requireDb();
      const patch: {
        retentionDays?: number | null;
        description?: string | null;
        legalBasis?: string | null;
        isActive?: boolean;
        updatedAt: Date;
      } = { updatedAt: new Date() };
      if (input.retentionDays !== undefined)
        patch.retentionDays = input.retentionDays;
      if (input.description !== undefined)
        patch.description = input.description;
      if (input.legalBasis !== undefined) patch.legalBasis = input.legalBasis;
      if (input.isActive !== undefined) patch.isActive = input.isActive;
      const [updated] = await database
        .update(privacyRetentionPolicies)
        .set(patch)
        .where(eq(privacyRetentionPolicies.id, policyId))
        .returning();
      if (!updated)
        return response.status(404).json({ error: "Retention policy not found" });
      return response.json({ policy: updated });
    } catch (error) {
      if (isPrivacySchemaUnavailable(error))
        return response.status(503).json({
          error: "Privacy features are temporarily unavailable",
          code: "PRIVACY_TEMPORARILY_UNAVAILABLE",
        });
      return next(error);
    }
  },
);

router.get(
  "/admin/retention/dry-run",
  requireAuth(),
  requireRole("ADMIN"),
  async (request, response, next) => {
    try {
      const database = requireDb();
      const policies = await database
        .select()
        .from(privacyRetentionPolicies)
        .where(eq(privacyRetentionPolicies.isActive, true));
      const byCategory = new Map<string, (typeof policies)[number]>();
      for (const policy of policies) byCategory.set(policy.dataCategory, policy);
      const now = new Date();
      const categories: Array<{
        category: RetentionCategory;
        policy: { retentionDays: number | null } | null;
        totalRows: number;
        eligibleRows: number;
        heldRows: number;
        note: string;
      }> = [];
      for (const category of RETENTION_CATEGORIES) {
        const policy = byCategory.get(category) ?? null;
        if (!policy || policy.retentionDays === null) {
          categories.push({
            category,
            policy: policy ? { retentionDays: null } : null,
            totalRows: 0,
            eligibleRows: 0,
            heldRows: 0,
            note: policy
              ? "Policy is set to retain until manual review — nothing is eligible."
              : "No active retention policy — nothing is eligible.",
          });
          continue;
        }
        const cutoff = new Date(
          now.getTime() - policy.retentionDays * 24 * 60 * 60 * 1000,
        );
        let totalRows = 0;
        let eligibleRows = 0;
        let heldRows = 0;
        if (category === "ENQUIRY") {
          const [total] = await database
            .select({ value: count() })
            .from(enquiries);
          const [eligible] = await database
            .select({ value: count() })
            .from(enquiries)
            .where(lt(enquiries.createdAt, cutoff));
          totalRows = total?.value ?? 0;
          eligibleRows = eligible?.value ?? 0;
        } else if (category === "AUTH_TOKEN") {
          const [total] = await database
            .select({ value: count() })
            .from(authTokens);
          const [eligible] = await database
            .select({ value: count() })
            .from(authTokens)
            .where(lt(authTokens.expiresAt, cutoff));
          totalRows = total?.value ?? 0;
          eligibleRows = eligible?.value ?? 0;
        } else if (category === "AUTH_SESSION") {
          const [total] = await database
            .select({ value: count() })
            .from(authSessions);
          const [eligible] = await database
            .select({ value: count() })
            .from(authSessions)
            .where(lt(authSessions.expiresAt, cutoff));
          totalRows = total?.value ?? 0;
          eligibleRows = eligible?.value ?? 0;
        } else if (category === "AUDIT_LOG") {
          const [total] = await database
            .select({ value: count() })
            .from(auditLogs);
          const [eligible] = await database
            .select({ value: count() })
            .from(auditLogs)
            .where(lt(auditLogs.createdAt, cutoff));
          totalRows = total?.value ?? 0;
          eligibleRows = eligible?.value ?? 0;
        } else if (category === "FEASIBILITY_DOCUMENT") {
          const [total] = await database
            .select({ value: count() })
            .from(feasibilityDocuments);
          const [eligible] = await database
            .select({ value: count() })
            .from(feasibilityDocuments)
            .where(
              and(
                lt(feasibilityDocuments.createdAt, cutoff),
                eq(feasibilityDocuments.status, "AVAILABLE"),
              ),
            );
          totalRows = total?.value ?? 0;
          eligibleRows = eligible?.value ?? 0;
        } else if (category === "PRIVACY_REQUEST") {
          const [total] = await database
            .select({ value: count() })
            .from(privacyRequests);
          const [eligible] = await database
            .select({ value: count() })
            .from(privacyRequests)
            .where(
              and(
                or(
                  ...PRIVACY_TERMINAL_STATUSES.map(
                    (status) => sql`${privacyRequests.status} = ${status}`,
                  ),
                ),
                lt(privacyRequests.createdAt, cutoff),
                isNull(privacyRequests.holdReason),
              ),
            );
          const [held] = await database
            .select({ value: count() })
            .from(privacyRequests)
            .where(
              and(
                or(
                  ...PRIVACY_TERMINAL_STATUSES.map(
                    (status) => sql`${privacyRequests.status} = ${status}`,
                  ),
                ),
                lt(privacyRequests.createdAt, cutoff),
                sql`${privacyRequests.holdReason} IS NOT NULL`,
              ),
            );
          totalRows = total?.value ?? 0;
          eligibleRows = eligible?.value ?? 0;
          heldRows = held?.value ?? 0;
        }
        categories.push({
          category,
          policy: { retentionDays: policy.retentionDays },
          totalRows,
          eligibleRows,
          heldRows,
          note:
            heldRows > 0
              ? `${heldRows} row(s) are under a hold and are excluded from eligibility.`
              : "No rows are under a hold in this category.",
        });
      }
      return response.json({
        generatedAt: now.toISOString(),
        categories,
        deletedRows: 0,
        note: "Dry run only — no rows were deleted. Deletion requires owner + legal approval of the retention periods.",
      });
    } catch (error) {
      if (isPrivacySchemaUnavailable(error))
        return response.status(503).json({
          error: "Privacy features are temporarily unavailable",
          code: "PRIVACY_TEMPORARILY_UNAVAILABLE",
        });
      return next(error);
    }
  },
);

export default router;
