import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const migrationDirectory = path.resolve(scriptDirectory, "../drizzle");

export const REQUIRED_SCHEMA_COLUMNS = [
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
];

const REQUIRED_AFTER_MIGRATION_COUNT = new Map([
  ["users.email_verified_at", 3],
  ["users.credential_version", 8],
  ["auth_sessions.credential_version", 8],
  ["auth_tokens.failed_attempts", 6],
  ["auth_rate_limits.id", 6],
  ["enquiries.assigned_to_user_id", 7],
  ["enquiry_email_jobs.id", 9],
  ["professional_profiles.id", 5],
  ["feasibility_requests.status", 4],
  ["feasibility_property_data.id", 4],
  ["feasibility_documents.id", 4],
  ["feasibility_assessments.id", 4],
  ["feasibility_assumptions.id", 4],
  ["feasibility_status_history.id", 4],
]);

export async function loadExpectedMigrations(directory = migrationDirectory) {
  const journal = JSON.parse(
    await readFile(path.join(directory, "meta", "_journal.json"), "utf8"),
  );
  const fileNames = new Set(await readdir(directory));
  return Promise.all(
    journal.entries.map(async (entry) => {
      const fileName = `${entry.tag}.sql`;
      if (!fileNames.has(fileName))
        throw new Error(
          `Migration file is missing for journal entry ${entry.tag}`,
        );
      const sql = await readFile(path.join(directory, fileName), "utf8");
      return {
        tag: entry.tag,
        createdAt: String(entry.when),
        hash: createHash("sha256").update(sql).digest("hex"),
      };
    }),
  );
}

export function compareMigrationLedger(applied, expected) {
  const unexpected = [];
  for (let index = 0; index < applied.length; index += 1) {
    const actual = applied[index];
    const canonical = expected[index];
    if (
      !canonical ||
      actual.hash !== canonical.hash ||
      String(actual.createdAt) !== canonical.createdAt
    ) {
      unexpected.push({
        position: index,
        appliedHash: actual.hash,
        appliedCreatedAt: String(actual.createdAt),
        expectedTag: canonical?.tag ?? null,
        expectedHash: canonical?.hash ?? null,
        expectedCreatedAt: canonical?.createdAt ?? null,
      });
    }
  }
  return {
    appliedCount: applied.length,
    expectedCount: expected.length,
    applied: expected.slice(0, applied.length).map((item) => item.tag),
    pending: expected.slice(applied.length).map((item) => item.tag),
    unexpected,
  };
}

export function findMissingColumns(rows, required = REQUIRED_SCHEMA_COLUMNS) {
  const available = new Set(
    rows.map((row) => `${row.tableName}.${row.columnName}`),
  );
  return required
    .map(([table, column]) => `${table}.${column}`)
    .filter((column) => !available.has(column));
}

export function classifyPreflight(ledger, missingColumns) {
  const missingAppliedColumns = missingColumns.filter(
    (column) =>
      (REQUIRED_AFTER_MIGRATION_COUNT.get(column) ?? 3) <= ledger.appliedCount,
  );
  const missingPendingColumns = missingColumns.filter(
    (column) => !missingAppliedColumns.includes(column),
  );
  const status =
    ledger.unexpected.length || missingAppliedColumns.length
      ? "BLOCKED_SCHEMA_DRIFT"
      : ledger.pending.length || missingPendingColumns.length
        ? "BLOCKED_PENDING_MIGRATIONS"
        : "READY";
  return { status, missingAppliedColumns, missingPendingColumns };
}

export async function runProductionPreflight({
  connectionString,
  directory,
} = {}) {
  const url = connectionString ?? process.env.DATABASE_URL_UNPOOLED;
  if (!url)
    throw new Error(
      "DATABASE_URL_UNPOOLED is required for the read-only production preflight",
    );

  const expected = await loadExpectedMigrations(directory);
  const pool = new Pool({
    connectionString: url,
    max: 1,
    connectionTimeoutMillis: 15_000,
  });
  const client = await pool.connect();
  try {
    await client.query("begin transaction read only");
    await client.query("set local statement_timeout = '15s'");
    const ledgerResult = await client.query(
      "select hash, created_at from drizzle.__drizzle_migrations order by created_at asc",
    );
    const columnResult = await client.query(
      `select table_name as "tableName", column_name as "columnName"
       from information_schema.columns
       where table_schema = 'public'`,
    );
    await client.query("rollback");

    const ledger = compareMigrationLedger(
      ledgerResult.rows.map((row) => ({
        hash: row.hash,
        createdAt: String(row.created_at),
      })),
      expected,
    );
    const missingColumns = findMissingColumns(columnResult.rows);
    const classification = classifyPreflight(ledger, missingColumns);
    return {
      status: classification.status,
      access: "READ_ONLY",
      ledger,
      schema: {
        missingAppliedColumns: classification.missingAppliedColumns,
        missingPendingColumns: classification.missingPendingColumns,
      },
    };
  } finally {
    client.release();
    await pool.end();
  }
}

const isEntrypoint =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isEntrypoint) {
  try {
    const result = await runProductionPreflight();
    console.log(JSON.stringify(result, null, 2));
    if (result.status !== "READY") process.exitCode = 2;
  } catch {
    console.error(
      "RENOVA production preflight failed; connection details and underlying errors are withheld.",
    );
    process.exitCode = 1;
  }
}
