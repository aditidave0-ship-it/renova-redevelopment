import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import express, { type ErrorRequestHandler } from "express";
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
import renovaRouter from "../src/routes/renova";
import opportunitiesRouter from "../src/routes/opportunities";
import workspace from "../src/routes/workspace";
import enquiriesRouter from "../src/routes/enquiries";
import profilesRouter from "../src/routes/profiles";
import feasibilityRouter from "../src/routes/feasibility";
import {
  hashPassword,
  createSession,
  readSession,
  verifyPassword,
} from "../src/lib/session";
import { issueAuthToken, issueEmailOtp } from "../src/lib/auth-tokens";
import { testSandboxAndEmail } from "./sandbox-delivery";
import sandboxBillingRouter from "../src/routes/sandbox-billing";
import emailJobsRouter from "../src/routes/email-jobs";
import { testAuthDelivery } from "./auth-delivery";

const previousOtpSecret = process.env.RENOVA_AUTH_TOKEN_SECRET;
const previousEmailConfig = Object.fromEntries(
  ["RENOVA_EMAIL_PROVIDER", "RESEND_API_KEY", "RENOVA_EMAIL_FROM", "RENOVA_APP_URL"].map((key) => [key, process.env[key]]),
);
const nativeFetch = globalThis.fetch;
const loginCodes = new Map<string, string>();
process.env.RENOVA_AUTH_TOKEN_SECRET =
  "TEST-ONLY-otp-secret-at-least-thirty-two-characters";
globalThis.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (url === "https://api.resend.com/emails") {
    const message = JSON.parse(String(init?.body));
    const otp = String(message.text).match(/sign-in code is (\d{6})/)?.[1];
    if (otp && Array.isArray(message.to)) loginCodes.set(message.to[0], otp);
    return Response.json({ id: "TEST-ONLY-captured-email" });
  }
  return nativeFetch(input, init);
};
const journal = JSON.parse(
  await readFile("../../lib/db/drizzle/meta/_journal.json", "utf8"),
);
for (const entry of journal.entries)
  await engine.exec(
    await readFile(`../../lib/db/drizzle/${entry.tag}.sql`, "utf8"),
  );

const app = express();
app.use(
  "/api/billing/webhook",
  express.raw({ type: "application/json", limit: "256kb" }),
);
app.use(express.json(), cookieParser());
app.use(
  "/api",
  auth,
  renovaRouter,
  opportunitiesRouter,
  workspace,
  enquiriesRouter,
  profilesRouter,
  feasibilityRouter,
  sandboxBillingRouter,
  emailJobsRouter,
);
const testErrors: ErrorRequestHandler = (error, _request, response, _next) => {
  response
    .status(error.name === "ZodError" ? 400 : (error.status ?? 500))
    .json({ error: "Test request rejected" });
};
app.use(testErrors);
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
async function loginRequest(email: string, password: string) {
  const keys = ["RENOVA_EMAIL_PROVIDER", "RESEND_API_KEY", "RENOVA_EMAIL_FROM", "RENOVA_APP_URL"];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  Object.assign(process.env, {
    RENOVA_EMAIL_PROVIDER: "resend",
    RESEND_API_KEY: "TEST-ONLY-intercepted-no-delivery",
    RENOVA_EMAIL_FROM: "TEST ONLY <sandbox@example.invalid>",
    RENOVA_APP_URL: "https://qa.example.invalid",
  });
  try {
    return await request("/auth/login", "POST", "", { email, password });
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}
async function loginWithOtp(email: string, password: string) {
  const initiated = await loginRequest(email, password);
  assert.equal(initiated.status, 202);
  checks++;
  assert.equal(initiated.headers.get("set-cookie"), null);
  checks++;
  const otp = loginCodes.get(email);
  assert.ok(otp, "test provider must privately capture the login OTP");
  checks++;
  const verified = await request("/auth/verify-login", "POST", "", { email, otp });
  assert.equal(verified.status, 200);
  checks++;
  return verified;
}
async function account(
  role: "SOCIETY" | "DEVELOPER" | "PMC" | "PROFESSIONAL",
  n: number,
) {
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
  const response = await loginWithOtp(user.email, "old-password-test");
  return {
    user,
    org,
    cookie: response.headers.get("set-cookie")!.split(";")[0],
  };
}
try {
  const professional = await account("PROFESSIONAL", 1);
  for (const specialization of [
    "ADVOCATE_LEGAL",
    "ARCHITECT",
    "STRUCTURAL_CONSULTANT",
    "VALUATION_FINANCE",
    "OTHER",
  ]) {
    const saved = await request("/profiles/me", "PUT", professional.cookie, {
      organizationName: "TEST ONLY professional",
      location: "Mumbai",
      description: "TEST ONLY practice",
      website: null,
      specialization,
      services: ["TEST ONLY services"],
      credentials: [{ name: "TEST ONLY private credential", isPublic: false }],
    });
    assert.equal(saved.status, 200);
    checks++;
    assert.equal(
      (
        (await (
          await request("/profiles/me", "GET", professional.cookie)
        ).json()) as any
      ).profile.specialization,
      specialization,
    );
    checks++;
  }
  assert.equal(
    (await request("/societies/me/opportunities", "GET", professional.cookie))
      .status,
    403,
  );
  checks++;
  const a = await account("SOCIETY", 1),
    b = await account("SOCIETY", 2),
    dev = await account("DEVELOPER", 1),
    pmc = await account("PMC", 1);
  for (const actor of [dev, pmc]) {
    const payload = {
      organizationName: `TEST ONLY ${actor.user.role} profile`,
      location: "Mumbai",
      officeLocation: "Mumbai",
      description: "TEST ONLY services",
      website: "https://company.example.invalid",
      publicEmail: "contact@example.invalid",
      areasServed: ["Mumbai"],
      locationsServed: ["Mumbai"],
      services: ["TEST ONLY consulting"],
      specializations: ["Redevelopment"],
      portfolio: [],
      credentials: [
        { name: "TEST ONLY private credential", isPublic: false },
        { name: "TEST ONLY public credential", isPublic: true },
      ],
      marketplaceVisible: true,
    };
    assert.equal(
      (await request("/profiles/me", "PUT", actor.cookie, payload)).status,
      200,
    );
    checks++;
    const owned = (
      (await (await request("/profiles/me", "GET", actor.cookie)).json()) as any
    ).profile;
    assert.equal(owned.organizationName, payload.organizationName);
    checks++;
    assert.equal(owned.credentials.length, 2);
    checks++;
    const visible = (
      (await (
        await request(
          `/marketplace/organizations/${actor.org.id}`,
          "GET",
          a.cookie,
        )
      ).json()) as any
    ).profile;
    assert.equal(visible.credentials.length, 1);
    checks++;
    assert.equal(visible.credentials[0].name, "TEST ONLY public credential");
    checks++;
    assert.equal(
      (
        await request(
          `/marketplace/organizations/${actor.org.id}`,
          "GET",
          pmc.cookie,
        )
      ).status,
      403,
    );
    checks++;
  }
  const token = issueAuthToken("PASSWORD_RESET");
  await db.insert(authTokens).values({
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
    (await loginRequest(a.user.email, "old-password-test")).status,
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
  const currentLogin = await loginWithOtp(a.user.email, "new-password-test");
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
  assert.equal(
    (await request(`/opportunities/${opportunity.id}`, "GET", dev.cookie))
      .status,
    404,
  );
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
        `/societies/me/opportunities/${opportunity.id}/publish`,
        "POST",
        a.cookie,
        {},
      )
    ).status,
    200,
  );
  checks++;
  const published = await request(
    `/opportunities/${opportunity.id}`,
    "GET",
    dev.cookie,
  );
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
  const receivedInterests = ((await received.json()) as any).interests;
  assert.equal(receivedInterests.length, 2);
  checks++;
  assert.equal(
    (
      await request(
        `/opportunities/${opportunity.id}/interests`,
        "POST",
        dev.cookie,
        {},
      )
    ).status,
    409,
  );
  checks++;
  assert.equal(
    (
      await request(
        `/societies/me/opportunities/${opportunity.id}`,
        "PATCH",
        a.cookie,
        { title: "TEST ONLY published edit" },
      )
    ).status,
    409,
  );
  checks++;
  assert.equal(
    (
      await request(
        `/societies/me/opportunities/${opportunity.id}/publish`,
        "POST",
        b.cookie,
        {},
      )
    ).status,
    404,
  );
  checks++;
  const devInterest = receivedInterests.find(
    (item: any) => item.role === "DEVELOPER",
  );
  assert.equal(
    (
      await request(
        `/societies/me/interests/${devInterest.id}`,
        "PATCH",
        b.cookie,
        { status: "SHORTLISTED" },
      )
    ).status,
    404,
  );
  checks++;
  assert.equal(
    (
      await request(
        `/societies/me/interests/${devInterest.id}`,
        "PATCH",
        a.cookie,
        { status: "SHORTLISTED" },
      )
    ).status,
    200,
  );
  checks++;
  assert.equal(
    (
      await request(
        `/organizations/me/interests/${devInterest.id}`,
        "DELETE",
        pmc.cookie,
      )
    ).status,
    404,
  );
  checks++;
  assert.equal(
    (
      await request(
        `/organizations/me/interests/${devInterest.id}`,
        "DELETE",
        dev.cookie,
      )
    ).status,
    200,
  );
  checks++;
  assert.equal(
    (
      await request(
        `/societies/me/interests/${devInterest.id}`,
        "PATCH",
        a.cookie,
        { status: "RECEIVED" },
      )
    ).status,
    409,
  );
  checks++;
  assert.equal(
    (
      await request(
        `/organizations/me/interests/${devInterest.id}`,
        "DELETE",
        dev.cookie,
      )
    ).status,
    409,
  );
  checks++;
  const profile = {
    organizationName: "TEST ONLY society profile",
    location: "Mumbai",
    website: null,
    description: "Test organization description",
  };
  assert.equal(
    (await request("/profiles/me", "PUT", a.cookie, profile)).status,
    200,
  );
  checks++;
  const aProfile = await request("/profiles/me", "GET", a.cookie);
  assert.equal(
    ((await aProfile.json()) as any).profile.organizationName,
    profile.organizationName,
  );
  checks++;
  const bProfile = await request("/profiles/me", "GET", b.cookie);
  assert.notEqual(
    ((await bProfile.json()) as any).profile.organizationName,
    profile.organizationName,
  );
  checks++;
  assert.equal(
    (
      await request("/profiles/me", "PUT", a.cookie, {
        organizationName: "TEST ONLY society profile",
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
    (await request("/profiles/me", "PUT", pmc.cookie, {})).status,
    400,
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
  const details = {
    societyName: "TEST ONLY society",
    propertyAddress: "TEST ONLY property",
    locality: "Mumbai",
    city: "Mumbai",
    pinCode: "400001",
    contactPerson: "TEST ONLY contact",
    contactEmail: "society@example.invalid",
    contactPhone: "9000000000",
    propertyData: { unknownFields: ["plotArea"] },
  };
  const feasible = await request("/feasibility", "POST", a.cookie, details);
  assert.equal(feasible.status, 201);
  checks++;
  const feasibility = ((await feasible.json()) as any).request;
  assert.equal(feasibility.status, "DRAFT");
  checks++;
  assert.equal(feasibility.assessment, null);
  checks++;
  for (const actor of [b, dev, pmc]) {
    for (const [method, path, body] of [
      ["GET", `/feasibility/${feasibility.id}`, undefined],
      ["PUT", `/feasibility/${feasibility.id}`, details],
      ["POST", `/feasibility/${feasibility.id}/submit`, {}],
    ] as const) {
      assert.equal(
        (await request(path, method, actor.cookie, body)).status,
        actor === b ? 404 : 403,
      );
      checks++;
    }
  }
  assert.equal(
    (
      await request(`/feasibility/${feasibility.id}`, "PUT", a.cookie, {
        ...details,
        societyName: "TEST ONLY edited society",
      })
    ).status,
    200,
  );
  checks++;
  assert.equal(
    (
      (await (
        await request(`/feasibility/${feasibility.id}`, "GET", a.cookie)
      ).json()) as any
    ).request.societyName,
    "TEST ONLY edited society",
  );
  checks++;
  const submissions = await Promise.all([
    request(`/feasibility/${feasibility.id}/submit`, "POST", a.cookie, {}),
    request(`/feasibility/${feasibility.id}/submit`, "POST", a.cookie, {}),
  ]);
  assert.deepEqual(submissions.map((row) => row.status).sort(), [200, 409]);
  checks++;
  assert.equal(
    (await request(`/feasibility/${feasibility.id}`, "PUT", a.cookie, details))
      .status,
    409,
  );
  checks++;
  assert.deepEqual(
    ((await (await request("/feasibility/me", "GET", b.cookie)).json()) as any)
      .requests,
    [],
  );
  checks++;
  for (const actor of [a, dev, pmc]) {
    assert.equal(
      (
        await request(
          `/admin/feasibility/${feasibility.id}/status`,
          "PATCH",
          actor.cookie,
          { status: "IN_REVIEW" },
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
  for (const payload of [
    { status: "IN_REVIEW" },
    {
      status: "MORE_INFORMATION_REQUIRED",
      missingInformation: "TEST ONLY request more documents",
    },
  ]) {
    assert.equal(
      (
        await request(
          `/admin/feasibility/${feasibility.id}/status`,
          "PATCH",
          adminCookie,
          payload,
        )
      ).status,
      200,
    );
    checks++;
  }
  const responseDraft = await request(
    `/feasibility/${feasibility.id}`,
    "PUT",
    a.cookie,
    details,
  );
  assert.equal(responseDraft.status, 200);
  checks++;
  assert.equal(
    ((await responseDraft.json()) as any).request.status,
    "MORE_INFORMATION_REQUIRED",
  );
  checks++;
  assert.ok(
    (
      (await (
        await request("/admin/feasibility", "GET", adminCookie)
      ).json()) as any
    ).requests.some((row: any) => row.id === feasibility.id),
  );
  checks++;
  assert.equal(
    (
      await request(
        `/feasibility/${feasibility.id}/submit`,
        "POST",
        a.cookie,
        {},
      )
    ).status,
    200,
  );
  checks++;
  assert.equal(
    (
      await request(
        `/admin/feasibility/${feasibility.id}/status`,
        "PATCH",
        adminCookie,
        { status: "IN_REVIEW" },
      )
    ).status,
    200,
  );
  checks++;
  assert.equal(
    (
      await request(
        `/admin/feasibility/${feasibility.id}/publish`,
        "POST",
        adminCookie,
        {},
      )
    ).status,
    409,
  );
  checks++;
  assert.equal(
    (
      await request(
        `/admin/feasibility/${feasibility.id}/assessment`,
        "PUT",
        adminCookie,
        {
          professionalNotes:
            "TEST ONLY professional assessment; no invented conclusions",
          assumptions: [],
          documentsReviewed: [],
        },
      )
    ).status,
    200,
  );
  checks++;
  assert.equal(
    (
      (await (
        await request(`/feasibility/${feasibility.id}`, "GET", a.cookie)
      ).json()) as any
    ).request.assessment,
    null,
  );
  checks++;
  const publications = await Promise.all([
    request(
      `/admin/feasibility/${feasibility.id}/publish`,
      "POST",
      adminCookie,
      {},
    ),
    request(
      `/admin/feasibility/${feasibility.id}/publish`,
      "POST",
      adminCookie,
      {},
    ),
  ]);
  assert.deepEqual(publications.map((row) => row.status).sort(), [200, 409]);
  checks++;
  const finalResult = (
    (await (
      await request(`/feasibility/${feasibility.id}`, "GET", a.cookie)
    ).json()) as any
  ).request;
  assert.equal(finalResult.status, "ASSESSMENT_READY");
  checks++;
  assert.equal(
    finalResult.assessment.professionalNotes,
    "TEST ONLY professional assessment; no invented conclusions",
  );
  checks++;
  assert.deepEqual(
    finalResult.history.map((row: any) => row.toStatus),
    [
      "DRAFT",
      "SUBMITTED",
      "IN_REVIEW",
      "MORE_INFORMATION_REQUIRED",
      "SUBMITTED",
      "IN_REVIEW",
      "ASSESSMENT_READY",
    ],
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
    await db.insert(authTokens).values({
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
  const second = await loginWithOtp(dev.user.email, "old-password-test");
  const secondCookie = second.headers.get("set-cookie")!.split(";")[0];
  const concurrentToken = issueAuthToken("PASSWORD_RESET");
  await db.insert(authTokens).values({
    userId: dev.user.id,
    purpose: "PASSWORD_RESET",
    tokenHash: concurrentToken.tokenHash,
    expiresAt: concurrentToken.expiresAt,
  });
  const duringLogin = await loginRequest(dev.user.email, "old-password-test");
  const duringReset = await request("/auth/reset-password", "POST", "", {
    token: concurrentToken.token,
    password: "concurrent-new-password",
  });
  assert.equal(duringReset.status, 200);
  checks++;
  assert.equal(duringLogin.status, 202, "password verification returns an OTP challenge, never a session");
  checks++;
  const racedOtp = loginCodes.get(dev.user.email);
  assert.ok(racedOtp);
  checks++;
  assert.equal(
    (await request("/auth/verify-login", "POST", "", { email: dev.user.email, otp: racedOtp })).status,
    400,
    "a password reset invalidates an OTP issued by a concurrent pre-reset login",
  );
  checks++;
  for (const cookie of [
    dev.cookie,
    secondCookie,
  ].filter(Boolean)) {
    assert.equal((await request("/auth/me", "GET", cookie!)).status, 401);
    checks++;
  }
  await loginWithOtp(dev.user.email, "concurrent-new-password");
  for (const role of ["SOCIETY", "DEVELOPER", "PMC"] as const) {
    const [unverified] = await db
      .insert(users)
      .values({
        email: `unverified-${role.toLowerCase()}@example.invalid`,
        displayName: "TEST ONLY verification",
        role,
        passwordHash: hashPassword("verification-password"),
        isActive: false,
      })
      .returning();
    assert.equal((await loginRequest(unverified.email, "verification-password")).status, 401);
    checks++;
    const verification = issueEmailOtp(unverified.id);
    let legacyCookie = "";
    await createSession(
      db as never,
      unverified.id,
      {
        cookie(_name: string, value: string) {
          legacyCookie = `renova_session=${value}`;
        },
      } as never,
      0,
    );
    await db.insert(authTokens).values({
      userId: unverified.id,
      purpose: "EMAIL_VERIFICATION",
      tokenHash: verification.tokenHash,
      expiresAt: verification.expiresAt,
    });
    assert.equal(
      (
        await request("/auth/verify-email", "POST", "", {
          email: unverified.email,
          otp: verification.otp,
        })
      ).status,
      200,
    );
    checks++;
    assert.equal((await request("/auth/me", "GET", legacyCookie)).status, 401);
    checks++;
    assert.equal(
      (
        await request("/auth/verify-email", "POST", "", {
          email: unverified.email,
          otp: verification.otp,
        })
      ).status,
      400,
    );
    checks++;
    await loginWithOtp(unverified.email, "verification-password");
  }
  const disabled = await account("DEVELOPER", 42);
  await db
    .update(users)
    .set({ isActive: false })
    .where(eq(users.id, disabled.user.id));
  const oldVerification = issueEmailOtp(disabled.user.id);
  await db.insert(authTokens).values({
    userId: disabled.user.id,
    purpose: "EMAIL_VERIFICATION",
    tokenHash: oldVerification.tokenHash,
    expiresAt: oldVerification.expiresAt,
  });
  assert.equal(
    (
      await request("/auth/verify-email", "POST", "", {
        email: disabled.user.email,
        otp: oldVerification.otp,
      })
    ).status,
    400,
    "verification must not reactivate a verified disabled account",
  );
  checks++;
  const [stillDisabled] = await db
    .select()
    .from(users)
    .where(eq(users.id, disabled.user.id));
  assert.equal(stillDisabled.isActive, false);
  checks++;
  assert.equal((await request("/auth/me", "GET", disabled.cookie)).status, 401);
  checks++;
  assert.equal((await loginRequest(disabled.user.email, "old-password-test")).status, 401);
  checks++;
  checks += await testAuthDelivery(origin);
  const concurrentEnquiries = await Promise.all(
    Array.from({ length: 8 }, () =>
      request("/enquiries", "POST", "", {
        name: "TEST ONLY concurrent enquiry",
        organizationName: "TEST ONLY society",
        email: "concurrent-enquiry@example.invalid",
        phone: "9000000000",
        city: "Mumbai",
        actorType: "Housing Society",
        message: "TEST ONLY rate-limit regression",
        consent: true,
      }),
    ),
  );
  assert.equal(
    concurrentEnquiries.filter((row) => row.status === 201).length,
    5,
    "concurrent enquiries must not exceed five submissions per fingerprint/hour",
  );
  checks++;
  assert.equal(
    concurrentEnquiries.filter((row) => row.status === 429).length,
    3,
  );
  checks++;
  assert.equal(
    (
      await db
        .select()
        .from(enquiries)
        .where(eq(enquiries.email, "concurrent-enquiry@example.invalid"))
    ).length,
    5,
  );
  checks++;
  checks += await testSandboxAndEmail(
    origin,
    a.cookie,
    b.cookie,
    pmc.cookie,
    adminCookie,
  );
  assert.equal((await request("/auth/me", "GET", pmc.cookie)).status, 200);
  checks++;
  await db
    .update(authSessions)
    .set({ expiresAt: new Date(Date.now() - 1000) })
    .where(eq(authSessions.userId, pmc.user.id));
  assert.equal((await request("/auth/me", "GET", pmc.cookie)).status, 401);
  checks++;
  assert.equal((await request("/auth/me", "GET", a.cookie)).status, 200);
  checks++;
  assert.equal(
    (await request("/auth/logout", "POST", a.cookie, {})).status,
    204,
  );
  checks++;
  assert.equal((await request("/auth/me", "GET", a.cookie)).status, 401);
  checks++;
  console.log(
    `PASS: ${checks} database-backed auth/draft/authorization assertions (isolated PostgreSQL/PGlite).`,
  );
} finally {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await engine.close();
  if (previousOtpSecret === undefined)
    delete process.env.RENOVA_AUTH_TOKEN_SECRET;
  else process.env.RENOVA_AUTH_TOKEN_SECRET = previousOtpSecret;
  globalThis.fetch = nativeFetch;
  for (const [key, value] of Object.entries(previousEmailConfig)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
