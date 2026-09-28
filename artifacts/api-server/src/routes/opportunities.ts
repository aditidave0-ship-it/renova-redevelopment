import { Router, type IRouter } from "express";
import { z } from "@workspace/api-zod";
import { and, desc, eq, sql } from "drizzle-orm";
import { getDb, requireAuth, requireRole } from "../lib/session";
import { opportunityInterests, opportunities, organizations, societies } from "@workspace/db";

const router: IRouter = Router();
const opportunityInput = z.object({
  title: z.string().trim().min(3).max(220),
  location: z.string().trim().min(2).max(180),
  description: z.string().trim().min(20).max(5000),
  memberCount: z.number().int().positive().max(100000).optional(),
  buildingAge: z.number().int().nonnegative().max(200).optional(),
  siteArea: z.string().trim().max(80).optional(),
  publish: z.boolean().default(false),
});
const interestInput = z.object({ message: z.string().trim().max(2000).optional() });

router.get("/opportunities", async (request, response, next) => {
  try {
    const database = getDb();
    const rows = await database.select({
      id: opportunities.id, title: opportunities.title, location: opportunities.location,
      description: opportunities.description, memberCount: opportunities.memberCount,
      buildingAge: opportunities.buildingAge, siteArea: opportunities.siteArea,
      status: opportunities.status, publishedAt: opportunities.publishedAt,
    }).from(opportunities).where(eq(opportunities.status, "PUBLISHED")).orderBy(desc(opportunities.publishedAt));
    return response.json({ opportunities: rows });
  } catch (error) { return next(error); }
});

router.post("/opportunities", requireAuth(), requireRole("SOCIETY"), async (request, response, next) => {
  try {
    const input = opportunityInput.parse(request.body);
    const database = getDb();
    const society = await database.select({ id: societies.id }).from(societies).where(eq(societies.organizationId, request.auth!.organizationId!)).limit(1);
    if (!society[0]) return response.status(404).json({ error: "Create a society profile before posting an opportunity" });
    const [opportunity] = await database.insert(opportunities).values({
      societyId: society[0].id, title: input.title, location: input.location, description: input.description,
      memberCount: input.memberCount ?? null, buildingAge: input.buildingAge ?? null, siteArea: input.siteArea ?? null,
      status: input.publish ? "PUBLISHED" : "DRAFT", publishedAt: input.publish ? new Date() : null,
    }).returning();
    return response.status(201).json({ opportunity });
  } catch (error) { return next(error); }
});

router.get("/opportunities/:id", async (request, response, next) => {
  try {
    const database = getDb();
    const rows = await database.select({
      id: opportunities.id, title: opportunities.title, location: opportunities.location,
      description: opportunities.description, memberCount: opportunities.memberCount,
      buildingAge: opportunities.buildingAge, siteArea: opportunities.siteArea,
      status: opportunities.status, publishedAt: opportunities.publishedAt,
    }).from(opportunities).where(and(eq(opportunities.id, request.params.id), eq(opportunities.status, "PUBLISHED"))).limit(1);
    if (!rows[0]) return response.status(404).json({ error: "Opportunity not found" });
    return response.json({ opportunity: rows[0] });
  } catch (error) { return next(error); }
});

router.post("/opportunities/:id/interests", requireAuth(), requireRole("DEVELOPER", "PMC"), async (request, response, next) => {
  try {
    const input = interestInput.parse(request.body ?? {});
    const database = getDb();
    const opportunity = await database.select({ id: opportunities.id }).from(opportunities).where(and(eq(opportunities.id, String(request.params.id)), eq(opportunities.status, "PUBLISHED"))).limit(1);
    if (!opportunity[0]) return response.status(404).json({ error: "Opportunity not found" });
    if (!request.auth!.organizationId) return response.status(409).json({ error: "Your account is not connected to an organization" });
    const [interest] = await database.insert(opportunityInterests).values({
      opportunityId: opportunity[0].id, organizationId: request.auth!.organizationId, submittedByUserId: request.auth!.userId, message: input.message ?? null,
    }).returning();
    return response.status(201).json({ interest });
  } catch (error) {
    if (error instanceof Error && /duplicate key|unique constraint/i.test(error.message)) return response.status(409).json({ error: "Your organization has already expressed interest" });
    return next(error);
  }
});

router.get("/societies/me/interests", requireAuth(), requireRole("SOCIETY"), async (request, response, next) => {
  try {
    const database = getDb();
    if (!request.auth!.organizationId) return response.status(409).json({ error: "Your account is not connected to an organization" });
    const rows = await database.select({
      id: opportunityInterests.id, status: opportunityInterests.status, message: opportunityInterests.message,
      createdAt: opportunityInterests.createdAt, opportunityId: opportunities.id,
      opportunityTitle: opportunities.title, organizationId: organizations.id, organizationName: organizations.name,
    }).from(opportunityInterests)
      .innerJoin(opportunities, eq(opportunities.id, opportunityInterests.opportunityId))
      .innerJoin(societies, eq(societies.id, opportunities.societyId))
      .innerJoin(organizations, eq(organizations.id, opportunityInterests.organizationId))
      .where(eq(societies.organizationId, request.auth!.organizationId));
    return response.json({ interests: rows });
  } catch (error) { return next(error); }
});

export default router;
