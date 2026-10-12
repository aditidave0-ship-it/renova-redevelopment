import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import express, { type ErrorRequestHandler } from "express";
import cookieParser from "cookie-parser";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/pglite/migrator";
import { PGlite } from "@electric-sql/pglite";
import { db, engine, users } from "./staging-database";
import routes from "../src/routes/index";
import { testAuthDelivery } from "./auth-delivery";
import { testSandboxAndEmail } from "./sandbox-delivery";

const root = process.env.RENOVA_ISOLATED_FIXTURE_DIRECTORY!;
await migrate(db, { migrationsFolder: resolve("../../lib/db/drizzle") });
const app = express();
app.use("/api/billing/webhook", express.raw({ type: "application/json", limit: "256kb" }));
app.use(express.json(), cookieParser());
app.use("/api", routes);
app.use("/api", (_request, response) => response.status(404).json({ error: "API endpoint not found" }));
// Production source and API authorization are unchanged; only external email
// delivery is captured. No OTP/password/session is printed or exposed in HTTP.
const captured: Array<{ to: string[]; text: string }> = [];
const nativeFetch = globalThis.fetch;
let origin = "";
globalThis.fetch = async (input, init) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  if (url.href === "https://api.resend.com/emails") {
    captured.push(JSON.parse(String(init?.body)));
    return Response.json({ id: "TEST-ONLY-sandbox-email" });
  }
  if (url.origin !== origin) throw new Error("Isolated staging forbids external network delivery");
  return nativeFetch(input, init);
};
const errors: ErrorRequestHandler = (error, _request, response, _next) => {
  response.status(error.name === "ZodError" ? 400 : error.status ?? 500)
    .json({ error: "Staging request rejected" });
};
app.use(errors);
// Same-origin local browser runtime uses the actual frontend build and actual API.
const frontend = resolve("../renova/dist/public");
app.use(express.static(frontend));
app.get("/{*path}", (_request, response) => response.sendFile(resolve(frontend, "index.html")));
const server = createServer(app);
await new Promise<void>(done => server.listen(0, "127.0.0.1", done));
const address = server.address();
assert.ok(address && typeof address !== "string");
origin = `http://127.0.0.1:${address.port}`;
process.env.RENOVA_APP_URL = origin;
let checks = 0;
function equal(actual: unknown, expected: unknown) { assert.deepEqual(actual, expected); checks++; }
async function request(path: string, method = "GET", cookie = "", body?: unknown, controlled = false) {
  return nativeFetch(origin + "/api" + path, { method,
    headers: { "content-type": "application/json", cookie,
      ...(controlled ? { "x-renova-registration-test": process.env.RENOVA_REGISTRATION_TEST_TOKEN! } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
async function fixture(participantType: string, label: string) {
  const email = `staging-${label.toLowerCase()}@example.invalid`;
  const password = randomBytes(30).toString("base64url");
  equal((await request("/auth/register", "POST", "", {
    email, password, participantType, displayName: `TEST ONLY ${label}`,
    organizationName: `TEST ONLY ${label}`, location: "Mumbai",
  }, true)).status, 202);
  equal((await request("/auth/login", "POST", "", { email, password })).status, 401);
  const delivered = [...captured].reverse().find(row => row.to.includes(email) && /verification code is \d{6}/.test(row.text));
  assert.ok(delivered, "sandbox provider must capture verification delivery"); checks++;
  const otp = delivered.text.match(/verification code is (\d{6})/)![1];
  equal((await request("/auth/verify-email", "POST", "", { email, otp })).status, 200);
  const login = await request("/auth/login", "POST", "", { email, password });
  equal(login.status, 200);
  const cookie = login.headers.get("set-cookie")!.split(";")[0];
  const me = await request("/auth/me", "GET", cookie);
  equal(me.status, 200);
  return { email, password, participantType, cookie, user: ((await me.json()) as any).user };
}
try {
  equal((await request("/healthz")).status, 200);
  equal((await request("/readyz")).status, 200);
  equal((await request("/auth/register", "POST", "", {})).status, 503);
  equal((await request("/workspace/metrics")).status, 401);
  const society = await fixture("SOCIETY", "SOCIETY_A");
  const other = await fixture("SOCIETY", "SOCIETY_B");
  const developer = await fixture("DEVELOPER", "DEVELOPER");
  const pmc = await fixture("PMC", "PMC");
  const professional = await fixture("ARCHITECT", "PROFESSIONAL");
  const admin = await fixture("OTHER_PROFESSIONAL", "ADMIN");
  // Explicit isolated fixture provisioning, AFTER real OTP verification. ADMIN
  // remains impossible to choose publicly. No production database is connected.
  await db.update(users).set({ role: "ADMIN", credentialVersion: 2 }).where(eq(users.id, admin.user.userId));
  equal((await request("/auth/me", "GET", admin.cookie)).status, 401);
  const adminLogin = await request("/auth/login", "POST", "", { email: admin.email, password: admin.password });
  equal(adminLogin.status, 200);
  admin.cookie = adminLogin.headers.get("set-cookie")!.split(";")[0];
  for (const actor of [society, developer, pmc, professional]) {
    equal((await request("/workspace/metrics", "GET", actor.cookie)).status, 200);
    equal((await request("/profiles/me", "GET", actor.cookie)).status, 200);
    equal(actor.user.role, actor === professional ? "PROFESSIONAL" : actor.participantType);
    equal((await request("/profiles/me", "PUT", actor.cookie, {
      organizationName: `TEST ONLY ${actor.participantType} staging profile`,
      location: "Mumbai", description: "TEST ONLY isolated profile information",
      ...(actor === professional ? { specialization: "ARCHITECT", services: ["TEST ONLY architecture"] } : {}),
    })).status, 200);
    equal(((await (await request("/profiles/me", "GET", actor.cookie)).json()) as any).profile.organizationName, `TEST ONLY ${actor.participantType} staging profile`);
  }
  const details = { societyName: "TEST ONLY staging society", propertyAddress: "TEST ONLY property address",
    locality: "Mumbai", city: "Mumbai", pinCode: "400001", contactPerson: "TEST ONLY contact",
    contactEmail: society.email, contactPhone: "9000000000", propertyData: { unknownFields: ["plotArea"] } };
  const created = await request("/feasibility", "POST", society.cookie, details);
  equal(created.status, 201);
  const feasible = ((await created.json()) as any).request;
  equal((await request(`/feasibility/${feasible.id}`, "PUT", society.cookie, { ...details, societyName: "TEST ONLY edited staging society" })).status, 200);
  equal(((await (await request(`/feasibility/${feasible.id}`, "GET", society.cookie)).json()) as any).request.societyName, "TEST ONLY edited staging society");
  equal((await request(`/feasibility/${feasible.id}`, "GET", other.cookie)).status, 404);
  equal((await request(`/feasibility/${feasible.id}/submit`, "POST", society.cookie, {})).status, 200);
  equal((await request(`/admin/feasibility/${feasible.id}/status`, "PATCH", admin.cookie, { status: "IN_REVIEW" })).status, 200);
  equal((await request(`/admin/feasibility/${feasible.id}/assessment`, "PUT", admin.cookie, { professionalNotes: "TEST ONLY workflow assessment; no regulatory or financial conclusions", assumptions: [], documentsReviewed: [] })).status, 200);
  equal((await request(`/admin/feasibility/${feasible.id}/publish`, "POST", admin.cookie, {})).status, 200);
  const result = ((await (await request(`/feasibility/${feasible.id}`, "GET", society.cookie)).json()) as any).request;
  equal(result.status, "ASSESSMENT_READY");
  equal(result.assessment.professionalNotes, "TEST ONLY workflow assessment; no regulatory or financial conclusions");
  const draft = await request("/opportunities", "POST", society.cookie, { title: "TEST ONLY staging opportunity", location: "Mumbai", description: "TEST ONLY controlled staging opportunity description", publish: false });
  equal(draft.status, 201);
  const opportunity = ((await draft.json()) as any).opportunity;
  equal((await request(`/societies/me/opportunities/${opportunity.id}`, "GET", other.cookie)).status, 404);
  equal((await request(`/societies/me/opportunities/${opportunity.id}/publish`, "POST", society.cookie, {})).status, 200);
  for (const actor of [developer, pmc]) {
    equal((await request(`/opportunities/${opportunity.id}`, "GET", actor.cookie)).status, 200);
    equal((await request(`/opportunities/${opportunity.id}/interests`, "POST", actor.cookie, {})).status, 201);
    equal((await request(`/opportunities/${opportunity.id}/interests`, "POST", actor.cookie, {})).status, 409);
  }
  equal(((await (await request("/societies/me/interests", "GET", society.cookie)).json()) as any).interests.length, 2);
  equal((await request("/societies/me/interests", "GET", professional.cookie)).status, 403);
  const enquiry = await request("/enquiries", "POST", "", { name: "TEST ONLY enquiry", organizationName: "TEST ONLY society", email: society.email, phone: "9000000000", city: "Mumbai", actorType: "Housing Society", message: "TEST ONLY controlled contact enquiry", consent: true });
  equal(enquiry.status, 201);
  const intake = ((await (await request("/admin/enquiries", "GET", admin.cookie)).json()) as any).enquiries;
  equal(intake.length, 1);
  equal((await request(`/admin/enquiries/${intake[0].id}`, "PATCH", admin.cookie, { status: "CONTACTED", note: "TEST ONLY admin processed enquiry" })).status, 200);
  equal((await request("/admin/enquiries", "GET", developer.cookie)).status, 403);
  const otpChecks = await testAuthDelivery(origin);
  // Reuse the retry acceptance contract with a separately labelled enquiry
  // created through HTTP while delivery is unavailable, never a DB seed.
  const sandboxKey = process.env.RESEND_API_KEY;
  delete process.env.RESEND_API_KEY;
  equal((await request("/enquiries", "POST", "", { name: "TEST ONLY retry enquiry", organizationName: "TEST ONLY retry society", email: "enquiry@example.invalid", phone: "9000000000", city: "Mumbai", actorType: "Housing Society", message: "TEST ONLY controlled delivery retry enquiry", consent: true })).status, 201);
  process.env.RESEND_API_KEY = sandboxKey;
  const paymentChecks = await testSandboxAndEmail(origin, society.cookie, other.cookie, pmc.cookie, admin.cookie);
  const fixtureFile = resolve(root, "controlled-accounts.json");
  await writeFile(fixtureFile, JSON.stringify([society, developer, pmc, professional, admin].map(({ cookie, user, ...safe }) => safe)), { mode: 0o600 });
  const report = { timestamp: new Date().toISOString(), scope: "Isolated filesystem PostgreSQL/PGlite staging; sandbox provider only; NOT production or managed staging",
    database: "Fresh canonical Drizzle migrations applied; separate private temporary directory", checks, otpChecks, paymentChecks,
    accounts: ["SOCIETY", "DEVELOPER", "PMC", "PROFESSIONAL", "ADMIN fixture"], verification: "Each fixture registered and verified using real OTP HTTP endpoint; email captured privately; no manual emailVerifiedAt change",
    flows: { healthReadiness: "PASS", publicRegistrationClosed: "PASS", fourRoleSessionsAndProfileAPIs: "PASS", feasibilityDraftSubmitAdminAssessment: "PASS", opportunityPublicationAndBothInterests: "PASS", enquiryAdminProcessing: "PASS", otpSandboxCases: "PASS", sandboxOrderWebhookReceiptCases: "PASS", authenticatedCloudBrowser: "BLOCKED" },
    browserBlocker: "Vercel Sandbox create returned 403; no authenticated local Vercel CLI; cloud browser cannot access loopback staging server",
    externalEmailsSent: 0, realGatewayTransactions: 0, productionWrites: 0 };
  if (process.env.RENOVA_STAGING_MODE === "--serve") {
    console.log(JSON.stringify({ ...report, localURL: origin, fixtureCredentialsFile: fixtureFile }));
    await new Promise<void>(done => { process.once("SIGINT", done); process.once("SIGTERM", done); });
  } else {
    await new Promise<void>(done => server.close(() => done()));
    await engine.close();
    const reopened = new PGlite(resolve(root, "database"));
    const verified = await reopened.query<{ count: number }>("select count(*)::int as count from users where email_verified_at is not null");
    equal(verified.rows[0].count >= 6, true);
    const persisted = await reopened.query<{ count: number }>("select count(*)::int as count from opportunity_interests where opportunity_id = $1", [opportunity.id]);
    equal(persisted.rows[0].count, 2);
    const ledger = await reopened.query<{ count: number }>("select count(*)::int as count from drizzle.__drizzle_migrations");
    equal(ledger.rows[0].count, 9);
    await reopened.close();
    const final = { ...report, checks, diskReopenPersistence: "PASS" };
    await writeFile(resolve("../../docs/qa-evidence/isolated-staging-20261012.json"), JSON.stringify(final, null, 2) + "\n");
    console.log(JSON.stringify(final));
  }
} finally {
  globalThis.fetch = nativeFetch;
  server.close();
  if (!engine.closed) await engine.close();
}
