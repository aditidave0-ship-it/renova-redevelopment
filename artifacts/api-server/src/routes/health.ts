import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { sql } from "drizzle-orm";
import { requireDb } from "@workspace/db";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/readyz", async (_req, res) => {
  try {
    const database = requireDb();
    await Promise.all([
      database.execute(sql`select email_verified_at from users limit 0`),
      database.execute(sql`select id from auth_tokens limit 0`),
      database.execute(sql`select id from enquiries limit 0`),
      database.execute(sql`select number_buildings, marketplace_visible from societies limit 0`),
      database.execute(sql`select id from developer_profiles limit 0`),
      database.execute(sql`select id from pmc_profiles limit 0`),
      database.execute(sql`select review_status from opportunity_interests limit 0`),
    ]);
    res.json({ status: "ready" });
  } catch {
    res.status(503).json({ status: "unavailable", error: "Database is not ready" });
  }
});

export default router;
