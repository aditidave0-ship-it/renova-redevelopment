import assert from "node:assert/strict";
import test from "node:test";
import { requiredSchemaColumns } from "./health";

test("readiness covers authentication, marketplace, feasibility, and audit storage", () => {
  const targets = new Set(
    requiredSchemaColumns.map(([table, column]) => `${table}.${column}`),
  );

  for (const target of [
    "users.email_verified_at",
    "auth_tokens.id",
    "enquiries.id",
    "professional_profiles.id",
    "redevelopment_opportunities.id",
    "opportunity_interests.review_status",
    "feasibility_requests.status",
    "feasibility_documents.id",
    "feasibility_assessments.id",
    "feasibility_status_history.id",
    "audit_logs.id",
  ]) {
    assert.equal(targets.has(target), true, `${target} should block readiness`);
  }
});
