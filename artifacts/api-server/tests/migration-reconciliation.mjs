import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
const root = new URL("../../../", import.meta.url);
const journal = JSON.parse(
  await readFile(new URL("lib/db/drizzle/meta/_journal.json", root), "utf8"),
);
const production = JSON.parse(
  await readFile(
    new URL("docs/qa-evidence/production-schema-ledger-20261012.json", root),
    "utf8",
  ),
);
const impact = JSON.parse(
  await readFile(
    new URL("docs/qa-evidence/production-schema-impact-20261012.json", root),
    "utf8",
  ),
);
production.public_columns.sort((a, b) =>
  (a.table + "." + a.column).localeCompare(b.table + "." + b.column),
);
production.constraints.sort((a, b) =>
  (a.table + "." + a.name).localeCompare(b.table + "." + b.name),
);
const sqls = await Promise.all(
  journal.entries.map(async (entry) => ({
    entry,
    sql: await readFile(
      new URL(`lib/db/drizzle/${entry.tag}.sql`, root),
      "utf8",
    ),
  })),
);
for (const [index, row] of production.ledger.entries()) {
  assert.equal(
    row.hash,
    createHash("sha256").update(sqls[index].sql).digest("hex"),
  );
  assert.equal(Number(row.created_at), sqls[index].entry.when);
}
const columnsQuery =
  "SELECT table_name AS table,column_name AS column,udt_name AS udt,data_type AS type,is_nullable AS nullable,column_default AS default FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,column_name";
const constraintsQuery =
  "SELECT c.conname AS name,t.relname AS table,pg_get_constraintdef(c.oid) AS definition FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='public' AND c.contype <> 'n' ORDER BY t.relname,c.conname";
const db = new PGlite();
try {
  for (const { sql } of sqls.slice(0, 3)) await db.exec(sql);
  const sortedColumns = (rows) =>
    rows.sort((a, b) =>
      (a.table + "." + a.column).localeCompare(b.table + "." + b.column),
    );
  const sortedConstraints = (rows) =>
    rows.sort((a, b) =>
      (a.table + "." + a.name).localeCompare(b.table + "." + b.name),
    );
  assert.deepEqual(
    sortedColumns((await db.query(columnsQuery)).rows),
    production.public_columns,
  );
  assert.deepEqual(
    sortedConstraints((await db.query(constraintsQuery)).rows),
    production.constraints.filter(
      (row) => !row.definition.startsWith("NOT NULL "),
    ),
  );
  const indexes = (
    await db.query(
      "SELECT tablename AS table,indexname AS name,indexdef AS definition FROM pg_indexes WHERE schemaname='public'",
    )
  ).rows;
  assert.deepEqual(
    sortedConstraints(indexes),
    sortedConstraints(impact.indexes),
  );
  const enums = (
    await db.query(
      "SELECT t.typname AS type,e.enumlabel AS label,e.enumsortorder AS \"order\" FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' ORDER BY t.typname,e.enumsortorder",
    )
  ).rows;
  assert.deepEqual(enums, impact.enums);
  const tables = [
    ...new Set(production.public_columns.map((row) => row.table)),
  ];
  const user = (
    await db.query(
      "INSERT INTO users(email,password_hash,display_name,role,email_verified_at) VALUES ('migration-only@example.invalid','TEST ONLY HASH','TEST ONLY society','SOCIETY',now()) RETURNING id",
    )
  ).rows[0].id;
  const org = (
    await db.query(
      "INSERT INTO organizations(name,kind) VALUES ('TEST ONLY organization','SOCIETY') RETURNING id",
    )
  ).rows[0].id;
  const society = (
    await db.query(
      "INSERT INTO societies(organization_id) VALUES ($1) RETURNING id",
      [org],
    )
  ).rows[0].id;
  await db.query(
    "INSERT INTO organization_members(user_id,organization_id) VALUES ($1,$2)",
    [user, org],
  );
  await db.query(
    "INSERT INTO developer_profiles(organization_id,description) VALUES ($1,'TEST ONLY preserve historical developer')",
    [org],
  );
  await db.query(
    "INSERT INTO pmc_profiles(organization_id,description) VALUES ($1,'TEST ONLY preserve historical PMC')",
    [org],
  );
  await db.query(
    "INSERT INTO auth_sessions(user_id,token_hash,expires_at) VALUES ($1,'TEST ONLY SESSION',now()+interval '1 day')",
    [user],
  );
  await db.query(
    "INSERT INTO auth_tokens(user_id,purpose,token_hash,expires_at) VALUES ($1,'PASSWORD_RESET','TEST ONLY HASH',now()+interval '1 hour')",
    [user],
  );
  await db.query(
    "INSERT INTO enquiries(reference,name,organization_name,email,phone,city,actor_type,message,request_fingerprint) VALUES ('TEST ONLY ENQUIRY','TEST ONLY','TEST ONLY','migration-only@example.invalid','9000000000','Mumbai','Housing Society','TEST ONLY preservation','TEST ONLY HASH')",
  );
  await db.query(
    "INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id) VALUES ($1,'TEST_ONLY','TEST_ONLY',$1)",
    [user],
  );
  const opportunity = (
    await db.query(
      "INSERT INTO redevelopment_opportunities(society_id,title,location,description) VALUES ($1,'TEST ONLY','Mumbai','TEST ONLY draft') RETURNING id",
      [society],
    )
  ).rows[0].id;
  await db.query(
    "INSERT INTO opportunity_interests(opportunity_id,organization_id,submitted_by_user_id) VALUES ($1,$2,$3)",
    [opportunity, org, user],
  );
  const before = Object.fromEntries(
    await Promise.all(
      tables.map(async (table) => [
        table,
        (await db.query(`SELECT * FROM ${table} ORDER BY id`)).rows,
      ]),
    ),
  );
  const pending = sqls.slice(3);
  for (const { sql } of pending) {
    assert.doesNotMatch(sql, /\b(DROP|TRUNCATE)\b/i);
    for (const statement of sql.split("--> statement-breakpoint"))
      assert.doesNotMatch(
        statement,
        /^\s*(DELETE|UPDATE|INSERT)\b/i,
        "pending DDL must not rewrite existing rows",
      );
  }
  // Demonstrate transactional recovery before accepting the same pending upgrade.
  await assert.rejects(
    db.transaction(async (tx) => {
      for (const { sql } of pending) await tx.exec(sql);
      throw new Error("TEST ONLY forced rollback");
    }),
  );
  assert.deepEqual(
    sortedColumns((await db.query(columnsQuery)).rows),
    production.public_columns,
  );
  await db.transaction(async (tx) => {
    for (const { sql } of pending) await tx.exec(sql);
  });
  for (const table of tables) {
    const after = (
      await db.query(`SELECT * FROM ${table} ORDER BY id`)
    ).rows.map((row) =>
      Object.fromEntries(
        Object.keys(before[table][0] ?? row)
          .filter((key) =>
            production.public_columns.some(
              (c) => c.table === table && c.column === key,
            ),
          )
          .map((key) => [key, row[key]]),
      ),
    );
    assert.deepEqual(
      after,
      before[table],
      `all existing ${table} fields preserved`,
    );
  }
  assert.equal(
    (await db.query("SELECT credential_version FROM users WHERE id=$1", [user]))
      .rows[0].credential_version,
    0,
  );
  assert.equal(
    (
      await db.query(
        "SELECT credential_version FROM auth_sessions WHERE user_id=$1",
        [user],
      )
    ).rows[0].credential_version,
    0,
  );
  const upgradedColumns = (await db.query(columnsQuery)).rows;
  const fresh = new PGlite();
  try {
    for (const { sql } of sqls) await fresh.exec(sql);
    assert.deepEqual((await fresh.query(columnsQuery)).rows, upgradedColumns);
  } finally {
    await fresh.close();
  }
  const evidence = {
    status: "PASS",
    scope: "isolated PostgreSQL/PGlite, no production writes",
    productionAuditAt: production.checked_at,
    baseline: journal.entries.slice(0, 3).map((e) => e.tag),
    pending: pending.map(({ entry, sql }) => ({
      migration: entry.tag,
      hash: createHash("sha256").update(sql).digest("hex"),
      impact: "additive DDL, no existing row rewrites/deletes",
    })),
    checks: [
      "production ledger hashes/timestamps match canonical history",
      "baseline columns/constraints match production export",
      "pending upgrade transaction rolls back fully",
      "all pre-existing fields and test rows preserved",
      "credential versions default to zero",
      "fresh replay matches upgraded schema",
    ],
  };
  await writeFile(
    new URL("docs/qa-evidence/migration-rehearsal-20261012.json", root),
    JSON.stringify(evidence, null, 2) + "\n",
  );
  console.log(
    "PASS: production baseline schema/ledger match; isolated full replay, upgrade, preservation and rollback rehearsal.",
  );
} finally {
  await db.close();
}
