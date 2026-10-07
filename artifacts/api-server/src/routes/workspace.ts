import { Router, type IRouter } from "express";
import { z } from "@workspace/api-zod";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import {
  requireDb,
  organizations,
  societies,
  opportunities,
  opportunityInterests,
  feasibilityRequests,
  auditLogs,
} from "@workspace/db";
import { requireAuth, requireRole } from "../lib/session";
const router: IRouter = Router();
const organizationInput = z.object({
  name: z.string().trim().min(2).max(220),
  location: z.string().trim().max(160),
  description: z.string().trim().max(5000),
  specialization: z.enum(["LEGAL", "ARCHITECT", "STRUCTURAL", "FINANCE_VALUATION", "OTHER"]).nullable().optional(),
  services: z.string().trim().max(5000).optional(),
  credentials: z.string().trim().max(5000).optional(),
  portfolio: z.string().trim().max(5000).optional(),
  website: z.union([
    z.literal(""),
    z
      .string()
      .url()
      .max(500)
      .refine((v) => ["https:", "http:"].includes(new URL(v).protocol)),
  ]),
});
const societyInput = z.object({
  address: z.string().trim().min(5).max(2000),
  city: z.string().trim().min(2).max(120),
  memberCount: z.number().int().min(1).max(100000),
  buildingAge: z.number().int().min(0).max(200),
  redevelopmentStatus: z.string().trim().min(2).max(120),
});
const feasibilityInput = z.object({
  propertyAddress: z.string().trim().max(2000),
  siteArea: z.string().trim().max(80).optional(),
  memberCount: z.number().int().min(1).max(100000).optional(),
  buildingAge: z.number().int().min(0).max(200).optional(),
  requirement: z.string().trim().max(5000),
  propertyInformation: z.string().trim().max(10000).optional(),
  regulatoryInformation: z.string().trim().max(10000).optional(),
  submit: z.boolean().default(true),
}).superRefine((input, ctx) => {
  if (input.submit && (input.propertyAddress.length < 5 || input.requirement.length < 20))
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Provide an address and requirement before submission" });
});
const idInput = z.string().uuid();

router.get("/organizations/me", requireAuth(), async (req, res, next) => {
  try {
    if (!req.auth!.organizationId)
      return res.status(404).json({ error: "Organization not found" });
    const db = requireDb();
    const [organization] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, req.auth!.organizationId));
    if (!organization)
      return res.status(404).json({ error: "Organization not found" });
    const [society] = await db
      .select()
      .from(societies)
      .where(eq(societies.organizationId, organization.id));
    const fields = [
      organization.name,
      organization.location,
      organization.description,
      organization.website,
    ];
    return res.json({
      organization,
      society: society ?? null,
      completion: {
        provided: fields.filter(Boolean).length,
        total: fields.length,
      },
      role: req.auth!.role,
    });
  } catch (error) {
    return next(error);
  }
});
router.put(
  "/organizations/me",
  requireAuth(),
  requireRole("SOCIETY", "DEVELOPER", "PMC", "PROFESSIONAL"),
  async (req, res, next) => {
    try {
      const input = organizationInput.parse(req.body);
      if (!req.auth!.organizationId)
        return res.status(404).json({ error: "Organization not found" });
      const [organization] = await requireDb()
        .update(organizations)
        .set({
          ...input,
          specialization: req.auth!.role === "PROFESSIONAL" ? input.specialization : undefined,
          website: input.website || null,
          updatedAt: new Date(),
        })
        .where(eq(organizations.id, req.auth!.organizationId))
        .returning();
      if (!organization)
        return res.status(404).json({ error: "Organization not found" });
      return res.json({ organization });
    } catch (error) {
      return next(error);
    }
  },
);
router.put(
  "/societies/me/profile",
  requireAuth(),
  requireRole("SOCIETY"),
  async (req, res, next) => {
    try {
      const input = societyInput.parse(req.body);
      const [society] = await requireDb()
        .update(societies)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(societies.organizationId, req.auth!.organizationId!))
        .returning();
      if (!society) return res.status(404).json({ error: "Society not found" });
      return res.json({ society });
    } catch (error) {
      return next(error);
    }
  },
);
router.get("/workspace/metrics", requireAuth(), async (req, res, next) => {
  try {
    const db = requireDb();
    const org = req.auth!.organizationId;
    if (!org) return res.status(404).json({ error: "Organization not found" });
    if (req.auth!.role === "SOCIETY") {
      const owned = db
        .select({ id: opportunities.id })
        .from(opportunities)
        .innerJoin(societies, eq(societies.id, opportunities.societyId))
        .where(eq(societies.organizationId, org));
      const rows = await db
        .select({ status: opportunities.status, value: count() })
        .from(opportunities)
        .where(inArray(opportunities.id, owned))
        .groupBy(opportunities.status);
      const [interest] = await db
        .select({ value: count() })
        .from(opportunityInterests)
        .where(inArray(opportunityInterests.opportunityId, owned));
      return res.json({
        role: req.auth!.role,
        drafts: rows.find((r) => r.status === "DRAFT")?.value ?? 0,
        published: rows.find((r) => r.status === "PUBLISHED")?.value ?? 0,
        interests: interest.value,
      });
    }
    const [published] = await db
      .select({ value: count() })
      .from(opportunities)
      .where(eq(opportunities.status, "PUBLISHED"));
    const [interest] = await db
      .select({ value: count() })
      .from(opportunityInterests)
      .where(eq(opportunityInterests.organizationId, org));
    return res.json({
      role: req.auth!.role,
      published: published.value,
      interests: interest.value,
    });
  } catch (error) {
    return next(error);
  }
});
router.get(
  "/organizations/me/interests",
  requireAuth(),
  requireRole("DEVELOPER", "PMC"),
  async (req, res, next) => {
    try {
      const interests = await requireDb()
        .select({
          id: opportunityInterests.id,
          status: opportunityInterests.status,
          opportunityId: opportunityInterests.opportunityId,
          title: opportunities.title,
        })
        .from(opportunityInterests)
        .innerJoin(
          opportunities,
          eq(opportunities.id, opportunityInterests.opportunityId),
        )
        .where(
          eq(opportunityInterests.organizationId, req.auth!.organizationId!),
        );
      return res.json({ interests });
    } catch (error) {
      return next(error);
    }
  },
);
router.post(
  "/societies/me/feasibility",
  requireAuth(),
  requireRole("SOCIETY"),
  async (req, res, next) => {
    try {
      const input = feasibilityInput.parse(req.body);
      const { submit, ...details } = input;
      const db = requireDb();
      const [society] = await db
        .select({ id: societies.id })
        .from(societies)
        .where(eq(societies.organizationId, req.auth!.organizationId!));
      if (!society) return res.status(404).json({ error: "Society not found" });
      const [request] = await db
        .insert(feasibilityRequests)
        .values({
          ...details,
          status: submit ? "SUBMITTED" : "DRAFT",
          societyId: society.id,
          submittedByUserId: req.auth!.userId,
        })
        .returning();
      return res.status(201).json({ request });
    } catch (error) {
      return next(error);
    }
  },
);
router.get(
  "/societies/me/feasibility",
  requireAuth(),
  requireRole("SOCIETY"),
  async (req, res, next) => {
    try {
      const requests = await requireDb()
        .select({ request: feasibilityRequests })
        .from(feasibilityRequests)
        .innerJoin(societies, eq(societies.id, feasibilityRequests.societyId))
        .where(eq(societies.organizationId, req.auth!.organizationId!))
        .orderBy(desc(feasibilityRequests.createdAt));
      return res.json({ requests: requests.map((r) => r.request) });
    } catch (error) {
      return next(error);
    }
  },
);
router.get(
  "/admin/feasibility",
  requireAuth(),
  requireRole("ADMIN"),
  async (_req, res, next) => {
    try {
      const requests = await requireDb()
        .select()
        .from(feasibilityRequests)
        .where(inArray(feasibilityRequests.status, ["SUBMITTED", "IN_REVIEW", "MORE_INFORMATION_REQUIRED", "ASSESSMENT_READY", "CLOSED"]))
        .orderBy(desc(feasibilityRequests.createdAt))
        .limit(250);
      return res.json({ requests });
    } catch (error) {
      return next(error);
    }
  },
);
router.patch(
  "/admin/feasibility/:id",
  requireAuth(),
  requireRole("ADMIN"),
  async (req, res, next) => {
    try {
      const id = idInput.parse(req.params.id);
      const input = z
        .object({
          status: z.enum(["IN_REVIEW", "MORE_INFORMATION_REQUIRED", "ASSESSMENT_READY", "CLOSED"]),
          assessmentNotes: z.string().trim().min(20).max(10000),
        })
        .parse(req.body);
      const request = await requireDb().transaction(async (tx) => {
        const [updated] = await tx
          .update(feasibilityRequests)
          .set({
            ...input,
            reviewedByUserId: req.auth!.userId,
            reviewedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(and(eq(feasibilityRequests.id, id), inArray(feasibilityRequests.status, ["SUBMITTED", "IN_REVIEW", "MORE_INFORMATION_REQUIRED", "ASSESSMENT_READY"])))
          .returning();
        if (updated)
          await tx
            .insert(auditLogs)
            .values({
              actorUserId: req.auth!.userId,
              action: "FEASIBILITY_REVIEW",
              entityType: "feasibility_request",
              entityId: id,
              metadata: JSON.stringify({ status: input.status }),
            });
        return updated;
      });
      if (!request) return res.status(404).json({ error: "Request not found" });
      return res.json({ request });
    } catch (error) {
      return next(error);
    }
  },
);
router.patch("/societies/me/feasibility/:id", requireAuth(), requireRole("SOCIETY"), async (req, res, next) => {
  try {
    const id = idInput.parse(req.params.id);
    const { submit, ...details } = feasibilityInput.parse(req.body);
    const db = requireDb();
    const owned = db.select({ id: societies.id }).from(societies).where(eq(societies.organizationId, req.auth!.organizationId!));
    const [request] = await db.update(feasibilityRequests).set({ ...details, status: submit ? "SUBMITTED" : "DRAFT", updatedAt: new Date() })
      .where(and(eq(feasibilityRequests.id, id), inArray(feasibilityRequests.societyId, owned), inArray(feasibilityRequests.status, ["DRAFT", "MORE_INFORMATION_REQUIRED"]))).returning();
    if (!request) return res.status(404).json({ error: "Editable request not found" });
    return res.json({ request });
  } catch (error) { return next(error); }
});
export default router;
