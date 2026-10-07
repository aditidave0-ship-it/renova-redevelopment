import { createHash, randomBytes } from "node:crypto";
import { Router, type IRouter } from "express";
import { z } from "@workspace/api-zod";
import { and, count, desc, eq, gte } from "drizzle-orm";
import { enquiries, requireDb } from "@workspace/db";
import { requireAuth, requireRole } from "../lib/session";

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
  source: z.enum(["WEBSITE", "FEASIBILITY"]).default("WEBSITE"),
});

function fingerprint(request: { ip?: string }, email: string): string {
  return createHash("sha256")
    .update(`${request.ip || "unknown"}|${email}`)
    .digest("hex");
}

function reference(): string {
  return `REQ-${new Date().getUTCFullYear()}-${randomBytes(5).toString("hex").toUpperCase()}`;
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
    await database.insert(enquiries).values({
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
    });
    return response.status(201).json({ reference: enquiryReference });
  } catch (error) {
    return next(error);
  }
});

router.get(
  "/admin/enquiries",
  requireAuth(),
  requireRole("ADMIN"),
  async (_request, response, next) => {
    try {
      const database = requireDb();
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
          createdAt: enquiries.createdAt,
        })
        .from(enquiries)
        .orderBy(desc(enquiries.createdAt))
        .limit(250);
      return response.json({ enquiries: rows });
    } catch (error) {
      return next(error);
    }
  },
);

export default router;
