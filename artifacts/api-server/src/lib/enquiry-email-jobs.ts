import { and, eq, inArray, lte } from "drizzle-orm";
import { enquiries, enquiryEmailJobs, requireDb } from "@workspace/db";
import {
  getEmailBrand,
  getEmailProvider,
  isEmailDeliveryConfigured,
  enquiryAcknowledgementEmail,
  adminEnquiryNotificationEmail,
} from "./email";

// No OTP/reset tokens in this outbox. Only persisted enquiry references are used.
// Admin processing is explicit until a reviewed background runner is configured.
export async function processEnquiryEmailJobs(enquiryId?: string) {
  const db = requireDb();
  const candidates = await db
    .select({ id: enquiryEmailJobs.id })
    .from(enquiryEmailJobs)
    .where(
      and(
        inArray(enquiryEmailJobs.status, ["QUEUED", "RETRY", "NOT_CONFIGURED"]),
        lte(enquiryEmailJobs.nextAttemptAt, new Date()),
        ...(enquiryId ? [eq(enquiryEmailJobs.enquiryId, enquiryId)] : []),
      ),
    )
    .limit(2);
  for (const candidate of candidates)
    await db.transaction(async (tx) => {
      const [job] = await tx
        .select()
        .from(enquiryEmailJobs)
        .where(eq(enquiryEmailJobs.id, candidate.id))
        .for("update", { skipLocked: true });
      if (
        !job ||
        job.status === "ACCEPTED" ||
        job.status === "MANUAL_REVIEW" ||
        job.nextAttemptAt > new Date()
      )
        return;
      const [enquiry] = await tx
        .select()
        .from(enquiries)
        .where(eq(enquiries.id, job.enquiryId));
      if (!enquiry) return;
      let brand;
      try {
        brand = getEmailBrand();
      } catch {
        brand = null;
      }
      const adminEmail = process.env.RENOVA_ADMIN_ENQUIRY_EMAIL?.trim();
      if (
        !brand ||
        !isEmailDeliveryConfigured() ||
        (job.kind === "ADMIN" &&
          (!adminEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)))
      ) {
        await tx
          .update(enquiryEmailJobs)
          .set({
            status: "NOT_CONFIGURED",
            nextAttemptAt: new Date(Date.now() + 60_000),
            updatedAt: new Date(),
          })
          .where(eq(enquiryEmailJobs.id, job.id));
        return;
      }
      // Beyond the provider's idempotency retention window, require manual review
      // rather than silently sending a potentially duplicated notification.
      if (
        job.attemptCount >= 5 ||
        (job.attemptCount > 0 &&
          Date.now() - job.createdAt.getTime() > 23 * 60 * 60_000)
      ) {
        await tx
          .update(enquiryEmailJobs)
          .set({ status: "MANUAL_REVIEW", updatedAt: new Date() })
          .where(eq(enquiryEmailJobs.id, job.id));
        return;
      }
      try {
        const template =
          job.kind === "ADMIN"
            ? adminEnquiryNotificationEmail(brand, enquiry)
            : enquiryAcknowledgementEmail(brand, enquiry);
        const accepted = await getEmailProvider(brand).send({
          to: job.kind === "ADMIN" ? adminEmail! : enquiry.email,
          idempotencyKey: `enquiry-${job.id}`,
          ...template,
        });
        await tx
          .update(enquiryEmailJobs)
          .set({
            status: "ACCEPTED",
            providerMessageId: accepted.providerMessageId,
            attemptCount: job.attemptCount + 1,
            updatedAt: new Date(),
          })
          .where(eq(enquiryEmailJobs.id, job.id));
      } catch {
        await tx
          .update(enquiryEmailJobs)
          .set({
            status: "RETRY",
            attemptCount: job.attemptCount + 1,
            nextAttemptAt: new Date(
              Date.now() +
                Math.min(60 * 60_000, 60_000 * 2 ** job.attemptCount),
            ),
            updatedAt: new Date(),
          })
          .where(eq(enquiryEmailJobs.id, job.id));
      }
    });
  return db
    .select({
      id: enquiryEmailJobs.id,
      enquiryId: enquiryEmailJobs.enquiryId,
      kind: enquiryEmailJobs.kind,
      status: enquiryEmailJobs.status,
      attemptCount: enquiryEmailJobs.attemptCount,
      nextAttemptAt: enquiryEmailJobs.nextAttemptAt,
      providerMessageId: enquiryEmailJobs.providerMessageId,
    })
    .from(enquiryEmailJobs)
    .where(enquiryId ? eq(enquiryEmailJobs.enquiryId, enquiryId) : undefined)
    .limit(100);
}
