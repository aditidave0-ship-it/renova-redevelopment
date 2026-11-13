import assert from "node:assert/strict";
import test from "node:test";
import {
  CONSENT_VERSION,
  assertConsentPurpose,
  consentEventForEnquiry,
} from "./consent-policy";

test("the enquiry-response consent purpose is valid", () => {
  assertConsentPurpose("ENQUIRY_RESPONSE");
});

test("an unknown consent purpose is rejected with a 400", () => {
  assert.throws(
    () => assertConsentPurpose("MARKETING"),
    (error: { status?: number; message: string }) =>
      error.status === 400 && /Unknown consent purpose/.test(error.message),
  );
});

test("an enquiry consent event records who, what and which version", () => {
  const event = consentEventForEnquiry({
    id: "00000000-0000-0000-0000-000000000001",
    email: "society@example.invalid",
    source: "WEBSITE",
    reference: "REQ-2026-ABCDEF1234",
  });
  assert.deepEqual(event, {
    subjectType: "ENQUIRY",
    subjectId: "00000000-0000-0000-0000-000000000001",
    email: "society@example.invalid",
    purpose: "ENQUIRY_RESPONSE",
    consentVersion: CONSENT_VERSION,
    action: "GIVEN",
    actor: "SUBJECT",
    metadata: { source: "WEBSITE", reference: "REQ-2026-ABCDEF1234" },
  });
});
