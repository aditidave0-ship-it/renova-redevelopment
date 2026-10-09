import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { sql } from "drizzle-orm";
import { requireDb } from "@workspace/db";

const router: IRouter = Router();

export const requiredSchemaColumns = [
  ["users", "email_verified_at"],
  ["organizations", "id"],
  ["organization_members", "id"],
  ["auth_sessions", "id"],
  ["auth_tokens", "id"],
  ["enquiries", "id"],
  ["societies", "number_buildings"],
  ["developer_profiles", "id"],
  ["pmc_profiles", "id"],
  ["professional_profiles", "id"],
  ["redevelopment_opportunities", "id"],
  ["opportunity_interests", "review_status"],
  ["feasibility_requests", "status"],
  ["feasibility_property_data", "id"],
  ["feasibility_documents", "id"],
  ["feasibility_assessments", "id"],
  ["feasibility_assumptions", "id"],
  ["feasibility_status_history", "id"],
  ["audit_logs", "id"],
] as const;

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/readyz", async (_req, res) => {
  try {
    const database = requireDb();
    await Promise.all(
      requiredSchemaColumns.map(([table, column]) =>
        database.execute(
          sql`select ${sql.identifier(column)} from ${sql.identifier(table)} limit 0`,
        ),
      ),
    );
    res.json({ status: "ready" });
  } catch {
    res
      .status(503)
      .json({ status: "unavailable", error: "Database is not ready" });
  }
});

export default router;
