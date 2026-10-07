import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const historical = await readFile(new URL("./fixtures/0002_glossy_veda.sql", import.meta.url), "utf8");
const { createHash } = await import("node:crypto");
assert.equal(createHash("sha256").update(historical).digest("hex"), "17fee26d154b470f9a62ae6250575eb14cc6d70c84431c4b072049cd1320ae10");
const sql = await readFile("../../lib/db/drizzle/0004_participant_feasibility.sql", "utf8");
assert.doesNotMatch(sql, /\b(DROP|DELETE|TRUNCATE)\b/i);
for (const invalid of [false, true]) {
  const db = new PGlite();
  try {
    for (const name of ["0000_real_roland_deschain", "0001_bright_hedge_knight", "0002_credential_versions", "0003_feasibility_foundation"]) {
      await db.exec(await readFile(`../../lib/db/drizzle/${name}.sql`, "utf8"));
      if (name === "0001_bright_hedge_knight") await db.exec(historical);
    }
    const user = (await db.query("INSERT INTO users(email,password_hash,display_name,role) VALUES ('migration@example.invalid','TEST ONLY','TEST ONLY','SOCIETY') RETURNING id")).rows[0].id;
    const org = (await db.query("INSERT INTO organizations(name,kind) VALUES ('TEST ONLY','SOCIETY') RETURNING id")).rows[0].id;
    const society = (await db.query("INSERT INTO societies(organization_id) VALUES ($1) RETURNING id", [org])).rows[0].id;
    const statuses = ['DRAFT','SUBMITTED','IN_REVIEW','NEEDS_INFORMATION','ASSESSED','CLOSED', ...(invalid ? ['UNKNOWN'] : [])];
    for (const status of statuses) await db.query("INSERT INTO feasibility_requests(society_id,submitted_by_user_id,property_address,requirement,status,assessment_notes) VALUES ($1,$2,'TEST ONLY','TEST ONLY',$3,'Retain original professional assessment')", [society,user,status]);
    await db.query("INSERT INTO developer_profiles(organization_id,description) VALUES ($1,'TEST ONLY preserve historical profile')", [org]);
    await db.query("INSERT INTO pmc_profiles(organization_id,description) VALUES ($1,'TEST ONLY preserve historical PMC')", [org]);
    const tables = ['users','organizations','societies','auth_sessions','auth_tokens','enquiries','redevelopment_opportunities','opportunity_interests','organization_members','audit_logs','developer_profiles','pmc_profiles'];
    const before = await Promise.all(tables.map(async t => (await db.query(`SELECT * FROM ${t} ORDER BY id`)).rows));
    const original = (await db.query('SELECT * FROM feasibility_requests ORDER BY id')).rows;
    if (invalid) {
      await assert.rejects(db.transaction(tx => tx.exec(sql)));
      assert.deepEqual((await db.query('SELECT * FROM feasibility_requests ORDER BY id')).rows, original);
      assert.equal((await db.query("SELECT count(*)::int AS n FROM information_schema.columns WHERE table_name='organizations' AND column_name='specialization'")).rows[0].n, 0);
    } else {
      await db.transaction(tx => tx.exec(sql));
      const after = (await db.query('SELECT * FROM feasibility_requests ORDER BY id')).rows;
      assert.equal(after.length, original.length);
      for (let i=0;i<original.length;i++) {
        const expected = {...original[i], status: original[i].status === 'NEEDS_INFORMATION' ? 'MORE_INFORMATION_REQUIRED' : original[i].status === 'ASSESSED' ? 'ASSESSMENT_READY' : original[i].status, property_information:null, regulatory_information:null};
        assert.deepEqual(after[i], expected);
      }
      await assert.rejects(db.query("UPDATE feasibility_requests SET status='UNKNOWN'"));
    }
    const afterOther = await Promise.all(tables.map(async t => (await db.query(`SELECT * FROM ${t} ORDER BY id`)).rows));
    // Organization gains only nullable columns; all original values stay identical.
    afterOther[1] = afterOther[1].map(({specialization,services,credentials,portfolio,...row}) => row);
    assert.deepEqual(afterOther, before);
    console.log(`PASS migration 0004: ${invalid ? 'unknown status fails and full transaction rolls back' : 'exact two legacy status mappings; all fields and unrelated records preserved'}`);
  } finally { await db.close(); }
}
