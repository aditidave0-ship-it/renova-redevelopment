import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRequirementEnquiryPayload,
  sendRequirementEnquiry,
} from "../src/experience/requirement-enquiry.ts";

const details = {
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
};

test("society requirements map to the existing enquiry payload", () => {
  const payload = buildRequirementEnquiryPayload(details);
  assert.equal(payload.name, "Test Contact");
  assert.equal(payload.organizationName, "Harbour View CHS");
  assert.equal(payload.city, "Chembur, Mumbai");
  assert.equal(payload.actorType, "Housing Society");
  assert.equal(payload.consent, true);
  assert.match(payload.message, /Member households: 52/);
  assert.match(
    payload.message,
    /Services requested: Feasibility review, PMC support/,
  );
  assert.match(payload.message, /Committee contact role: Secretary/);
});

test("requirements cannot be submitted without the enquiry consent", () => {
  assert.throws(
    () => buildRequirementEnquiryPayload({ ...details, consent: false }),
    /Consent is required/,
  );
});

test("submission calls only the existing API and requires a persisted reference", async () => {
  let requestUrl = "";
  let requestInit;
  const reference = await sendRequirementEnquiry(details, async (url, init) => {
    requestUrl = url;
    requestInit = init;
    return new Response(JSON.stringify({ reference: "ENQ-TEST-1" }), {
      status: 201,
      headers: { "content-type": "application/json" },
    });
  });
  assert.equal(requestUrl, "/api/enquiries");
  assert.equal(requestInit.method, "POST");
  assert.equal(requestInit.credentials, "same-origin");
  assert.equal(reference, "ENQ-TEST-1");
});

test("failed API response rejects instead of reporting local success", async () => {
  await assert.rejects(
    sendRequirementEnquiry(
      details,
      async () =>
        new Response(JSON.stringify({ error: "Database unavailable" }), {
          status: 503,
          headers: { "content-type": "application/json" },
        }),
    ),
    /Database unavailable/,
  );
});
