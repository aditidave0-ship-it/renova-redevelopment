import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import express from "express";
import cookieParser from "cookie-parser";
import { eq } from "drizzle-orm";
import {
  engine,
  db,
  users,
  organizations,
  societies,
  organizationMembers,
  authSessions,
  authTokens,
  enquiries,
} from "./database";
import auth from "../src/routes/auth";
import opportunitiesRouter from "../src/routes/opportunities";
import workspace from "../src/routes/workspace";
import enquiriesRouter from "../src/routes/enquiries";
import {
  hashPassword,
  createSession,
  readSession,
  verifyPassword,
} from "../src/lib/session";
import { issueAuthToken } from "../src/lib/auth-tokens";

for (const file of [
  "0000_real_roland_deschain",
  "0001_bright_hedge_knight",
  "0002_credential_versions",
  "0003_feasibility_foundation",
  "0004_participant_feasibility",
]) {
  await engine.exec(await readFile(`../../lib/db/drizzle/${file}.sql`, "utf8"));
}
const app = express();
app.use(express.json(), cookieParser());
app.use("/api", auth, opportunitiesRouter, workspace, enquiriesRouter);
const server = createServer(app);
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert.ok(address && typeof address !== "string");
const origin = `http://127.0.0.1:${address.port}`;
let checks = 0;
async function request(
  path: string,
  method = "GET",
  cookie = "",
  body?: unknown,
) {
  return fetch(origin + "/api" + path, {
    method,
    headers: { "content-type": "application/json", cookie },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
async function account(role: "SOCIETY" | "DEVELOPER" | "PMC" | "PROFESSIONAL", n: number) {
  const [user] = await db
    .insert(users)
    .values({
      email: `test-${role.toLowerCase()}-${n}@example.invalid`,
      displayName: `TEST ONLY ${role} ${n}`,
      role,
      passwordHash: hashPassword("old-password-test"),
      emailVerifiedAt: new Date(),
    })
    .returning();
  const [org] = await db
    .insert(organizations)
    .values({ name: `TEST ONLY ${role} ${n}`, kind: role })
    .returning();
  await db
    .insert(organizationMembers)
    .values({ userId: user.id, organizationId: org.id });
  if (role === "SOCIETY")
    await db.insert(societies).values({ organizationId: org.id });
  const response = await request("/auth/login", "POST", "", {
    email: user.email,
    password: "old-password-test",
  });
  assert.equal(response.status, 200);
  checks++;
  return {
    user,
    org,
    cookie: response.headers.get("set-cookie")!.split(";")[0],
  };
}
try {
  const professional = await account("PROFESSIONAL", 1);
  for (const specialization of ["LEGAL", "ARCHITECT", "STRUCTURAL", "FINANCE_VALUATION", "OTHER"]) {
    const saved = await request("/organizations/me", "PUT", professional.cookie, { name: "TEST ONLY professional", location: "Mumbai", description: "TEST ONLY practice", website: "", specialization, services: "TEST ONLY services", credentials: "Self-reported test record", portfolio: "TEST ONLY portfolio" });
    assert.equal(saved.status, 200); checks++;
    assert.equal(((await (await request("/organizations/me", "GET", professional.cookie)).json()) as any).organization.specialization, specialization); checks++;
  }
  assert.equal((await request("/societies/me/opportunities", "GET", professional.cookie)).status, 403); checks++;
  const a = await account("SOCIETY", 1),
    b = await account("SOCIETY", 2),
    dev = await account("DEVELOPER", 1),
    pmc = await account("PMC", 1);
  const token = issueAuthToken("PASSWORD_RESET");
  await db
    .insert(authTokens)
    .values({
      userId: a.user.id,
      purpose: "PASSWORD_RESET",
      tokenHash: token.tokenHash,
      expiresAt: token.expiresAt,
    });
  const reset = await request("/auth/reset-password", "POST", "", {
    token: token.token,
    password: "new-password-test",
  });
  assert.equal(reset.status, 200);
  checks++;
  assert.equal((await request("/auth/me", "GET", a.cookie)).status, 401);
  checks++;
  assert.equal(
    (
      await request("/auth/login", "POST", "", {
        email: a.user.email,
        password: "old-password-test",
      })
    ).status,
    401,
  );
  checks++;
  assert.equal(
    (
      await request("/auth/reset-password", "POST", "", {
        token: token.token,
        password: "another-password",
      })
    ).status,
    400,
  );
  checks++;
  // Deterministic race interleaving: credentials read before reset, session insert after reset.
  let staleCookie = "";
  await createSession(
    db as never,
    a.user.id,
    {
      cookie(_name: string, value: string) {
        staleCookie = `renova_session=${value}`;
      },
    } as never,
    a.user.credentialVersion,
  );
  assert.equal((await request("/auth/me", "GET", staleCookie)).status, 401);
  checks++;
  const currentLogin = await request("/auth/login", "POST", "", {
    email: a.user.email,
    password: "new-password-test",
  });
  assert.equal(currentLogin.status, 200);
  checks++;
  a.cookie = currentLogin.headers.get("set-cookie")!.split(";")[0];
  const [updated] = await db
    .select()
    .from(users)
    .where(eq(users.id, a.user.id));
  assert.equal(
    verifyPassword("old-password-test", updated.passwordHash),
    false,
  );
  assert.equal(updated.credentialVersion, 1);
  checks++;
  const draft = {
    title: "TEST ONLY redevelopment",
    location: "Mumbai",
    description: "TEST ONLY private society brief for integration testing",
    publish: false,
  };
  const created = await request("/opportunities", "POST", a.cookie, draft);
  assert.equal(created.status, 201);
  const { opportunity } = (await created.json()) as any;
  checks++;
  assert.equal((await request(`/opportunities/${opportunity.id}`)).status, 404);
  checks++;
  for (const foreign of [b, dev, pmc]) {
    const expected = foreign === b ? 404 : 403;
    assert.equal(
      (
        await request(
          `/societies/me/opportunities/${opportunity.id}`,
          "GET",
          foreign.cookie,
        )
      ).status,
      expected,
    );
    assert.equal(
      (
        await request(
          `/societies/me/opportunities/${opportunity.id}`,
          "PATCH",
          foreign.cookie,
          { ...draft, publish: true },
        )
      ).status,
      expected,
    );
    checks += 2;
  }
  assert.equal(
    (await request(`/societies/me/opportunities/${opportunity.id}`)).status,
    401,
  );
  checks++;
  const saved = await request(
    `/societies/me/opportunities/${opportunity.id}`,
    "PATCH",
    a.cookie,
    { ...draft, title: "TEST ONLY edited draft" },
  );
  assert.equal(saved.status, 200);
  checks++;
  const reload = await request(
    `/societies/me/opportunities/${opportunity.id}`,
    "GET",
    a.cookie,
  );
  assert.equal(
    ((await reload.json()) as any).opportunity.title,
    "TEST ONLY edited draft",
  );
  checks++;
  assert.equal(
    (
      await request(
        `/societies/me/opportunities/${opportunity.id}`,
        "PATCH",
        a.cookie,
        { ...draft, publish: true },
      )
    ).status,
    200,
  );
  checks++;
  const published = await request(`/opportunities/${opportunity.id}`);
  const publicFields = ((await published.json()) as any).opportunity;
  assert.equal(published.status, 200);
  assert.equal("societyId" in publicFields, false);
  assert.equal("email" in publicFields, false);
  checks++;
  for (const actor of [dev, pmc])
    assert.equal(
      (
        await request(
          `/opportunities/${opportunity.id}/interests`,
          "POST",
          actor.cookie,
          {},
        )
      ).status,
      201,
    );
  checks += 2;
  const received = await request("/societies/me/interests", "GET", a.cookie);
  assert.equal(((await received.json()) as any).interests.length, 2);
  checks++;
  const profile = {
    name: "TEST ONLY society profile",
    location: "Mumbai",
    website: "",
    description: "Test organization description",
  };
  assert.equal(
    (await request("/organizations/me", "PUT", a.cookie, profile)).status,
    200,
  );
  checks++;
  const aProfile = await request("/organizations/me", "GET", a.cookie);
  assert.equal(
    ((await aProfile.json()) as any).organization.name,
    profile.name,
  );
  checks++;
  const bProfile = await request("/organizations/me", "GET", b.cookie);
  assert.notEqual(
    ((await bProfile.json()) as any).organization.name,
    profile.name,
  );
  checks++;
  assert.equal(
    (
      await request("/societies/me/profile", "PUT", a.cookie, {
        address: "TEST ONLY address",
        city: "Mumbai",
        memberCount: 20,
        buildingAge: 40,
        redevelopmentStatus: "Considering redevelopment",
      })
    ).status,
    200,
  );
  checks++;
  assert.equal(
    (await request("/societies/me/profile", "PUT", pmc.cookie, {})).status,
    403,
  );
  checks++;
  const metric = await request("/workspace/metrics", "GET", a.cookie);
  assert.equal(((await metric.json()) as any).interests, 2);
  checks++;
  for (const actor of [dev, pmc]) {
    const interest = await request(
      "/organizations/me/interests",
      "GET",
      actor.cookie,
    );
    assert.equal(((await interest.json()) as any).interests.length, 1);
    checks++;
  }
  const feasible = await request(
    "/societies/me/feasibility", "POST", a.cookie,
    { propertyAddress: "", requirement: "", submit: false },
  );
  assert.equal(feasible.status, 201); checks++;
  const draftFeasibility = ((await feasible.json()) as any).request;
  assert.equal(draftFeasibility.status, "DRAFT"); checks++;
  for (const actor of [b, dev, pmc]) {
    assert.equal((await request(`/societies/me/feasibility/${draftFeasibility.id}`, "PATCH", actor.cookie, { propertyAddress: "TEST ONLY property", requirement: "TEST ONLY professional review requested", submit: true })).status, actor === b ? 404 : 403); checks++;
  }
  assert.equal((await request(`/societies/me/feasibility/${draftFeasibility.id}`, "PATCH", a.cookie, { propertyAddress: "TEST ONLY property", requirement: "TEST ONLY professional review requested", submit: false })).status, 200); checks++;
  assert.equal((await request(`/societies/me/feasibility/${draftFeasibility.id}`, "PATCH", a.cookie, { propertyAddress: "TEST ONLY property", requirement: "TEST ONLY professional review requested", submit: true })).status, 200); checks++;
  assert.equal((await request(`/societies/me/feasibility/${draftFeasibility.id}`, "PATCH", a.cookie, { propertyAddress: "TEST ONLY property", requirement: "TEST ONLY professional review requested", submit: false })).status, 404); checks++;
  const submittedFeasible = await request(
    "/societies/me/feasibility",
    "POST",
    a.cookie,
    {
      propertyAddress: "TEST ONLY Mumbai property",
      requirement: "TEST ONLY request for professional review",
    },
  );
  assert.equal(submittedFeasible.status, 201);
  checks++;
  const feasibility = ((await submittedFeasible.json()) as any).request;
  assert.equal(feasibility.status, "SUBMITTED");
  assert.equal(feasibility.assessmentNotes, null);
  checks++;
  const isolated = await request("/societies/me/feasibility", "GET", b.cookie);
  assert.deepEqual(((await isolated.json()) as any).requests, []);
  checks++;
  for (const actor of [a, dev, pmc]) {
    assert.equal(
      (
        await request(
          `/admin/feasibility/${feasibility.id}`,
          "PATCH",
          actor.cookie,
          {
            status: "ASSESSED",
            assessmentNotes: "TEST ONLY professional notes",
          },
        )
      ).status,
      403,
    );
    checks++;
  }
  const [admin] = await db
    .insert(users)
    .values({
      email: "admin@example.invalid",
      displayName: "TEST ONLY admin",
      role: "ADMIN",
      passwordHash: hashPassword("test-admin-password"),
      emailVerifiedAt: new Date(),
    })
    .returning();
  let adminCookie = "";
  await createSession(
    db as never,
    admin.id,
    {
      cookie(_name: string, value: string) {
        adminCookie = `renova_session=${value}`;
      },
    } as never,
    0,
  );
  assert.equal(
    (
      await request(
        `/admin/feasibility/${feasibility.id}`,
        "PATCH",
        adminCookie,
        {
          status: "IN_REVIEW",
          assessmentNotes: "TEST ONLY review awaiting verified documents",
        },
      )
    ).status,
    200,
  );
  checks++;
  const reviewed = await request("/societies/me/feasibility", "GET", a.cookie);
  assert.equal(
    ((await reviewed.json()) as any).requests.find((r: any) => r.id === feasibility.id).status,
    "IN_REVIEW",
  );
  checks++;
  const enquiry = await request("/enquiries", "POST", "", {
    name: "TEST ONLY person",
    organizationName: "TEST ONLY society",
    email: "enquiry@example.invalid",
    phone: "9000000000",
    city: "Mumbai",
    actorType: "Housing Society",
    message: "TEST ONLY request for controlled beta testing",
    consent: true,
  });
  assert.equal(enquiry.status, 201);
  checks++;
  assert.equal((await db.select().from(enquiries)).length, 1);
  checks++;
  assert.equal(
    (await request("/admin/enquiries", "GET", dev.cookie)).status,
    403,
  );
  checks++;
  const adminEnquiries = await request("/admin/enquiries", "GET", adminCookie);
  assert.equal(((await adminEnquiries.json()) as any).enquiries.length, 1);
  checks++;
  for (const purpose of ["EMAIL_VERIFICATION", "PASSWORD_RESET"] as const) {
    const expired = issueAuthToken(purpose);
    await db
      .insert(authTokens)
      .values({
        userId: dev.user.id,
        purpose,
        tokenHash: expired.tokenHash,
        expiresAt: new Date(Date.now() - 1000),
      });
    const endpoint =
      purpose === "PASSWORD_RESET"
        ? "/auth/reset-password"
        : "/auth/verify-email";
    assert.equal(
      (
        await request(endpoint, "POST", "", {
          token: expired.token,
          password: "test-new-password",
        })
      ).status,
      400,
    );
    checks++;
    assert.equal(
      (
        await request(endpoint, "POST", "", {
          token: "x".repeat(43),
          password: "test-new-password",
        })
      ).status,
      400,
    );
    checks++;
  }
  // Multiple existing sessions are invalidated; fresh credentials can log in afterward.
  const second = await request("/auth/login", "POST", "", {
    email: dev.user.email,
    password: "old-password-test",
  });
  const secondCookie = second.headers.get("set-cookie")!.split(";")[0];
  const concurrentToken = issueAuthToken("PASSWORD_RESET");
  await db
    .insert(authTokens)
    .values({
      userId: dev.user.id,
      purpose: "PASSWORD_RESET",
      tokenHash: concurrentToken.tokenHash,
      expiresAt: concurrentToken.expiresAt,
    });
  const [duringLogin, duringReset] = await Promise.all([
    request("/auth/login", "POST", "", {
      email: dev.user.email,
      password: "old-password-test",
    }),
    request("/auth/reset-password", "POST", "", {
      token: concurrentToken.token,
      password: "concurrent-new-password",
    }),
  ]);
  assert.equal(duringReset.status, 200);
  checks++;
  for (const cookie of [
    dev.cookie,
    secondCookie,
    duringLogin.headers.get("set-cookie")?.split(";")[0],
  ].filter(Boolean)) {
    assert.equal((await request("/auth/me", "GET", cookie!)).status, 401);
    checks++;
  }
  assert.equal(
    (
      await request("/auth/login", "POST", "", {
        email: dev.user.email,
        password: "concurrent-new-password",
      })
    ).status,
    200,
  );
  checks++;
  for (const role of ["SOCIETY", "DEVELOPER", "PMC"] as const) {
    const [unverified] = await db.insert(users).values({ email: `unverified-${role.toLowerCase()}@example.invalid`, displayName: 'TEST ONLY verification', role, passwordHash: hashPassword('verification-password'), isActive: false }).returning();
    assert.equal((await request('/auth/login','POST','',{email:unverified.email,password:'verification-password'})).status,401); checks++;
    const verification=issueAuthToken('EMAIL_VERIFICATION');
    await db.insert(authTokens).values({userId:unverified.id,purpose:'EMAIL_VERIFICATION',tokenHash:verification.tokenHash,expiresAt:verification.expiresAt});
    assert.equal((await request('/auth/verify-email','POST','',{token:verification.token})).status,200); checks++;
    assert.equal((await request('/auth/verify-email','POST','',{token:verification.token})).status,400); checks++;
    assert.equal((await request('/auth/login','POST','',{email:unverified.email,password:'verification-password'})).status,200); checks++;
  }
  console.log(
    `PASS: ${checks} database-backed auth/draft/authorization assertions (isolated PostgreSQL/PGlite).`,
  );
} finally {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await engine.close();
}
