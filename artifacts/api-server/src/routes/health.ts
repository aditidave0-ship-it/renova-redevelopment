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
      database.execute(sql`select email_verified_at, credential_version from users limit 0`),
      database.execute(sql`select credential_version from auth_sessions limit 0`),
      database.execute(sql`select id from auth_tokens limit 0`),
      database.execute(sql`select id from enquiries limit 0`),
      database.execute(sql`select id from feasibility_requests limit 0`),
    ]);
    res.json({ status: "ready" });
  } catch {
    res.status(503).json({ status: "unavailable", error: "Database is not ready" });
  }
});

export default router;
