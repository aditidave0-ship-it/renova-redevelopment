import { createHash, randomBytes } from "node:crypto";
import { Readable } from "node:stream";
import express, { Router, type IRouter } from "express";
import { get, put } from "@vercel/blob";
import { z } from "@workspace/api-zod";
import { and, asc, desc, eq } from "drizzle-orm";
import {
  auditLogs,
  feasibilityAssessments,
  feasibilityAssumptions,
  feasibilityDocuments,
  feasibilityPropertyData,
  feasibilityRequests,
  feasibilityStatusHistory,
  organizations,
  societies,
} from "@workspace/db";
import { getDb, requireAuth, requireRole } from "../lib/session";
import {
  assertFeasibilityOwnership,
  assertFeasibilityTransition,
  canSocietyEditFeasibility,
  documentContentMatchesType,
  FEASIBILITY_STATUSES,
  requiresMissingInformation,
  type FeasibilityStatus,
} from "../lib/feasibility-policy";

const router: IRouter = Router();
const optionalText = (max: number) =>
  z.string().trim().max(max).nullable().optional();
const optionalInteger = z
  .number()
  .int()
  .nonnegative()
  .max(1_000_000)
  .nullable()
  .optional();

const societyDetailsSchema = z.object({
  societyName: z.string().trim().min(2).max(220),
  propertyAddress: z.string().trim().min(5).max(2000),
  locality: z.string().trim().min(2).max(180),
  city: z.string().trim().min(2).max(120),
  pinCode: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter a valid 6-digit PIN code"),
  contactPerson: z.string().trim().min(2).max(160),
  contactEmail: z.string().trim().email().max(320),
  contactPhone: z.string().trim().min(8).max(40),
});

const propertyDataSchema = z.object({
  plotArea: optionalText(160),
  numberBuildings: optionalInteger,
  numberWings: optionalInteger,
  existingFloors: optionalText(160),
  residentialUnits: optionalInteger,
  commercialUnits: optionalInteger,
  existingBuiltUpInformation: optionalText(4000),
  approximateBuildingAge: optionalInteger,
  existingParking: optionalText(2000),
  existingAmenities: optionalText(2000),
  ctsSurveyInformation: optionalText(2000),
  existingApprovedPlans: optionalText(2000),
  propertyCardInformation: optionalText(2000),
  conveyanceInformation: optionalText(2000),
  existingFsiInformation: optionalText(2000),
  roadWidth: optionalText(160),
  reservationsRestrictions: optionalText(4000),
  otherPropertyInformation: optionalText(4000),
  unknownFields: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
});

const requestInputSchema = societyDetailsSchema.extend({
  propertyData: propertyDataSchema,
});
const statusSchema = z.object({
  status: z.enum(FEASIBILITY_STATUSES),
  note: optionalText(4000),
  missingInformation: optionalText(4000),
});
const assessmentSchema = z.object({
  existingProperty: optionalText(8000),
  plotInformation: optionalText(8000),
  existingBuiltUpArea: optionalText(8000),
  applicablePlanningInputs: optionalText(8000),
  potentialDevelopmentInputs: optionalText(8000),
  rehabilitationRequirement: optionalText(8000),
  potentialSaleComponent: optionalText(8000),
  parkingAmenityConsiderations: optionalText(8000),
  keyConstraints: optionalText(8000),
  professionalNotes: optionalText(8000),
  documentsReviewed: z.array(z.string().uuid()).max(100).default([]),
  assumptions: z.array(z.string().trim().min(2).max(4000)).max(100).default([]),
  assessmentDate: z.string().datetime().nullable().optional(),
});

const ALLOWED_DOCUMENT_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

function reference(): string {
  return `FEAS-${new Date().getUTCFullYear()}-${randomBytes(4).toString("hex").toUpperCase()}`;
}

function privateStorageConfigured(): boolean {
  return Boolean(
    process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN,
  );
}

async function societyIdForOrganization(
  organizationId: string | null,
): Promise<string | null> {
  if (!organizationId) return null;
  const [society] = await getDb()
    .select({ id: societies.id })
    .from(societies)
    .where(eq(societies.organizationId, organizationId))
    .limit(1);
  return society?.id ?? null;
}

async function requestRecord(id: string) {
  const [item] = await getDb()
    .select()
    .from(feasibilityRequests)
    .where(eq(feasibilityRequests.id, id))
    .limit(1);
  return item ?? null;
}

async function requestDetail(
  id: string,
  includeUnpublishedAssessment: boolean,
) {
  const database = getDb();
  const request = await requestRecord(id);
  if (!request) return null;
  const [propertyData, documents, history, assessment] = await Promise.all([
    database
      .select()
      .from(feasibilityPropertyData)
      .where(eq(feasibilityPropertyData.requestId, id))
      .limit(1),
    database
      .select({
        id: feasibilityDocuments.id,
        category: feasibilityDocuments.category,
        fileName: feasibilityDocuments.fileName,
        contentType: feasibilityDocuments.contentType,
        sizeBytes: feasibilityDocuments.sizeBytes,
        status: feasibilityDocuments.status,
        createdAt: feasibilityDocuments.createdAt,
      })
      .from(feasibilityDocuments)
      .where(
        and(
          eq(feasibilityDocuments.requestId, id),
          eq(feasibilityDocuments.status, "AVAILABLE"),
        ),
      )
      .orderBy(desc(feasibilityDocuments.createdAt)),
    database
      .select()
      .from(feasibilityStatusHistory)
      .where(eq(feasibilityStatusHistory.requestId, id))
      .orderBy(asc(feasibilityStatusHistory.createdAt)),
    database
      .select()
      .from(feasibilityAssessments)
      .where(eq(feasibilityAssessments.requestId, id))
      .limit(1),
  ]);
  const visibleAssessment =
    assessment[0] && (includeUnpublishedAssessment || assessment[0].publishedAt)
      ? assessment[0]
      : null;
  const assumptions = visibleAssessment
    ? await database
        .select()
        .from(feasibilityAssumptions)
        .where(eq(feasibilityAssumptions.assessmentId, visibleAssessment.id))
        .orderBy(asc(feasibilityAssumptions.createdAt))
    : [];
  return {
    ...request,
    propertyData: propertyData[0] ?? null,
    documents,
    history,
    assessment: visibleAssessment
      ? {
          ...visibleAssessment,
          assumptions: assumptions.map((item) => item.statement),
        }
      : null,
    documentUploadsEnabled: privateStorageConfigured(),
  };
}

async function audit(
  actorUserId: string,
  action: string,
  entityId: string,
  metadata?: object,
) {
  await getDb()
    .insert(auditLogs)
    .values({
      actorUserId,
      action,
      entityType: "FEASIBILITY_REQUEST",
      entityId,
      metadata: metadata ? JSON.stringify(metadata) : null,
    });
}

router.get(
  "/feasibility/me",
  requireAuth(),
  requireRole("SOCIETY"),
  async (request, response, next) => {
    try {
      const societyId = await societyIdForOrganization(
        request.auth!.organizationId,
      );
      if (!societyId)
        return response.status(409).json({
          error: "Complete your Society profile before requesting feasibility",
        });
      const requests = await getDb()
        .select()
        .from(feasibilityRequests)
        .where(eq(feasibilityRequests.societyId, societyId))
        .orderBy(desc(feasibilityRequests.updatedAt));
      return response.json({
        requests,
        documentUploadsEnabled: privateStorageConfigured(),
      });
    } catch (error) {
      return next(error);
    }
  },
);

router.post(
  "/feasibility",
  requireAuth(),
  requireRole("SOCIETY"),
  async (request, response, next) => {
    try {
      const input = requestInputSchema.parse(request.body);
      const societyId = await societyIdForOrganization(
        request.auth!.organizationId,
      );
      if (!societyId)
        return response.status(409).json({
          error: "Complete your Society profile before requesting feasibility",
        });
      const database = getDb();
      const [created] = await database.transaction(async (tx) => {
        const rows = await tx
          .insert(feasibilityRequests)
          .values({
            reference: reference(),
            societyId,
            createdByUserId: request.auth!.userId,
            societyName: input.societyName,
            propertyAddress: input.propertyAddress,
            locality: input.locality,
            city: input.city,
            pinCode: input.pinCode,
            contactPerson: input.contactPerson,
            contactEmail: input.contactEmail,
            contactPhone: input.contactPhone,
          })
          .returning();
        await tx
          .insert(feasibilityPropertyData)
          .values({ requestId: rows[0].id, ...input.propertyData });
        await tx.insert(feasibilityStatusHistory).values({
          requestId: rows[0].id,
          toStatus: "DRAFT",
          changedByUserId: request.auth!.userId,
          note: "Draft created",
        });
        return rows;
      });
      await audit(request.auth!.userId, "FEASIBILITY_CREATED", created.id);
      return response
        .status(201)
        .json({ request: await requestDetail(created.id, false) });
    } catch (error) {
      return next(error);
    }
  },
);

router.get(
  "/feasibility/:id",
  requireAuth(),
  requireRole("SOCIETY"),
  async (request, response, next) => {
    try {
      const record = await requestRecord(String(request.params.id));
      if (!record)
        return response
          .status(404)
          .json({ error: "Feasibility request not found" });
      assertFeasibilityOwnership(
        record.societyId,
        await societyIdForOrganization(request.auth!.organizationId),
      );
      return response.json({ request: await requestDetail(record.id, false) });
    } catch (error) {
      return next(error);
    }
  },
);

router.put(
  "/feasibility/:id",
  requireAuth(),
  requireRole("SOCIETY"),
  async (request, response, next) => {
    try {
      const input = requestInputSchema.parse(request.body);
      const record = await requestRecord(String(request.params.id));
      if (!record)
        return response
          .status(404)
          .json({ error: "Feasibility request not found" });
      assertFeasibilityOwnership(
        record.societyId,
        await societyIdForOrganization(request.auth!.organizationId),
      );
      if (!canSocietyEditFeasibility(record.status))
        return response.status(409).json({
          error: "This request cannot be edited in its current status",
        });
      await getDb().transaction(async (tx) => {
        await tx
          .update(feasibilityRequests)
          .set({
            societyName: input.societyName,
            propertyAddress: input.propertyAddress,
            locality: input.locality,
            city: input.city,
            pinCode: input.pinCode,
            contactPerson: input.contactPerson,
            contactEmail: input.contactEmail,
            contactPhone: input.contactPhone,
            updatedAt: new Date(),
          })
          .where(eq(feasibilityRequests.id, record.id));
        await tx
          .update(feasibilityPropertyData)
          .set({ ...input.propertyData, updatedAt: new Date() })
          .where(eq(feasibilityPropertyData.requestId, record.id));
      });
      await audit(request.auth!.userId, "FEASIBILITY_UPDATED", record.id);
      return response.json({ request: await requestDetail(record.id, false) });
    } catch (error) {
      return next(error);
    }
  },
);

router.post(
  "/feasibility/:id/submit",
  requireAuth(),
  requireRole("SOCIETY"),
  async (request, response, next) => {
    try {
      const record = await requestRecord(String(request.params.id));
      if (!record)
        return response
          .status(404)
          .json({ error: "Feasibility request not found" });
      assertFeasibilityOwnership(
        record.societyId,
        await societyIdForOrganization(request.auth!.organizationId),
      );
      const target: FeasibilityStatus = "SUBMITTED";
      assertFeasibilityTransition(record.status, target);
      await getDb().transaction(async (tx) => {
        await tx
          .update(feasibilityRequests)
          .set({
            status: target,
            submittedAt: new Date(),
            missingInformation: null,
            updatedAt: new Date(),
          })
          .where(eq(feasibilityRequests.id, record.id));
        await tx.insert(feasibilityStatusHistory).values({
          requestId: record.id,
          fromStatus: record.status,
          toStatus: target,
          changedByUserId: request.auth!.userId,
          note:
            record.status === "MORE_INFORMATION_REQUIRED"
              ? "Additional information supplied"
              : "Submitted for review",
        });
      });
      await audit(request.auth!.userId, "FEASIBILITY_SUBMITTED", record.id);
      return response.json({ request: await requestDetail(record.id, false) });
    } catch (error) {
      return next(error);
    }
  },
);

router.post(
  "/feasibility/:id/documents",
  requireAuth(),
  requireRole("SOCIETY"),
  express.raw({
    type: ["application/pdf", "image/jpeg", "image/png"],
    limit: MAX_DOCUMENT_BYTES,
  }),
  async (request, response, next) => {
    try {
      if (!privateStorageConfigured())
        return response
          .status(503)
          .json({ error: "Secure document storage is not configured yet" });
      const record = await requestRecord(String(request.params.id));
      if (!record)
        return response
          .status(404)
          .json({ error: "Feasibility request not found" });
      assertFeasibilityOwnership(
        record.societyId,
        await societyIdForOrganization(request.auth!.organizationId),
      );
      if (!canSocietyEditFeasibility(record.status))
        return response
          .status(409)
          .json({ error: "Documents cannot be added in this status" });
      const fileName = z
        .string()
        .trim()
        .min(1)
        .max(500)
        .parse(request.query.fileName);
      const category = z
        .string()
        .trim()
        .min(2)
        .max(80)
        .parse(request.query.category);
      const contentType = String(request.headers["content-type"] ?? "").split(
        ";",
      )[0];
      if (!ALLOWED_DOCUMENT_TYPES.has(contentType))
        return response
          .status(415)
          .json({ error: "Only PDF, JPG and PNG documents are supported" });
      if (!Buffer.isBuffer(request.body) || request.body.length === 0)
        return response
          .status(400)
          .json({ error: "Document content is required" });
      if (!documentContentMatchesType(request.body, contentType))
        return response
          .status(400)
          .json({ error: "Document content does not match its file type" });
      const safeName = fileName.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-180);
      const storageKey = `feasibility/${record.id}/${randomBytes(12).toString("hex")}-${safeName}`;
      await put(storageKey, request.body, {
        access: "private",
        contentType,
        addRandomSuffix: false,
      });
      const [document] = await getDb()
        .insert(feasibilityDocuments)
        .values({
          requestId: record.id,
          uploadedByUserId: request.auth!.userId,
          category,
          fileName,
          contentType,
          sizeBytes: request.body.length,
          storageProvider: "VERCEL_BLOB_PRIVATE",
          storageKey,
          checksumSha256: createHash("sha256")
            .update(request.body)
            .digest("hex"),
          status: "AVAILABLE",
        })
        .returning({
          id: feasibilityDocuments.id,
          fileName: feasibilityDocuments.fileName,
        });
      await audit(
        request.auth!.userId,
        "FEASIBILITY_DOCUMENT_ADDED",
        record.id,
        { documentId: document.id, category },
      );
      return response.status(201).json({ document });
    } catch (error) {
      return next(error);
    }
  },
);

router.get(
  "/feasibility/:id/documents/:documentId",
  requireAuth(),
  requireRole("SOCIETY", "ADMIN"),
  async (request, response, next) => {
    try {
      const record = await requestRecord(String(request.params.id));
      if (!record)
        return response.status(404).json({ error: "Document not found" });
      if (request.auth!.role === "SOCIETY")
        assertFeasibilityOwnership(
          record.societyId,
          await societyIdForOrganization(request.auth!.organizationId),
        );
      const [document] = await getDb()
        .select()
        .from(feasibilityDocuments)
        .where(
          and(
            eq(feasibilityDocuments.id, String(request.params.documentId)),
            eq(feasibilityDocuments.requestId, record.id),
            eq(feasibilityDocuments.status, "AVAILABLE"),
          ),
        )
        .limit(1);
      if (!document)
        return response.status(404).json({ error: "Document not found" });
      const blob = await get(document.storageKey, { access: "private" });
      if (!blob || blob.statusCode !== 200)
        return response.status(404).json({ error: "Document not found" });
      response.setHeader("Content-Type", document.contentType);
      response.setHeader(
        "Content-Disposition",
        `attachment; filename*=UTF-8''${encodeURIComponent(document.fileName)}`,
      );
      response.setHeader("Cache-Control", "private, no-store");
      return Readable.fromWeb(blob.stream as never).pipe(response);
    } catch (error) {
      return next(error);
    }
  },
);

router.get(
  "/admin/feasibility",
  requireAuth(),
  requireRole("ADMIN"),
  async (_request, response, next) => {
    try {
      const requests = await getDb()
        .select({
          id: feasibilityRequests.id,
          reference: feasibilityRequests.reference,
          societyName: feasibilityRequests.societyName,
          locality: feasibilityRequests.locality,
          city: feasibilityRequests.city,
          status: feasibilityRequests.status,
          submittedAt: feasibilityRequests.submittedAt,
          updatedAt: feasibilityRequests.updatedAt,
        })
        .from(feasibilityRequests)
        .orderBy(desc(feasibilityRequests.updatedAt));
      return response.json({ requests });
    } catch (error) {
      return next(error);
    }
  },
);

router.get(
  "/admin/feasibility/:id",
  requireAuth(),
  requireRole("ADMIN"),
  async (request, response, next) => {
    try {
      const detail = await requestDetail(String(request.params.id), true);
      if (!detail)
        return response
          .status(404)
          .json({ error: "Feasibility request not found" });
      return response.json({ request: detail });
    } catch (error) {
      return next(error);
    }
  },
);

router.patch(
  "/admin/feasibility/:id/status",
  requireAuth(),
  requireRole("ADMIN"),
  async (request, response, next) => {
    try {
      const input = statusSchema.parse(request.body);
      if (input.status === "ASSESSMENT_READY")
        return response.status(400).json({
          error: "Publish the professional assessment to mark it ready",
        });
      const record = await requestRecord(String(request.params.id));
      if (!record)
        return response
          .status(404)
          .json({ error: "Feasibility request not found" });
      assertFeasibilityTransition(record.status, input.status);
      if (requiresMissingInformation(input.status) && !input.missingInformation)
        return response
          .status(400)
          .json({ error: "Describe the additional information required" });
      await getDb().transaction(async (tx) => {
        await tx
          .update(feasibilityRequests)
          .set({
            status: input.status,
            missingInformation:
              input.status === "MORE_INFORMATION_REQUIRED"
                ? input.missingInformation
                : null,
            closedAt: input.status === "CLOSED" ? new Date() : null,
            updatedAt: new Date(),
          })
          .where(eq(feasibilityRequests.id, record.id));
        await tx.insert(feasibilityStatusHistory).values({
          requestId: record.id,
          fromStatus: record.status,
          toStatus: input.status,
          changedByUserId: request.auth!.userId,
          note: input.note ?? input.missingInformation ?? null,
        });
      });
      await audit(
        request.auth!.userId,
        "FEASIBILITY_STATUS_CHANGED",
        record.id,
        { from: record.status, to: input.status },
      );
      return response.json({ request: await requestDetail(record.id, true) });
    } catch (error) {
      return next(error);
    }
  },
);

router.put(
  "/admin/feasibility/:id/assessment",
  requireAuth(),
  requireRole("ADMIN"),
  async (request, response, next) => {
    try {
      const input = assessmentSchema.parse(request.body);
      const record = await requestRecord(String(request.params.id));
      if (!record)
        return response
          .status(404)
          .json({ error: "Feasibility request not found" });
      if (["DRAFT", "ASSESSMENT_READY", "CLOSED"].includes(record.status))
        return response.status(409).json({
          error: "An assessment cannot be edited in this status",
        });
      const database = getDb();
      const assessment = await database.transaction(async (tx) => {
        const [saved] = await tx
          .insert(feasibilityAssessments)
          .values({
            requestId: record.id,
            preparedByUserId: request.auth!.userId,
            existingProperty: input.existingProperty ?? null,
            plotInformation: input.plotInformation ?? null,
            existingBuiltUpArea: input.existingBuiltUpArea ?? null,
            applicablePlanningInputs: input.applicablePlanningInputs ?? null,
            potentialDevelopmentInputs:
              input.potentialDevelopmentInputs ?? null,
            rehabilitationRequirement: input.rehabilitationRequirement ?? null,
            potentialSaleComponent: input.potentialSaleComponent ?? null,
            parkingAmenityConsiderations:
              input.parkingAmenityConsiderations ?? null,
            keyConstraints: input.keyConstraints ?? null,
            professionalNotes: input.professionalNotes ?? null,
            documentsReviewed: input.documentsReviewed,
            assessmentDate: input.assessmentDate
              ? new Date(input.assessmentDate)
              : null,
          })
          .onConflictDoUpdate({
            target: feasibilityAssessments.requestId,
            set: {
              preparedByUserId: request.auth!.userId,
              existingProperty: input.existingProperty ?? null,
              plotInformation: input.plotInformation ?? null,
              existingBuiltUpArea: input.existingBuiltUpArea ?? null,
              applicablePlanningInputs: input.applicablePlanningInputs ?? null,
              potentialDevelopmentInputs:
                input.potentialDevelopmentInputs ?? null,
              rehabilitationRequirement:
                input.rehabilitationRequirement ?? null,
              potentialSaleComponent: input.potentialSaleComponent ?? null,
              parkingAmenityConsiderations:
                input.parkingAmenityConsiderations ?? null,
              keyConstraints: input.keyConstraints ?? null,
              professionalNotes: input.professionalNotes ?? null,
              documentsReviewed: input.documentsReviewed,
              assessmentDate: input.assessmentDate
                ? new Date(input.assessmentDate)
                : null,
              updatedAt: new Date(),
            },
          })
          .returning();
        await tx
          .delete(feasibilityAssumptions)
          .where(eq(feasibilityAssumptions.assessmentId, saved.id));
        if (input.assumptions.length)
          await tx.insert(feasibilityAssumptions).values(
            input.assumptions.map((statement) => ({
              assessmentId: saved.id,
              statement,
              createdByUserId: request.auth!.userId,
            })),
          );
        return saved;
      });
      await audit(
        request.auth!.userId,
        "FEASIBILITY_ASSESSMENT_UPDATED",
        record.id,
        { assessmentId: assessment.id },
      );
      return response.json({ request: await requestDetail(record.id, true) });
    } catch (error) {
      return next(error);
    }
  },
);

router.post(
  "/admin/feasibility/:id/publish",
  requireAuth(),
  requireRole("ADMIN"),
  async (request, response, next) => {
    try {
      const record = await requestRecord(String(request.params.id));
      if (!record)
        return response
          .status(404)
          .json({ error: "Feasibility request not found" });
      assertFeasibilityTransition(record.status, "ASSESSMENT_READY");
      const [assessment] = await getDb()
        .select()
        .from(feasibilityAssessments)
        .where(eq(feasibilityAssessments.requestId, record.id))
        .limit(1);
      if (!assessment)
        return response.status(409).json({
          error: "Record a professional assessment before publishing",
        });
      const now = new Date();
      await getDb().transaction(async (tx) => {
        await tx
          .update(feasibilityAssessments)
          .set({
            publishedAt: now,
            assessmentDate: assessment.assessmentDate ?? now,
            updatedAt: now,
          })
          .where(eq(feasibilityAssessments.id, assessment.id));
        await tx
          .update(feasibilityRequests)
          .set({ status: "ASSESSMENT_READY", updatedAt: now })
          .where(eq(feasibilityRequests.id, record.id));
        await tx.insert(feasibilityStatusHistory).values({
          requestId: record.id,
          fromStatus: record.status,
          toStatus: "ASSESSMENT_READY",
          changedByUserId: request.auth!.userId,
          note: "Professional assessment published to the Society",
        });
      });
      await audit(
        request.auth!.userId,
        "FEASIBILITY_ASSESSMENT_PUBLISHED",
        record.id,
        { assessmentId: assessment.id },
      );
      return response.json({ request: await requestDetail(record.id, true) });
    } catch (error) {
      return next(error);
    }
  },
);

router.get(
  "/feasibility-context/society",
  requireAuth(),
  requireRole("SOCIETY"),
  async (request, response, next) => {
    try {
      if (!request.auth!.organizationId)
        return response
          .status(409)
          .json({ error: "Society organization is not available" });
      const [profile] = await getDb()
        .select({
          societyName: organizations.name,
          propertyAddress: societies.address,
          city: societies.city,
          contactPerson: societies.contactName,
          contactEmail: societies.contactEmail,
          contactPhone: societies.contactPhone,
          numberBuildings: societies.numberBuildings,
          numberWings: societies.numberWings,
          residentialUnits: societies.unitCount,
          approximateBuildingAge: societies.buildingAge,
          plotArea: societies.landArea,
        })
        .from(organizations)
        .innerJoin(societies, eq(societies.organizationId, organizations.id))
        .where(eq(organizations.id, request.auth!.organizationId))
        .limit(1);
      return response.json({ profile: profile ?? null });
    } catch (error) {
      return next(error);
    }
  },
);

export default router;
