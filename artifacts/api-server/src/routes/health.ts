import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { sql } from "drizzle-orm";
import { requireDb } from "@workspace/db";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function safeDatabaseFailureCode(error: unknown): string {
  if (error instanceof Error && error.message === "DATABASE_URL is not configured")
    return "DATABASE_URL_MISSING";
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "string" &&
    /^[A-Z0-9_]+$/.test(error.code)
  )
    return error.code;
  return "DATABASE_CHECK_FAILED";
}

export const requiredSchemaColumns = [
  ["users", "email_verified_at"],
  ["users", "credential_version"],
  ["auth_sessions", "credential_version"],
  ["auth_tokens", "failed_attempts"],
  ["auth_rate_limits", "id"],
  ["enquiries", "assigned_to_user_id"],
  ["enquiry_email_jobs", "id"],
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
  let check = "database_configuration";
  try {
    const database = requireDb();
    check = "database_connection";
    await database.execute(sql`select 1`);
    check = "database_schema";
    await Promise.all(
      requiredSchemaColumns.map(async ([table, column]) => {
        try {
          await database.execute(
            sql`select ${sql.identifier(column)} from ${sql.identifier(table)} limit 0`,
          );
        } catch (error) {
          logger.error(
            {
              check: `schema.${table}.${column}`,
              failureCode: safeDatabaseFailureCode(error),
            },
            "Database readiness schema probe failed",
          );
          throw error;
        }
      }),
    );
    res.json({ status: "ready" });
  } catch (error) {
    logger.error(
      { check, failureCode: safeDatabaseFailureCode(error) },
      "Database readiness check failed",
    );
    res
      .status(503)
      .json({ status: "unavailable", error: "Database is not ready" });
  }
});

export default router;
