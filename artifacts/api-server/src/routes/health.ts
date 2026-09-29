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
    await requireDb().execute(sql`select 1`);
    res.json({ status: "ready" });
  } catch {
    res.status(503).json({ status: "unavailable", error: "Database is not ready" });
  }
});

export default router;
