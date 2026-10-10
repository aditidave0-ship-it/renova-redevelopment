import { createHash, randomBytes } from "node:crypto";
import { Router, type IRouter } from "express";
import { z } from "@workspace/api-zod";
import { and, count, desc, eq, gte, ilike, or } from "drizzle-orm";
import { auditLogs, enquiries, requireDb, users } from "@workspace/db";
import { requireAuth, requireRole } from "../lib/session";
import {
  adminEnquiryNotificationEmail,
  enquiryAcknowledgementEmail,
  getEmailBrand,
  getEmailProvider,
  isEmailDeliveryConfigured,
} from "../lib/email";
import { logger } from "../lib/logger";

const router: IRouter = Router();
export const enquirySchema = z.object({
  name: z.string().trim().min(2).max(160),
  organizationName: z.string().trim().min(2).max(220),
  email: z
    .string()
    .trim()
    .email()
    .max(320)
    .transform((value) => value.toLowerCase()),
  phone: z.string().trim().min(10).max(40),
  city: z.string().trim().min(2).max(160),
  actorType: z.enum([
    "Housing Society",
    "Developer",
    "PMC",
    "Architect",
    "Legal / Other Professional",
    "Contact",
  ]),
  experienceYears: z.number().int().min(0).max(100).nullable().optional(),
  message: z.string().trim().min(10).max(5000),
  consent: z.literal(true),
  source: z
    .enum([
      "WEBSITE",
      "FEASIBILITY",
      "FEASIBILITY_PRELIMINARY",
      "FEASIBILITY_DETAILED",
    ])
    .default("WEBSITE"),
});

const enquiryStatusSchema = z.enum(["NEW", "IN_REVIEW", "CONTACTED", "CLOSED"]);
const adminEnquiryQuerySchema = z.object({
  status: enquiryStatusSchema.optional(),
  assignedToUserId: z.string().uuid().optional(),
  search: z.string().trim().min(1).max(160).optional(),
});
const adminEnquiryUpdateSchema = z
  .object({
    status: enquiryStatusSchema.optional(),
    assignedToUserId: z.string().uuid().nullable().optional(),
    note: z.string().trim().min(2).max(2000).optional(),
  })
  .refine(
    (value) =>
      value.status !== undefined ||
      value.assignedToUserId !== undefined ||
      value.note !== undefined,
    "Provide at least one enquiry update",
  );

function fingerprint(request: { ip?: string }, email: string): string {
  return createHash("sha256")
    .update(`${request.ip || "unknown"}|${email}`)
    .digest("hex");
}

function reference(): string {
  return `REQ-${new Date().getUTCFullYear()}-${randomBytes(5).toString("hex").toUpperCase()}`;
}

function parseAuditMetadata(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return { legacyValue: value };
  }
}

type EmailAcceptanceState = "ACCEPTED" | "NOT_CONFIGURED" | "FAILED";

async function sendEnquiryEmails(input: {
  email: string;
  name: string;
  organizationName: string;
  reference: string;
  source: string;
}): Promise<{
  acknowledgement: EmailAcceptanceState;
  adminNotification: EmailAcceptanceState;
}> {
  if (!isEmailDeliveryConfigured())
    return {
      acknowledgement: "NOT_CONFIGURED",
      adminNotification: "NOT_CONFIGURED",
    };

  const brand = getEmailBrand();
  const provider = getEmailProvider(brand);
  let acknowledgement: EmailAcceptanceState = "FAILED";
  let adminNotification: EmailAcceptanceState = "NOT_CONFIGURED";
  try {
    await provider.send({
      to: input.email,
      ...enquiryAcknowledgementEmail(brand, input),
    });
    acknowledgement = "ACCEPTED";
  } catch (error) {
    logger.warn(
      { err: error, enquiryReference: input.reference },
      "Enquiry acknowledgement was not accepted by the email provider",
    );
  }

  const adminEmail = process.env.RENOVA_ADMIN_ENQUIRY_EMAIL?.trim();
  if (adminEmail) {
    adminNotification = "FAILED";
    try {
      await provider.send({
        to: adminEmail,
        ...adminEnquiryNotificationEmail(brand, input),
      });
      adminNotification = "ACCEPTED";
    } catch (error) {
      logger.warn(
        { err: error, enquiryReference: input.reference },
        "Admin enquiry notification was not accepted by the email provider",
      );
    }
  }
  return { acknowledgement, adminNotification };
}

router.post("/enquiries", async (request, response, next) => {
  try {
    const input = enquirySchema.parse(request.body);
    const database = requireDb();
    const requestFingerprint = fingerprint(request, input.email);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const [recent] = await database
      .select({ value: count() })
      .from(enquiries)
      .where(
        and(
          gte(enquiries.createdAt, oneHourAgo),
          eq(enquiries.requestFingerprint, requestFingerprint),
        ),
      );
    if ((recent?.value ?? 0) >= 5)
      return response
        .status(429)
        .json({ error: "Too many requests. Please try again later." });
    const enquiryReference = reference();
    await database.transaction(async (tx) => {
      const [saved] = await tx
        .insert(enquiries)
        .values({
          reference: enquiryReference,
          name: input.name,
          organizationName: input.organizationName,
          email: input.email,
          phone: input.phone,
          city: input.city,
          actorType: input.actorType,
          experienceYears: input.experienceYears ?? null,
          message: input.message,
          source: input.source,
          requestFingerprint,
        })
        .returning({ id: enquiries.id });
      await tx.insert(auditLogs).values({
        action: "ENQUIRY_CREATED",
        entityType: "ENQUIRY",
        entityId: saved.id,
        metadata: JSON.stringify({
          reference: enquiryReference,
          source: input.source,
        }),
      });
    });
    const email = await sendEnquiryEmails({
      email: input.email,
      name: input.name,
      organizationName: input.organizationName,
      reference: enquiryReference,
      source: input.source,
    });
    return response.status(201).json({ reference: enquiryReference, email });
  } catch (error) {
    return next(error);
  }
});

router.get(
  "/admin/enquiries",
  requireAuth(),
  requireRole("ADMIN"),
  async (request, response, next) => {
    try {
      const query = adminEnquiryQuerySchema.parse(request.query);
      const database = requireDb();
      const filters = [];
      if (query.status) filters.push(eq(enquiries.status, query.status));
      if (query.assignedToUserId)
        filters.push(eq(enquiries.assignedToUserId, query.assignedToUserId));
      if (query.search) {
        const pattern = `%${query.search.replace(/[\\%_]/g, "\\$&")}%`;
        const searchFilter = or(
          ilike(enquiries.reference, pattern),
          ilike(enquiries.name, pattern),
          ilike(enquiries.organizationName, pattern),
          ilike(enquiries.email, pattern),
          ilike(enquiries.city, pattern),
        );
        if (searchFilter) filters.push(searchFilter);
      }
      const rows = await database
        .select({
          id: enquiries.id,
          reference: enquiries.reference,
          name: enquiries.name,
          organizationName: enquiries.organizationName,
          email: enquiries.email,
          phone: enquiries.phone,
          city: enquiries.city,
          actorType: enquiries.actorType,
          experienceYears: enquiries.experienceYears,
          message: enquiries.message,
          source: enquiries.source,
          status: enquiries.status,
          assignedToUserId: enquiries.assignedToUserId,
          closedAt: enquiries.closedAt,
          createdAt: enquiries.createdAt,
          updatedAt: enquiries.updatedAt,
        })
        .from(enquiries)
        .where(filters.length ? and(...filters) : undefined)
        .orderBy(desc(enquiries.createdAt))
        .limit(250);
      return response.json({ enquiries: rows });
    } catch (error) {
      return next(error);
    }
  },
);

router.patch(
  "/admin/enquiries/:id",
  requireAuth(),
  requireRole("ADMIN"),
  async (request, response, next) => {
    try {
      const enquiryId = z.string().uuid().parse(request.params.id);
      const input = adminEnquiryUpdateSchema.parse(request.body);
      const database = requireDb();
      if (input.assignedToUserId) {
        const [assignee] = await database
          .select({ id: users.id })
          .from(users)
          .where(
            and(
              eq(users.id, input.assignedToUserId),
              eq(users.role, "ADMIN"),
              eq(users.isActive, true),
            ),
          )
          .limit(1);
        if (!assignee)
          return response
            .status(400)
            .json({ error: "Assignee must be an active Admin" });
      }
      const now = new Date();
      const patch: {
        status?: "NEW" | "IN_REVIEW" | "CONTACTED" | "CLOSED";
        assignedToUserId?: string | null;
        closedAt?: Date | null;
        updatedAt: Date;
      } = { updatedAt: now };
      if (input.status !== undefined) {
        patch.status = input.status;
        patch.closedAt = input.status === "CLOSED" ? now : null;
      }
      if (input.assignedToUserId !== undefined)
        patch.assignedToUserId = input.assignedToUserId;

      const updated = await database.transaction(async (tx) => {
        const [row] = await tx
          .update(enquiries)
          .set(patch)
          .where(eq(enquiries.id, enquiryId))
          .returning({
            id: enquiries.id,
            reference: enquiries.reference,
            status: enquiries.status,
            assignedToUserId: enquiries.assignedToUserId,
            closedAt: enquiries.closedAt,
            updatedAt: enquiries.updatedAt,
          });
        if (!row) return null;
        await tx.insert(auditLogs).values({
          actorUserId: request.auth!.userId,
          action: "ENQUIRY_UPDATED",
          entityType: "ENQUIRY",
          entityId: row.id,
          metadata: JSON.stringify({
            status: input.status,
            assignedToUserId: input.assignedToUserId,
            note: input.note,
          }),
        });
        return row;
      });
      if (!updated)
        return response.status(404).json({ error: "Enquiry not found" });
      return response.json({ enquiry: updated });
    } catch (error) {
      return next(error);
    }
  },
);

router.get(
  "/admin/enquiries/:id/history",
  requireAuth(),
  requireRole("ADMIN"),
  async (request, response, next) => {
    try {
      const enquiryId = z.string().uuid().parse(request.params.id);
      const database = requireDb();
      const history = await database
        .select({
          id: auditLogs.id,
          actorUserId: auditLogs.actorUserId,
          action: auditLogs.action,
          metadata: auditLogs.metadata,
          createdAt: auditLogs.createdAt,
        })
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.entityType, "ENQUIRY"),
            eq(auditLogs.entityId, enquiryId),
          ),
        )
        .orderBy(desc(auditLogs.createdAt));
      return response.json({
        history: history.map((entry) => ({
          ...entry,
          metadata: parseAuditMetadata(entry.metadata),
        })),
      });
    } catch (error) {
      return next(error);
    }
  },
);

export default router;
