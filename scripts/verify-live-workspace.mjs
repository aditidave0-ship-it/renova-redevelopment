import { randomBytes } from "node:crypto";

const base = process.env.RENOVA_BASE_URL;
const token = process.env.RENOVA_REGISTRATION_TEST_TOKEN;
if (!base || !token || !/^https:\/\//.test(base)) {
  throw new Error("Set RENOVA_BASE_URL (https://...) and RENOVA_REGISTRATION_TEST_TOKEN in the local test process.");
}
const origin = new URL(base).origin;
const runId = randomBytes(5).toString("hex");
const password = randomBytes(24).toString("base64url");

async function request(path, { method = "GET", body, cookie, registration = false } = {}) {
  const response = await fetch(`${origin}/api${path}`, {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(cookie ? { cookie } : {}),
      ...(registration ? { "x-renova-registration-test": token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) throw new Error(`${path}: expected JSON, received ${response.status} ${contentType || "without content type"}. Check the same-origin rewrite and deployment protection.`);
  const data = await response.json();
  if (!response.ok) throw new Error(`${path}: ${response.status} ${data.error || "request failed"}`);
  return { data, response };
}

async function register(role) {
  const organizationName = `RENOVA Acceptance ${role} ${runId}`;
  const { response } = await request("/auth/register", {
    method: "POST", registration: true,
    body: { email: `renova-acceptance-${role.toLowerCase()}-${runId}@example.com`, password,
      displayName: `Acceptance ${role}`, role, organizationName, location: "Mumbai" },
  });
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  if (!cookie?.startsWith("renova_session=")) throw new Error(`${role}: no session cookie returned`);
  const me = await request("/auth/me", { cookie });
  if (me.data.user.role !== role) throw new Error(`${role}: incorrect role after registration`);
  return { cookie, organizationName };
}

const health = await request("/healthz");
const ready = await request("/readyz");
if (health.data.status !== "ok" || ready.data.status !== "ready") throw new Error("API health or database readiness failed");
const society = await register("SOCIETY");
const created = await request("/opportunities", { method: "POST", cookie: society.cookie, body: {
  title: `RENOVA Acceptance Opportunity ${runId}`, location: "Mumbai",
  description: "Acceptance test opportunity for the RENOVA production workflow. This is not a real society listing.",
  memberCount: 24, publish: true,
} });
const opportunityId = created.data.opportunity?.id;
if (!opportunityId) throw new Error("Society opportunity creation returned no ID");

for (const role of ["DEVELOPER", "PMC"]) {
  const actor = await register(role);
  const discovered = await request("/opportunities", { cookie: actor.cookie });
  if (!discovered.data.opportunities?.some((item) => item.id === opportunityId)) throw new Error(`${role}: published opportunity not visible`);
  await request(`/opportunities/${opportunityId}/interests`, {
    method: "POST", cookie: actor.cookie,
    body: { message: `Acceptance test interest from ${role} ${runId}.` },
  });
  const inbox = await request("/societies/me/interests", { cookie: society.cookie });
  if (!inbox.data.interests?.some((item) => item.opportunityId === opportunityId && item.organizationName === actor.organizationName)) {
    throw new Error(`Society did not receive ${role} interest`);
  }
}

console.log(`RENOVA acceptance flow passed on ${origin}: health → readiness → society registration → published opportunity → developer and PMC discovery → interests → society inbox. Test marker: ${runId}`);
