import { randomBytes } from "node:crypto";

const base = process.env.RENOVA_BASE_URL;
const token = process.env.RENOVA_REGISTRATION_TEST_TOKEN;
if (!base || !token || !/^https:\/\//.test(base)) {
  throw new Error("Set RENOVA_BASE_URL (https://...) and RENOVA_REGISTRATION_TEST_TOKEN in the local test process.");
}
const origin = new URL(base).origin;
const runId = randomBytes(5).toString("hex");
const password = randomBytes(24).toString("base64url");

async function request(path, { method = "GET", body, cookie, registration = false, status = 200 } = {}) {
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
  if (response.status !== status) {
    throw new Error(`${path}: expected ${status}, received ${response.status} ${contentType}. Check the same-origin rewrite, deployment protection, and API logs.`);
  }
  if (response.headers.get("cache-control") !== "no-store") throw new Error(`${path}: API response is cacheable`);
  if (status === 204) return { response, data: null };
  if (!contentType.includes("application/json")) {
    throw new Error(`${path}: expected JSON, received ${response.status} ${contentType || "without content type"}. Check the same-origin rewrite and deployment protection.`);
  }
  return { data: await response.json(), response };
}

function sessionCookie(response, role) {
  const header = response.headers.get("set-cookie") || "";
  if (!/^renova_session=[^;]+;/.test(header)) throw new Error(`${role}: no session cookie returned`);
  for (const attribute of ["httponly", "secure", "samesite=lax", "path=/"]) {
    if (!header.toLowerCase().includes(attribute)) throw new Error(`${role}: session cookie missing ${attribute}`);
  }
  return header.split(";")[0];
}

async function register(role, suffix = "") {
  const organizationName = `RENOVA Acceptance ${role} ${runId}${suffix}`;
  const email = `renova-acceptance-${role.toLowerCase()}-${runId}${suffix}@example.com`;
  const { response } = await request("/auth/register", {
    method: "POST", registration: true, status: 201,
    body: { email, password, displayName: `Acceptance ${role}`, role, organizationName, location: "Mumbai" },
  });
  const cookie = sessionCookie(response, role);
  for (let index = 0; index < 2; index++) {
    const me = await request("/auth/me", { cookie });
    if (me.data.user.role !== role || me.data.user.email !== email) throw new Error(`${role}: session did not persist`);
  }
  await request("/auth/logout", { method: "POST", cookie, status: 204 });
  await request("/auth/me", { cookie, status: 401 });
  await request("/auth/login", { method: "POST", body: { email, password: "wrong-password" }, status: 401 });
  const login = await request("/auth/login", { method: "POST", body: { email, password } });
  const newCookie = sessionCookie(login.response, role);
  await request("/auth/me", { cookie: newCookie });
  return { cookie: newCookie, organizationName };
}

const health = await request("/healthz");
const ready = await request("/readyz");
if (health.data.status !== "ok" || ready.data.status !== "ready") throw new Error("API health or database readiness failed");
await request("/auth/me", { status: 401 });
await request("/societies/me/interests", { status: 401 });
await request("/auth/register", { method: "POST", body: {}, status: 503 });

const society = await register("SOCIETY");
const otherSociety = await register("SOCIETY", "-other");
const draft = await request("/opportunities", { method: "POST", cookie: society.cookie, status: 201, body: {
  title: `RENOVA Acceptance Draft ${runId}`, location: "Mumbai",
  description: "Private acceptance test draft. This is not a real society listing.", publish: false,
} });
const draftId = draft.data.opportunity?.id;
if (!draftId) throw new Error("Society draft creation returned no ID");
const created = await request("/opportunities", { method: "POST", cookie: society.cookie, status: 201, body: {
  title: `RENOVA Acceptance Opportunity ${runId}`, location: "Mumbai",
  description: "Acceptance test opportunity for the RENOVA production workflow. This is not a real society listing.",
  memberCount: 24, publish: true,
} });
const opportunityId = created.data.opportunity?.id;
if (!opportunityId) throw new Error("Society opportunity creation returned no ID");

const own = await request("/societies/me/opportunities", { cookie: society.cookie });
if (![opportunityId, draftId].every((id) => own.data.opportunities?.some((item) => item.id === id))) throw new Error("Society own opportunities missing");
const others = await request("/societies/me/opportunities", { cookie: otherSociety.cookie });
if (others.data.opportunities?.some((item) => [opportunityId, draftId].includes(item.id))) throw new Error("Second society can see first society private list");
await request(`/opportunities/${draftId}`, { status: 404 });
await request(`/opportunities/${opportunityId}/interests`, { method: "POST", cookie: society.cookie, body: {}, status: 403 });

for (const role of ["DEVELOPER", "PMC"]) {
  const actor = await register(role);
  await request("/societies/me/opportunities", { cookie: actor.cookie, status: 403 });
  await request("/societies/me/interests", { cookie: actor.cookie, status: 403 });
  await request("/opportunities", { method: "POST", cookie: actor.cookie, body: {
    title: "Unauthorized opportunity", location: "Mumbai", description: "This should be denied by role based authorization.", publish: true,
  }, status: 403 });
  const discovered = await request("/opportunities", { cookie: actor.cookie });
  if (!discovered.data.opportunities?.some((item) => item.id === opportunityId)) throw new Error(`${role}: published opportunity not visible`);
  if (discovered.data.opportunities?.some((item) => item.id === draftId)) throw new Error(`${role}: private draft visible in discovery`);
  await request(`/opportunities/${draftId}`, { cookie: actor.cookie, status: 404 });
  await request(`/opportunities/${draftId}/interests`, { method: "POST", cookie: actor.cookie, body: {}, status: 404 });
  await request(`/opportunities/${opportunityId}/interests`, {
    method: "POST", cookie: actor.cookie, status: 201,
    body: { message: `Acceptance test interest from ${role} ${runId}.` },
  });
  const inbox = await request("/societies/me/interests", { cookie: society.cookie });
  if (!inbox.data.interests?.some((item) => item.opportunityId === opportunityId && item.organizationName === actor.organizationName)) {
    throw new Error(`Society did not receive ${role} interest`);
  }
  const otherInbox = await request("/societies/me/interests", { cookie: otherSociety.cookie });
  if (otherInbox.data.interests?.some((item) => item.opportunityId === opportunityId)) throw new Error(`Second society can see ${role} interest`);
}

console.log(`RENOVA API acceptance passed on ${origin}: health, readiness, private registration gate, secure persistent sessions, login/logout, three roles, opportunity discovery and interests, draft secrecy, and cross-organization boundaries. Test marker: ${runId}`);
