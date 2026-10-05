import { Router, type IRouter } from "express";
import { z } from "@workspace/api-zod";
import { and, eq } from "drizzle-orm";
import { developerProfiles, organizations, pmcProfiles, societies } from "@workspace/db";
import { getDb, requireAuth, requireRole } from "../lib/session";
import { developerMarketplaceProfile, pmcMarketplaceProfile, profileCompletion, societyMarketplaceProfile } from "../lib/profile-policy";

const router: IRouter = Router();
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();
const stringList = z.array(z.string().trim().min(1).max(160)).max(30).default([]);
const portfolioSchema = z.array(z.object({
  title: z.string().trim().min(2).max(220),
  location: optionalText(180), description: optionalText(2000),
  completionYear: z.number().int().min(1900).max(2200).nullable().optional(), projectType: optionalText(160),
})).max(30).default([]);
const credentialSchema = z.array(z.object({
  name: z.string().trim().min(2).max(220), issuer: optionalText(220), reference: optionalText(220), isPublic: z.boolean().default(false),
})).max(30).default([]);
const commonSchema = z.object({
  organizationName: z.string().trim().min(2).max(220), location: optionalText(160), marketplaceVisible: z.boolean().default(true),
});
const societySchema = commonSchema.extend({
  address: optionalText(1000), city: z.string().trim().min(2).max(120).default("Mumbai"),
  contactName: optionalText(160), contactEmail: z.string().trim().email().max(320).nullable().optional(), contactPhone: optionalText(40),
  numberBuildings: z.number().int().positive().max(1000).nullable().optional(), numberWings: z.number().int().positive().max(5000).nullable().optional(),
  unitCount: z.number().int().positive().max(100000).nullable().optional(), memberCount: z.number().int().positive().max(100000).nullable().optional(),
  buildingAge: z.number().int().nonnegative().max(300).nullable().optional(), propertyType: optionalText(120), landArea: optionalText(120),
  redevelopmentStatus: optionalText(120), description: optionalText(5000),
});
const developerSchema = commonSchema.extend({
  logoUrl: z.string().trim().url().max(1000).nullable().optional(), description: optionalText(5000), website: z.string().trim().url().max(500).nullable().optional(),
  publicEmail: z.string().trim().email().max(320).nullable().optional(), publicPhone: optionalText(40), officeLocation: optionalText(220),
  areasServed: stringList, specializations: stringList, teamInformation: optionalText(5000), portfolio: portfolioSchema, credentials: credentialSchema,
});
const pmcSchema = commonSchema.extend({
  logoUrl: z.string().trim().url().max(1000).nullable().optional(), description: optionalText(5000), website: z.string().trim().url().max(500).nullable().optional(),
  publicEmail: z.string().trim().email().max(320).nullable().optional(), publicPhone: optionalText(40), officeLocation: optionalText(220),
  locationsServed: stringList, services: stringList, specializations: stringList, teamInformation: optionalText(5000), portfolio: portfolioSchema, credentials: credentialSchema,
});

async function readOwnerProfile(organizationId: string, role: string) {
  const database = getDb();
  if (role === "SOCIETY") {
    const [profile] = await database.select({
      organizationId: organizations.id, organizationName: organizations.name, location: organizations.location,
      address: societies.address, city: societies.city, contactName: societies.contactName, contactEmail: societies.contactEmail,
      contactPhone: societies.contactPhone, numberBuildings: societies.numberBuildings, numberWings: societies.numberWings,
      unitCount: societies.unitCount, memberCount: societies.memberCount, buildingAge: societies.buildingAge,
      propertyType: societies.propertyType, landArea: societies.landArea, redevelopmentStatus: societies.redevelopmentStatus,
      description: societies.description, marketplaceVisible: societies.marketplaceVisible,
    }).from(organizations).innerJoin(societies, eq(societies.organizationId, organizations.id)).where(eq(organizations.id, organizationId)).limit(1);
    return profile ? { role, ...profile } : null;
  }
  if (role === "DEVELOPER") {
    const [profile] = await database.select({
      organizationId: organizations.id, organizationName: organizations.name, location: organizations.location,
      logoUrl: developerProfiles.logoUrl, description: developerProfiles.description, website: developerProfiles.website,
      publicEmail: developerProfiles.publicEmail, publicPhone: developerProfiles.publicPhone, officeLocation: developerProfiles.officeLocation,
      areasServed: developerProfiles.areasServed, specializations: developerProfiles.specializations, teamInformation: developerProfiles.teamInformation,
      portfolio: developerProfiles.portfolio, credentials: developerProfiles.credentials, marketplaceVisible: developerProfiles.marketplaceVisible,
    }).from(organizations).leftJoin(developerProfiles, eq(developerProfiles.organizationId, organizations.id)).where(eq(organizations.id, organizationId)).limit(1);
    return profile ? { role, ...profile, areasServed: profile.areasServed ?? [], specializations: profile.specializations ?? [], portfolio: profile.portfolio ?? [], credentials: profile.credentials ?? [], marketplaceVisible: profile.marketplaceVisible ?? true } : null;
  }
  if (role === "PMC") {
    const [profile] = await database.select({
      organizationId: organizations.id, organizationName: organizations.name, location: organizations.location,
      logoUrl: pmcProfiles.logoUrl, description: pmcProfiles.description, website: pmcProfiles.website,
      publicEmail: pmcProfiles.publicEmail, publicPhone: pmcProfiles.publicPhone, officeLocation: pmcProfiles.officeLocation,
      locationsServed: pmcProfiles.locationsServed, services: pmcProfiles.services, specializations: pmcProfiles.specializations,
      teamInformation: pmcProfiles.teamInformation, portfolio: pmcProfiles.portfolio, credentials: pmcProfiles.credentials,
      marketplaceVisible: pmcProfiles.marketplaceVisible,
    }).from(organizations).leftJoin(pmcProfiles, eq(pmcProfiles.organizationId, organizations.id)).where(eq(organizations.id, organizationId)).limit(1);
    return profile ? { role, ...profile, locationsServed: profile.locationsServed ?? [], services: profile.services ?? [], specializations: profile.specializations ?? [], portfolio: profile.portfolio ?? [], credentials: profile.credentials ?? [], marketplaceVisible: profile.marketplaceVisible ?? true } : null;
  }
  return null;
}

function publicProfile(profile: NonNullable<Awaited<ReturnType<typeof readOwnerProfile>>>) {
  if (profile.role === "SOCIETY") return societyMarketplaceProfile(profile as Parameters<typeof societyMarketplaceProfile>[0]);
  if (profile.role === "DEVELOPER") return developerMarketplaceProfile(profile as Parameters<typeof developerMarketplaceProfile>[0]);
  return pmcMarketplaceProfile(profile as Parameters<typeof pmcMarketplaceProfile>[0]);
}

router.get("/profiles/me", requireAuth(), requireRole("SOCIETY", "DEVELOPER", "PMC"), async (request, response, next) => {
  try {
    if (!request.auth!.organizationId) return response.status(409).json({ error: "Your account is not connected to an organization" });
    const profile = await readOwnerProfile(request.auth!.organizationId, request.auth!.role);
    if (!profile) return response.status(404).json({ error: "Profile not found" });
    return response.json({ profile, completion: profileCompletion(request.auth!.role as "SOCIETY" | "DEVELOPER" | "PMC", profile) });
  } catch (error) { return next(error); }
});

router.put("/profiles/me", requireAuth(), requireRole("SOCIETY", "DEVELOPER", "PMC"), async (request, response, next) => {
  try {
    const organizationId = request.auth!.organizationId;
    if (!organizationId) return response.status(409).json({ error: "Your account is not connected to an organization" });
    const role = request.auth!.role;
    const input = role === "SOCIETY" ? societySchema.parse(request.body) : role === "DEVELOPER" ? developerSchema.parse(request.body) : pmcSchema.parse(request.body);
    const database = getDb();
    await database.transaction(async (tx) => {
      await tx.update(organizations).set({ name: input.organizationName, location: input.location ?? null, updatedAt: new Date() }).where(eq(organizations.id, organizationId));
      if (role === "SOCIETY") {
        const value = input as z.infer<typeof societySchema>;
        await tx.update(societies).set({ address: value.address ?? null, city: value.city, contactName: value.contactName ?? null, contactEmail: value.contactEmail ?? null,
          contactPhone: value.contactPhone ?? null, numberBuildings: value.numberBuildings ?? null, numberWings: value.numberWings ?? null,
          unitCount: value.unitCount ?? null, memberCount: value.memberCount ?? null, buildingAge: value.buildingAge ?? null,
          propertyType: value.propertyType ?? null, landArea: value.landArea ?? null, redevelopmentStatus: value.redevelopmentStatus ?? null,
          description: value.description ?? null, marketplaceVisible: value.marketplaceVisible, updatedAt: new Date() }).where(eq(societies.organizationId, organizationId));
      } else if (role === "DEVELOPER") {
        const value = input as z.infer<typeof developerSchema>;
        await tx.insert(developerProfiles).values({ organizationId, logoUrl: value.logoUrl ?? null, description: value.description ?? null, website: value.website ?? null,
          publicEmail: value.publicEmail ?? null, publicPhone: value.publicPhone ?? null, officeLocation: value.officeLocation ?? null,
          areasServed: value.areasServed, specializations: value.specializations, teamInformation: value.teamInformation ?? null,
          portfolio: value.portfolio, credentials: value.credentials, marketplaceVisible: value.marketplaceVisible })
          .onConflictDoUpdate({ target: developerProfiles.organizationId, set: { logoUrl: value.logoUrl ?? null, description: value.description ?? null, website: value.website ?? null,
            publicEmail: value.publicEmail ?? null, publicPhone: value.publicPhone ?? null, officeLocation: value.officeLocation ?? null,
            areasServed: value.areasServed, specializations: value.specializations, teamInformation: value.teamInformation ?? null,
            portfolio: value.portfolio, credentials: value.credentials, marketplaceVisible: value.marketplaceVisible, updatedAt: new Date() } });
      } else {
        const value = input as z.infer<typeof pmcSchema>;
        await tx.insert(pmcProfiles).values({ organizationId, logoUrl: value.logoUrl ?? null, description: value.description ?? null, website: value.website ?? null,
          publicEmail: value.publicEmail ?? null, publicPhone: value.publicPhone ?? null, officeLocation: value.officeLocation ?? null,
          locationsServed: value.locationsServed, services: value.services, specializations: value.specializations,
          teamInformation: value.teamInformation ?? null, portfolio: value.portfolio, credentials: value.credentials, marketplaceVisible: value.marketplaceVisible })
          .onConflictDoUpdate({ target: pmcProfiles.organizationId, set: { logoUrl: value.logoUrl ?? null, description: value.description ?? null, website: value.website ?? null,
            publicEmail: value.publicEmail ?? null, publicPhone: value.publicPhone ?? null, officeLocation: value.officeLocation ?? null,
            locationsServed: value.locationsServed, services: value.services, specializations: value.specializations,
            teamInformation: value.teamInformation ?? null, portfolio: value.portfolio, credentials: value.credentials, marketplaceVisible: value.marketplaceVisible, updatedAt: new Date() } });
      }
    });
    const profile = await readOwnerProfile(organizationId, role);
    return response.json({ profile, completion: profileCompletion(role as "SOCIETY" | "DEVELOPER" | "PMC", profile ?? {}) });
  } catch (error) { return next(error); }
});

router.get("/profiles/me/preview", requireAuth(), requireRole("SOCIETY", "DEVELOPER", "PMC"), async (request, response, next) => {
  try {
    if (!request.auth!.organizationId) return response.status(409).json({ error: "Your account is not connected to an organization" });
    const profile = await readOwnerProfile(request.auth!.organizationId, request.auth!.role);
    if (!profile) return response.status(404).json({ error: "Profile not found" });
    return response.json({ profile: publicProfile(profile) });
  } catch (error) { return next(error); }
});

router.get("/marketplace/organizations/:id", requireAuth(), requireRole("SOCIETY"), async (request, response, next) => {
  try {
    const database = getDb();
    const [organization] = await database.select({ id: organizations.id, kind: organizations.kind }).from(organizations).where(eq(organizations.id, String(request.params.id))).limit(1);
    if (!organization || !["DEVELOPER", "PMC"].includes(organization.kind)) return response.status(404).json({ error: "Organization profile not found" });
    const profile = await readOwnerProfile(organization.id, organization.kind);
    const visible = profile ? publicProfile(profile) : null;
    if (!visible) return response.status(404).json({ error: "Organization profile not found" });
    return response.json({ profile: visible });
  } catch (error) { return next(error); }
});

export default router;
