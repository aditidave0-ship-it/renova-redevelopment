import test from "node:test";
import assert from "node:assert/strict";
import {
  participantRoles,
  participantFor,
  publicSignupEnabled,
  professionalSpecialization,
  registrationParticipant,
} from "../src/experience/roles";
import { workspaceApi, WorkspaceApiError } from "../src/platform/workspace-api";
import {
  buildRequirementEnquiryPayload,
  sendRequirementEnquiry,
} from "../src/experience/requirement-enquiry";
test("public participant choices retain distinct roles and never grant ADMIN", () => {
  assert.equal(participantRoles.length, 8);
  assert.deepEqual(
    new Set(participantRoles.map((item) => item.role)),
    new Set(["SOCIETY", "DEVELOPER", "PMC", "PROFESSIONAL"]),
  );
  for (const id of ["legal", "architect", "structural", "finance", "other"])
    assert.equal(participantFor(id).role, "PROFESSIONAL");
  assert.equal(participantFor("pmc").role, "PMC");
  assert.equal(participantFor("ADMIN").role, "SOCIETY");
  assert.equal(publicSignupEnabled, false);
  assert.equal(professionalSpecialization("architect"), "ARCHITECT");
  assert.equal(professionalSpecialization("finance"), "VALUATION_FINANCE");
  assert.equal(registrationParticipant("legal"), "ADVOCATE_LEGAL");
  assert.equal(registrationParticipant("structural"), "STRUCTURAL_CONSULTANT");
  assert.equal(registrationParticipant("other"), "OTHER_PROFESSIONAL");
  assert.equal(professionalSpecialization("developer"), undefined);
});
test("society requirements map into the existing enquiry API payload", () => {
  const payload = buildRequirementEnquiryPayload({
    societyName: "Harbour View CHS",
    location: "Chembur, Mumbai",
    societyType: "Co-operative Housing Society",
    memberCount: 52,
    buildingAge: 38,
    landType: "Leasehold",
    plotArea: 1200,
    conveyanceStatus: "In progress",
    structuralAudit: "Not sure",
    services: ["Feasibility review", "PMC support"],
    timeline: "Within 3 months",
    brief: "Committee is collecting information.",
    contactName: "Test Contact",
    contactRole: "Secretary",
    phone: "9876543210",
    email: "test@example.com",
    consent: true,
  });
  assert.equal(payload.name, "Test Contact");
  assert.equal(payload.organizationName, "Harbour View CHS");
  assert.equal(payload.city, "Chembur, Mumbai");
  assert.equal(payload.actorType, "Housing Society");
  assert.equal(payload.consent, true);
  assert.match(payload.message, /Member households: 52/);
  assert.match(payload.message, /Services requested: Feasibility review, PMC support/);
  assert.match(payload.message, /Committee contact role: Secretary/);
  assert.equal("experienceYears" in payload && payload.experienceYears, null);
});
test("society requirement cannot be mapped without enquiry consent", () => {
  assert.throws(
    () =>
      buildRequirementEnquiryPayload({
        societyName: "Harbour View CHS",
        location: "Mumbai",
        societyType: "Co-operative Housing Society",
        memberCount: 52,
        buildingAge: 38,
        services: ["Feasibility review"],
        timeline: "Exploring",
        contactName: "Test Contact",
        contactRole: "Secretary",
        phone: "9876543210",
        email: "test@example.com",
        consent: false,
      }),
    /Consent is required/,
  );
});
test("requirement submission uses the enquiries API and only returns a real reference", async () => {
  const details = {
    societyName: "Harbour View CHS",
    location: "Mumbai",
    societyType: "Co-operative Housing Society",
    memberCount: 52,
    buildingAge: 38,
    services: ["Feasibility review"],
    timeline: "Exploring",
    contactName: "Test Contact",
    contactRole: "Secretary",
    phone: "9876543210",
    email: "test@example.com",
    consent: true,
  };
  let capturedUrl = "";
  let capturedInit: RequestInit | undefined;
  const reference = await sendRequirementEnquiry(details, async (url, init) => {
    capturedUrl = String(url);
    capturedInit = init;
    return new Response(JSON.stringify({ reference: "ENQ-TEST-1" }), {
      status: 201,
      headers: { "content-type": "application/json" },
    });
  });
  assert.equal(capturedUrl, "/api/enquiries");
  assert.equal(capturedInit?.method, "POST");
  assert.equal(capturedInit?.credentials, "same-origin");
  assert.equal(reference, "ENQ-TEST-1");
  await assert.rejects(
    sendRequirementEnquiry(details, async () =>
      new Response(JSON.stringify({ error: "Database unavailable" }), {
        status: 503,
        headers: { "content-type": "application/json" },
      }),
    ),
    /Database unavailable/,
  );
});
test("API requests retain same-origin cookies and surface only confirmed JSON success", async () => {
  const original = globalThis.fetch;
  let observed: RequestInit | undefined;
  globalThis.fetch = async (url, init) => {
    assert.equal(url, "/api/enquiries");
    observed = init;
    return new Response(JSON.stringify({ reference: "QA-LOCAL-ONLY" }), {
      status: 201,
      headers: { "content-type": "application/json" },
    });
  };
  try {
    assert.deepEqual(
      await workspaceApi("/enquiries", { method: "POST", body: "{}" }),
      { reference: "QA-LOCAL-ONLY" },
    );
    assert.equal(observed?.credentials, "same-origin");
    assert.equal(observed?.method, "POST");
  } finally {
    globalThis.fetch = original;
  }
});
test("logout accepts the API's empty 204 response without leaving the client signed in", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (url, init) => {
      assert.equal(url, "/api/auth/logout");
      assert.equal(init?.method, "POST");
      assert.equal(init?.credentials, "same-origin");
      return new Response(null, { status: 204 });
    };
    assert.equal(await workspaceApi<void>("/auth/logout", { method: "POST" }), undefined);
    globalThis.fetch = async () => new Response(null, { status: 401 });
    await assert.rejects(
      workspaceApi<void>("/auth/logout", { method: "POST" }),
      (error) => error instanceof WorkspaceApiError && error.status === 401,
    );
  } finally {
    globalThis.fetch = original;
  }
});
test("missing, forbidden, unavailable and non-JSON services cannot be reported as success", async () => {
  const original = globalThis.fetch;
  try {
    for (const status of [403, 404, 500]) {
      globalThis.fetch = async () =>
        new Response(JSON.stringify({ error: "Not available" }), {
          status,
          headers: { "content-type": "application/json" },
        });
      await assert.rejects(
        workspaceApi("/societies/me/feasibility"),
        (error) =>
          error instanceof WorkspaceApiError && error.status === status,
      );
    }
    globalThis.fetch = async () =>
      new Response("<html>SPA fallback</html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    await assert.rejects(
      workspaceApi("/organizations/me"),
      (error) => error instanceof WorkspaceApiError && error.status === 502,
    );
  } finally {
    globalThis.fetch = original;
  }
});
