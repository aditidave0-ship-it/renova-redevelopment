import { Router, type IRouter } from "express";
import { count, eq, inArray } from "drizzle-orm";
import {
  requireDb,
  opportunities,
  opportunityInterests,
  societies,
} from "@workspace/db";
import { requireAuth } from "../lib/session";
const router: IRouter = Router();
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
export default router;
