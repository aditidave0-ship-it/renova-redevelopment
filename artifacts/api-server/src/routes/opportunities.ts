import { Router, type IRouter } from "express";
import { z } from "@workspace/api-zod";
import { and, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { getDb, requireAuth, requireRole } from "../lib/session";
import { opportunityInterests, opportunities, organizations, societies } from "@workspace/db";
import { societyMarketplaceProfile } from "../lib/profile-policy";
import { INTEREST_REVIEW_STATUSES, isDuplicateInterestError } from "../lib/interest-policy";

const router: IRouter = Router();
const opportunityInput = z.object({
  title: z.string().trim().min(3).max(220), location: z.string().trim().min(2).max(180),
  description: z.string().trim().min(20).max(5000), memberCount: z.number().int().positive().max(100000).optional(),
  buildingAge: z.number().int().nonnegative().max(200).optional(), siteArea: z.string().trim().max(80).optional(), publish: z.boolean().default(false),
});
const discoveryQuery = z.object({ q: z.string().trim().max(160).optional(), location: z.string().trim().max(180).optional() });
const interestInput = z.object({ message: z.string().trim().max(2000).optional() });
const reviewInput = z.object({ status: z.enum(INTEREST_REVIEW_STATUSES) });

const publicOpportunityFields = {
  id: opportunities.id, title: opportunities.title, location: opportunities.location, description: opportunities.description,
  memberCount: opportunities.memberCount, buildingAge: opportunities.buildingAge, siteArea: opportunities.siteArea,
  status: opportunities.status, publishedAt: opportunities.publishedAt,
};

router.get("/opportunities", requireAuth(), requireRole("DEVELOPER", "PMC"), async (request, response, next) => {
  try {
    const input = discoveryQuery.parse(request.query);
    const database = getDb();
    const filters = [eq(opportunities.status, "PUBLISHED")];
    if (input.q) filters.push(or(ilike(opportunities.title, `%${input.q}%`), ilike(opportunities.description, `%${input.q}%`), ilike(opportunities.location, `%${input.q}%`))!);
    if (input.location) filters.push(ilike(opportunities.location, `%${input.location}%`));
    const rows = await database.select(publicOpportunityFields).from(opportunities).where(and(...filters)).orderBy(desc(opportunities.publishedAt));
    const ids = rows.map((row) => row.id);
    const existing = ids.length && request.auth!.organizationId
      ? await database.select({ opportunityId: opportunityInterests.opportunityId, reviewStatus: opportunityInterests.reviewStatus })
        .from(opportunityInterests).where(and(eq(opportunityInterests.organizationId, request.auth!.organizationId), inArray(opportunityInterests.opportunityId, ids)))
      : [];
    const statusByOpportunity = new Map(existing.map((item) => [item.opportunityId, item.reviewStatus]));
    return response.json({ opportunities: rows.map((row) => ({ ...row, interestStatus: statusByOpportunity.get(row.id) ?? null })) });
  } catch (error) { return next(error); }
});

router.post("/opportunities", requireAuth(), requireRole("SOCIETY"), async (request, response, next) => {
  try {
    const input = opportunityInput.parse(request.body);
    const database = getDb();
    const [society] = await database.select({ id: societies.id }).from(societies).where(eq(societies.organizationId, request.auth!.organizationId!)).limit(1);
    if (!society) return response.status(404).json({ error: "Create a society profile before posting an opportunity" });
    const [opportunity] = await database.insert(opportunities).values({ societyId: society.id, title: input.title, location: input.location,
      description: input.description, memberCount: input.memberCount ?? null, buildingAge: input.buildingAge ?? null, siteArea: input.siteArea ?? null,
      status: input.publish ? "PUBLISHED" : "DRAFT", publishedAt: input.publish ? new Date() : null }).returning();
    return response.status(201).json({ opportunity });
  } catch (error) { return next(error); }
});

router.get("/societies/me/opportunities", requireAuth(), requireRole("SOCIETY"), async (request, response, next) => {
  try {
    const rows = await getDb().select(publicOpportunityFields).from(opportunities)
      .innerJoin(societies, eq(societies.id, opportunities.societyId))
      .where(eq(societies.organizationId, request.auth!.organizationId!)).orderBy(desc(opportunities.createdAt));
    return response.json({ opportunities: rows });
  } catch (error) { return next(error); }
});

router.get("/opportunities/:id", requireAuth(), requireRole("DEVELOPER", "PMC"), async (request, response, next) => {
  try {
    const database = getDb();
    const [row] = await database.select({ ...publicOpportunityFields, organizationName: organizations.name, societyLocation: organizations.location,
      city: societies.city, numberBuildings: societies.numberBuildings, numberWings: societies.numberWings, unitCount: societies.unitCount,
      propertyType: societies.propertyType, landArea: societies.landArea, redevelopmentStatus: societies.redevelopmentStatus,
      societyDescription: societies.description, marketplaceVisible: societies.marketplaceVisible,
    }).from(opportunities).innerJoin(societies, eq(societies.id, opportunities.societyId))
      .innerJoin(organizations, eq(organizations.id, societies.organizationId))
      .where(and(eq(opportunities.id, String(request.params.id)), eq(opportunities.status, "PUBLISHED"))).limit(1);
    if (!row) return response.status(404).json({ error: "Opportunity not found" });
    const society = societyMarketplaceProfile({ organizationName: row.organizationName, location: row.societyLocation, city: row.city,
      numberBuildings: row.numberBuildings, numberWings: row.numberWings, unitCount: row.unitCount, propertyType: row.propertyType,
      landArea: row.landArea, redevelopmentStatus: row.redevelopmentStatus, description: row.societyDescription,
      marketplaceVisible: row.marketplaceVisible });
    const [interest] = request.auth!.organizationId ? await database.select({ reviewStatus: opportunityInterests.reviewStatus }).from(opportunityInterests)
      .where(and(eq(opportunityInterests.opportunityId, row.id), eq(opportunityInterests.organizationId, request.auth!.organizationId))).limit(1) : [];
    const { organizationName: _organizationName, societyLocation: _societyLocation, city: _city, numberBuildings: _numberBuildings,
      numberWings: _numberWings, unitCount: _unitCount, propertyType: _propertyType, landArea: _landArea,
      redevelopmentStatus: _redevelopmentStatus, societyDescription: _societyDescription, marketplaceVisible: _marketplaceVisible, ...opportunity } = row;
    return response.json({ opportunity: { ...opportunity, society, interestStatus: interest?.reviewStatus ?? null } });
  } catch (error) { return next(error); }
});

router.post("/opportunities/:id/interests", requireAuth(), requireRole("DEVELOPER", "PMC"), async (request, response, next) => {
  try {
    const input = interestInput.parse(request.body ?? {});
    const database = getDb();
    const [opportunity] = await database.select({ id: opportunities.id }).from(opportunities)
      .where(and(eq(opportunities.id, String(request.params.id)), eq(opportunities.status, "PUBLISHED"))).limit(1);
    if (!opportunity) return response.status(404).json({ error: "Opportunity not found" });
    if (!request.auth!.organizationId) return response.status(409).json({ error: "Your account is not connected to an organization" });
    const [interest] = await database.insert(opportunityInterests).values({ opportunityId: opportunity.id,
      organizationId: request.auth!.organizationId, submittedByUserId: request.auth!.userId, message: input.message ?? null,
      reviewStatus: "RECEIVED" }).returning();
    return response.status(201).json({ interest });
  } catch (error) {
    if (isDuplicateInterestError(error))
      return response.status(409).json({ error: "Your organization has already expressed interest" });
    return next(error);
  }
});

router.get("/organizations/me/interests", requireAuth(), requireRole("DEVELOPER", "PMC"), async (request, response, next) => {
  try {
    if (!request.auth!.organizationId) return response.status(409).json({ error: "Your account is not connected to an organization" });
    const rows = await getDb().select({ id: opportunityInterests.id, opportunityId: opportunities.id, opportunityTitle: opportunities.title,
      location: opportunities.location, message: opportunityInterests.message, reviewStatus: opportunityInterests.reviewStatus,
      createdAt: opportunityInterests.createdAt }).from(opportunityInterests)
      .innerJoin(opportunities, eq(opportunities.id, opportunityInterests.opportunityId))
      .where(eq(opportunityInterests.organizationId, request.auth!.organizationId)).orderBy(desc(opportunityInterests.createdAt));
    return response.json({ interests: rows });
  } catch (error) { return next(error); }
});

router.get("/societies/me/interests", requireAuth(), requireRole("SOCIETY"), async (request, response, next) => {
  try {
    if (!request.auth!.organizationId) return response.status(409).json({ error: "Your account is not connected to an organization" });
    const rows = await getDb().select({ id: opportunityInterests.id, reviewStatus: opportunityInterests.reviewStatus,
      message: opportunityInterests.message, createdAt: opportunityInterests.createdAt, opportunityId: opportunities.id,
      opportunityTitle: opportunities.title, organizationId: organizations.id, organizationName: organizations.name, role: organizations.kind,
      organizationLocation: organizations.location }).from(opportunityInterests)
      .innerJoin(opportunities, eq(opportunities.id, opportunityInterests.opportunityId))
      .innerJoin(societies, eq(societies.id, opportunities.societyId))
      .innerJoin(organizations, eq(organizations.id, opportunityInterests.organizationId))
      .where(eq(societies.organizationId, request.auth!.organizationId)).orderBy(desc(opportunityInterests.createdAt));
    return response.json({ interests: rows });
  } catch (error) { return next(error); }
});

router.patch("/societies/me/interests/:id", requireAuth(), requireRole("SOCIETY"), async (request, response, next) => {
  try {
    const input = reviewInput.parse(request.body);
    const database = getDb();
    const [owned] = await database.select({ id: opportunityInterests.id }).from(opportunityInterests)
      .innerJoin(opportunities, eq(opportunities.id, opportunityInterests.opportunityId))
      .innerJoin(societies, eq(societies.id, opportunities.societyId))
      .where(and(eq(opportunityInterests.id, String(request.params.id)), eq(societies.organizationId, request.auth!.organizationId!))).limit(1);
    if (!owned) return response.status(404).json({ error: "Interest not found" });
    const [interest] = await database.update(opportunityInterests).set({ reviewStatus: input.status, updatedAt: new Date() })
      .where(eq(opportunityInterests.id, owned.id)).returning();
    return response.json({ interest });
  } catch (error) { return next(error); }
});

export default router;
