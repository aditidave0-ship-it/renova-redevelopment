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
  organizationMembers,
  enquiries,
  privacyRequests,
  privacyConsentEvents,
  userAttestations,
} from "./database";
import auth from "../src/routes/auth";
import enquiriesRouter from "../src/routes/enquiries";
import privacyRouter from "../src/routes/privacy";
import { hashPassword } from "../src/lib/session";

// NIRMAQ Phase B — privacy integration acceptance (isolated PGlite).
// Covers: consent enforcement + failure path, the privacy request workflow
// (submit / verify / status), the Admin queue + status workflow + holds,
// server-side 18+ attestation, retention dry-run, and role-based access.
// Email is intercepted, never sent out.
const previousOtpSecret = process.env.RENOVA_AUTH_TOKEN_SECRET;
process.env.RENOVA_AUTH_TOKEN_SECRET =
  "TEST-ONLY-otp-secret-at-least-thirty-two-characters";
const previousNodeEnv = process.env.NODE_ENV;
process.env.NODE_ENV = "production";
process.env.RENOVA_EMAIL_PROVIDER = "resend";
process.env.RESEND_API_KEY = "TEST-ONLY-no-real-provider-key";
process.env.RENOVA_APP_URL = "https://qa.example.invalid";
process.env.RENOVA_EMAIL_FROM = "TEST ONLY <no-mail@example.invalid>";
process.env.RENOVA_REGISTRATION_TEST_TOKEN =
  "TEST-ONLY-local-registration";
delete process.env.RENOVA_REGISTRATION_OPEN;
delete process.env.RENOVA_BETA_RELEASE_APPROVED;

const nativeFetch = globalThis.fetch;
const sent: Array<{ to: string[]; text: string }> = [];
globalThis.fetch = async (input, init) => {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  if (url === "https://api.resend.com/emails") {
    sent.push(JSON.parse(String(init?.body)));
    return Response.json({ id: "TEST-ONLY-delivery" });
  }
  return nativeFetch(input, init);
};

const journal = JSON.parse(
  await readFile("../../lib/db/drizzle/meta/_journal.json", "utf8"),
);
// Migration guard: Phase B must NOT ship a numbered migration while PR #35's
// 0009 is still open. The journal must not contain a 0010 entry.
assert.equal(
  journal.entries.some((entry: { tag: string }) =>
    entry.tag.startsWith("0010"),
  ),
  false,
  "migration journal must not contain a Phase B 0010 entry",
);
for (const entry of journal.entries)
  await engine.exec(
    await readFile(`../../lib/db/drizzle/${entry.tag}.sql`, "utf8"),
  );
// The provisional Phase B schema is applied from the clearly-marked
// provisional file only — it becomes 0010 once 0009 lands.
await engine.exec(
  await readFile(
    "../../lib/db/drizzle/provisional/0010_privacy_phase_b.sql",
    "utf8",
  ),
);

const app = express();
app.use(express.json(), cookieParser());
app.use("/api", auth, enquiriesRouter, privacyRouter);
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
  extraHeaders: Record<string, string> = {},
) {
  return nativeFetch(origin + "/api" + path, {
    method,
    headers: {
      "content-type": "application/json",
      cookie,
      ...extraHeaders,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function account(
  role: "SOCIETY" | "DEVELOPER" | "PMC" | "PROFESSIONAL" | "ADMIN",
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
    .values({
      name: `TEST ONLY ${role} ${n}`,
      // organization_kind has no ADMIN value; the Admin's role lives on the
      // user row, so any valid kind works for the fixture organisation.
      kind: role === "ADMIN" ? "PMC" : role,
    })
    .returning();
  await db
    .insert(organizationMembers)
    .values({ userId: user.id, organizationId: org.id });
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

function privacyVerificationToken(email: string): {
  reference: string;
  token: string;
} {
  const message = [...sent]
    .reverse()
    .find(
      (row) =>
        row.to.includes(email) && row.text.includes("/privacy?reference="),
    );
  assert.ok(message, "verification email must be captured");
  checks++;
  const link = message.text.match(/https:\/\/\S+privacy\?reference=\S+/)?.[0];
  assert.ok(link);
  checks++;
  const url = new URL(link);
  const reference = url.searchParams.get("reference");
  const token = url.searchParams.get("token");
  assert.ok(reference && token);
  checks++;
  return { reference, token };
}

function emailOtp(email: string): string {
  const message = [...sent]
    .reverse()
    .find(
      (row) =>
        row.to.includes(email) && /verification code is \d{6}/.test(row.text),
    );
  assert.ok(message, "verification OTP email must be captured");
  checks++;
  return message.text.match(/verification code is (\d{6})/)![1];
}

const enquiryBody = {
  name: "TEST ONLY requester",
  organizationName: "TEST ONLY society",
  email: "privacy-enquiry@example.invalid",
  phone: "9876543210",
  city: "Mumbai",
  actorType: "Housing Society",
  message: "TEST ONLY enquiry for consent enforcement",
  source: "WEBSITE",
};

try {
  const admin = await account("ADMIN", 1);
  const society = await account("SOCIETY", 1);

  // --- Consent enforcement: no consent = no processing -------------------
  assert.equal(
    (await request("/enquiries", "POST", "", { ...enquiryBody, consent: false }))
      .status,
    400,
  );
  checks++;
  const enquiryResponse = await request("/enquiries", "POST", "", {
    ...enquiryBody,
    consent: true,
  });
  assert.equal(enquiryResponse.status, 201);
  checks++;
  const enquiryReference = ((await enquiryResponse.json()) as any).reference;
  const [enquiry] = await db
    .select()
    .from(enquiries)
    .where(eq(enquiries.reference, enquiryReference));
  assert.ok(enquiry);
  checks++;
  // The consent event is persisted with the enquiry, in the same transaction.
  const consentEvents = await db
    .select()
    .from(privacyConsentEvents)
    .where(eq(privacyConsentEvents.subjectId, enquiry.id));
  assert.equal(consentEvents.length, 1);
  checks++;
  assert.equal(consentEvents[0].action, "GIVEN");
  checks++;
  assert.equal(consentEvents[0].purpose, "ENQUIRY_RESPONSE");
  checks++;
  assert.equal(consentEvents[0].consentVersion, "v1");
  checks++;
  assert.equal(consentEvents[0].actor, "SUBJECT");
  checks++;
  const adminConsent = await request(
    `/admin/enquiries/${enquiry.id}/consent`,
    "GET",
    admin.cookie,
  );
  assert.equal(adminConsent.status, 200);
  checks++;
  assert.equal(((await adminConsent.json()) as any).consentEvents.length, 1);
  checks++;
  assert.equal(
    (await request(`/admin/enquiries/${enquiry.id}/consent`, "GET", society.cookie))
      .status,
    403,
  );
  checks++;

  // --- Privacy request: submit, duplicate, verify, status ----------------
  const requesterEmail = "privacy-requester@example.invalid";
  const submit = await request("/privacy/requests", "POST", "", {
    email: requesterEmail,
    type: "ACCESS",
    details: "TEST ONLY access request",
  });
  assert.equal(submit.status, 202);
  checks++;
  const submitted = (await submit.json()) as any;
  assert.equal(submitted.status, "IDENTITY_PENDING");
  checks++;
  assert.match(submitted.reference, /^PRV-\d{4}-[0-9A-Z]{10}$/);
  checks++;
  // Duplicate protection: the same email + type returns the same reference.
  const duplicate = await request("/privacy/requests", "POST", "", {
    email: requesterEmail,
    type: "ACCESS",
  });
  assert.equal(duplicate.status, 202);
  checks++;
  assert.equal(((await duplicate.json()) as any).reference, submitted.reference);
  checks++;
  // Status is token-gated.
  assert.equal(
    (
      await request(
        `/privacy/requests/${submitted.reference}/status`,
        "GET",
      )
    ).status,
    401,
  );
  checks++;
  assert.equal(
    (
      await request(
        `/privacy/requests/${submitted.reference}/status?token=${"0".repeat(64)}`,
        "GET",
      )
    ).status,
    401,
  );
  checks++;
  const { reference, token } = privacyVerificationToken(requesterEmail);
  assert.equal(reference, submitted.reference);
  checks++;
  // Wrong token: 400, and the failed attempt is recorded.
  assert.equal(
    (
      await request(`/privacy/requests/${reference}/verify`, "POST", "", {
        token: "0".repeat(64),
      })
    ).status,
    400,
  );
  checks++;
  const [afterFailure] = await db
    .select()
    .from(privacyRequests)
    .where(eq(privacyRequests.reference, reference));
  assert.equal(afterFailure.verificationAttempts, 1);
  checks++;
  // Correct token: verified, status token issued.
  const verify = await request(`/privacy/requests/${reference}/verify`, "POST", "", {
    token,
  });
  assert.equal(verify.status, 200);
  checks++;
  const verified = (await verify.json()) as any;
  assert.equal(verified.status, "SUBMITTED");
  checks++;
  assert.equal(typeof verified.statusToken, "string");
  checks++;
  assert.ok(verified.history.some((event: any) => event.action === "VERIFIED"));
  checks++;
  // A second verification is rejected.
  assert.equal(
    (
      await request(`/privacy/requests/${reference}/verify`, "POST", "", {
        token,
      })
    ).status,
    409,
  );
  checks++;
  const status = await request(
    `/privacy/requests/${reference}/status?token=${verified.statusToken}`,
    "GET",
  );
  assert.equal(status.status, 200);
  checks++;
  const statusBody = (await status.json()) as any;
  assert.equal(statusBody.request.reference, reference);
  checks++;
  assert.equal(statusBody.request.status, "SUBMITTED");
  checks++;
  assert.ok(
    statusBody.history.every((event: any) => event.action !== "NOTE_ADDED"),
    "admin notes stay out of the subject-visible history",
  );
  checks++;

  // --- Admin queue: RBAC, workflow, invalid transitions ------------------
  assert.equal((await request("/admin/privacy-requests", "GET")).status, 401);
  checks++;
  assert.equal(
    (await request("/admin/privacy-requests", "GET", society.cookie)).status,
    403,
  );
  checks++;
  const queue = await request("/admin/privacy-requests", "GET", admin.cookie);
  assert.equal(queue.status, 200);
  checks++;
  const queueBody = (await queue.json()) as any;
  const queued = queueBody.requests.find(
    (row: any) => row.reference === reference,
  );
  assert.ok(queued);
  checks++;
  assert.equal(queued.verificationStatus, "VERIFIED");
  checks++;
  assert.equal(queued.verificationTokenHash, undefined);
  checks++;
  assert.equal(queued.statusTokenHash, undefined);
  checks++;
  const detail = await request(
    `/admin/privacy-requests/${queued.id}`,
    "GET",
    admin.cookie,
  );
  assert.equal(detail.status, 200);
  checks++;
  assert.ok(((await detail.json()) as any).history.length >= 3);
  checks++;
  // An illegal skip (SUBMITTED straight to FULFILLED) is rejected.
  assert.equal(
    (
      await request(`/admin/privacy-requests/${queued.id}`, "PATCH", admin.cookie, {
        status: "FULFILLED",
      })
    ).status,
    409,
  );
  checks++;
  const inReview = await request(
    `/admin/privacy-requests/${queued.id}`,
    "PATCH",
    admin.cookie,
    { status: "IN_REVIEW", note: "TEST ONLY review started" },
  );
  assert.equal(inReview.status, 200);
  checks++;
  assert.equal(((await inReview.json()) as any).request.status, "IN_REVIEW");
  checks++;
  const fulfilled = await request(
    `/admin/privacy-requests/${queued.id}`,
    "PATCH",
    admin.cookie,
    { status: "FULFILLED" },
  );
  assert.equal(fulfilled.status, 200);
  checks++;
  assert.equal(((await fulfilled.json()) as any).request.status, "FULFILLED");
  checks++;
  // A fulfilled request cannot move backwards.
  assert.equal(
    (
      await request(`/admin/privacy-requests/${queued.id}`, "PATCH", admin.cookie, {
        status: "IN_REVIEW",
      })
    ).status,
    409,
  );
  checks++;

  // --- Holds block fulfilment ---------------------------------------------
  const heldEmail = "privacy-held@example.invalid";
  assert.equal(
    (
      await request("/privacy/requests", "POST", "", {
        email: heldEmail,
        type: "DELETION",
      })
    ).status,
    202,
  );
  checks++;
  const held = privacyVerificationToken(heldEmail);
  assert.equal(
    (
      await request(`/privacy/requests/${held.reference}/verify`, "POST", "", {
        token: held.token,
      })
    ).status,
    200,
  );
  checks++;
  const [heldRow] = await db
    .select()
    .from(privacyRequests)
    .where(eq(privacyRequests.reference, held.reference));
  const hold = await request(
    `/admin/privacy-requests/${heldRow.id}`,
    "PATCH",
    admin.cookie,
    { holdReason: "TEST ONLY legal review pending" },
  );
  assert.equal(hold.status, 200);
  checks++;
  assert.equal(((await hold.json()) as any).request.underHold, true);
  checks++;
  const inReviewHeld = await request(
    `/admin/privacy-requests/${heldRow.id}`,
    "PATCH",
    admin.cookie,
    { status: "IN_REVIEW" },
  );
  assert.equal(inReviewHeld.status, 200);
  checks++;
  assert.equal(
    (
      await request(`/admin/privacy-requests/${heldRow.id}`, "PATCH", admin.cookie, {
        status: "FULFILLED",
      })
    ).status,
    409,
  );
  checks++;
  const released = await request(
    `/admin/privacy-requests/${heldRow.id}`,
    "PATCH",
    admin.cookie,
    { holdReleased: true },
  );
  assert.equal(released.status, 200);
  checks++;
  assert.equal(((await released.json()) as any).request.underHold, false);
  checks++;
  assert.equal(
    (
      await request(`/admin/privacy-requests/${heldRow.id}`, "PATCH", admin.cookie, {
        status: "FULFILLED",
      })
    ).status,
    200,
  );
  checks++;

  // --- 18+ attestation: required at registration -------------------------
  const attestationEmail = "privacy-attestation@example.invalid";
  assert.equal(
    (
      await request(
        "/auth/register",
        "POST",
        "",
        {
          email: attestationEmail,
          password: "test-password-valid",
          displayName: "TEST ONLY attestation",
          participantType: "PMC",
          organizationName: "TEST ONLY attestation",
        },
        { "x-renova-registration-test": "TEST-ONLY-local-registration" },
      )
    ).status,
    400,
  );
  checks++;
  assert.equal(
    (
      await request(
        "/auth/register",
        "POST",
        "",
        {
          email: attestationEmail,
          password: "test-password-valid",
          displayName: "TEST ONLY attestation",
          participantType: "PMC",
          organizationName: "TEST ONLY attestation",
          ageAttestation: true,
        },
        { "x-renova-registration-test": "TEST-ONLY-local-registration" },
      )
    ).status,
    202,
  );
  checks++;
  assert.equal(
    (
      await request("/auth/verify-email", "POST", "", {
        email: attestationEmail,
        otp: emailOtp(attestationEmail),
      })
    ).status,
    200,
  );
  checks++;
  const attestationLogin = await request("/auth/login", "POST", "", {
    email: attestationEmail,
    password: "test-password-valid",
  });
  assert.equal(attestationLogin.status, 200);
  checks++;
  const attestationCookie = attestationLogin.headers
    .get("set-cookie")!
    .split(";")[0];
  const attestations = await request(
    "/auth/attestations/me",
    "GET",
    attestationCookie,
  );
  assert.equal(attestations.status, 200);
  checks++;
  const attestationBody = (await attestations.json()) as any;
  assert.equal(attestationBody.attestations.length, 1);
  checks++;
  assert.equal(attestationBody.attestations[0].type, "AGE_18_PLUS");
  checks++;
  assert.equal(attestationBody.attestations[0].version, "v1");
  checks++;
  assert.equal(attestationBody.attestations[0].source, "REGISTRATION");
  checks++;
  const [attestedUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, attestationEmail));
  assert.ok(attestedUser);
  checks++;
  const attestationRows = await db
    .select()
    .from(userAttestations)
    .where(eq(userAttestations.userId, attestedUser.id));
  assert.equal(attestationRows.length, 1);
  checks++;
  assert.equal(attestationRows[0].attestationType, "AGE_18_PLUS");
  checks++;
  assert.equal(attestationRows[0].attestationVersion, "v1");
  checks++;
  assert.equal(attestationRows[0].source, "REGISTRATION");
  checks++;
  // An authenticated requester asking about their own email is verified by
  // session — no email round-trip.
  const selfRequest = await request(
    "/privacy/requests",
    "POST",
    attestationCookie,
    { email: attestationEmail, type: "CORRECTION" },
  );
  assert.equal(selfRequest.status, 202);
  checks++;
  assert.equal(((await selfRequest.json()) as any).status, "SUBMITTED");
  checks++;
  const mine = await request("/privacy/requests/me", "GET", attestationCookie);
  assert.equal(mine.status, 200);
  checks++;
  assert.ok(
    ((await mine.json()) as any).requests.some(
      (row: any) => row.email === attestationEmail && row.type === "CORRECTION",
    ),
  );
  checks++;
  // Logout invalidates the session created by the attested registration.
  assert.equal(
    (await request("/auth/logout", "POST", attestationCookie, {})).status,
    204,
  );
  checks++;
  assert.equal((await request("/auth/me", "GET", attestationCookie)).status, 401);
  checks++;

  // --- Retention policies + dry-run (read-only — nothing is deleted) -------
  assert.equal(
    (await request("/admin/retention/dry-run", "GET", society.cookie)).status,
    403,
  );
  checks++;
  const policy = await request("/admin/retention/policies", "POST", admin.cookie, {
    dataCategory: "PRIVACY_REQUEST",
    retentionDays: 30,
    description: "TEST ONLY retention policy",
  });
  assert.equal(policy.status, 201);
  checks++;
  assert.equal(
    (
      await request("/admin/retention/policies", "POST", admin.cookie, {
        dataCategory: "PRIVACY_REQUEST",
        retentionDays: 90,
      })
    ).status,
    409,
  );
  checks++;
  const policies = await request("/admin/retention/policies", "GET", admin.cookie);
  assert.equal(policies.status, 200);
  checks++;
  assert.ok(
    ((await policies.json()) as any).policies.some(
      (row: any) =>
        row.dataCategory === "PRIVACY_REQUEST" && row.retentionDays === 30,
    ),
  );
  checks++;
  const dryRun = await request("/admin/retention/dry-run", "GET", admin.cookie);
  assert.equal(dryRun.status, 200);
  checks++;
  const dryRunBody = (await dryRun.json()) as any;
  assert.equal(dryRunBody.deletedRows, 0);
  checks++;
  const privacyCategory = dryRunBody.categories.find(
    (row: any) => row.category === "PRIVACY_REQUEST",
  );
  assert.ok(privacyCategory);
  checks++;
  assert.equal(privacyCategory.policy.retentionDays, 30);
  checks++;
  assert.equal(privacyCategory.eligibleRows, 0);
  checks++;
  assert.ok(
    dryRunBody.categories.some(
      (row: any) =>
        row.category === "ENQUIRY" && row.note.includes("No active retention policy"),
    ),
  );
  checks++;

  console.log(`privacy integration checks passed: ${checks}`);
} finally {
  globalThis.fetch = nativeFetch;
  server.close();
  if (previousOtpSecret === undefined) delete process.env.RENOVA_AUTH_TOKEN_SECRET;
  else process.env.RENOVA_AUTH_TOKEN_SECRET = previousOtpSecret;
  if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previousNodeEnv;
  for (const key of [
    "RENOVA_EMAIL_PROVIDER",
    "RESEND_API_KEY",
    "RENOVA_APP_URL",
    "RENOVA_EMAIL_FROM",
    "RENOVA_REGISTRATION_TEST_TOKEN",
  ])
    delete process.env[key];
  await engine.close();
}
